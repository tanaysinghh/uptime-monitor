package com.uptimemonitor.config;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.postgresql.PGConnection;

import java.net.InetAddress;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Live checks against a real Supabase database, with the exact settings the deployed
 * server uses (DB_SSL=true, pinned root CA, transaction pooler, prepareThreshold=0).
 * Opt-in: runs only when SUPABASE_LIVE_TARGET is set, and only reads.
 *
 *   SUPABASE_LIVE_TARGET=prod|clone  SUPABASE_LIVE_REF=<project ref>  SUPABASE_LIVE_PASSWORD=...
 *   SUPABASE_LIVE_LOAD=<queries>     (concurrent load through the pool; default 200)
 */
@EnabledIfEnvironmentVariable(named = "SUPABASE_LIVE_TARGET", matches = "prod|clone")
class SupabaseLiveTlsIT {

    static final String HOST = "aws-0-us-west-2.pooler.supabase.com";

    private static String env(String name) {
        String v = System.getenv(name);
        if (v == null || v.isBlank()) {
            throw new IllegalStateException(name + " is required");
        }
        return v;
    }

    private static Map<String, String> settingsEnv(String caFile) {
        Map<String, String> env = new HashMap<>();
        env.put("DB_SSL", "true");
        env.put("DB_SSL_CA_FILE", caFile);
        env.put("DB_PREPARE_THRESHOLD", "0");
        return env;
    }

    private static Properties props(Map<String, String> env) {
        Properties p = new Properties();
        p.setProperty("user", "postgres." + env("SUPABASE_LIVE_REF"));
        p.setProperty("password", env("SUPABASE_LIVE_PASSWORD"));
        p.setProperty("connectTimeout", "15");
        DatabaseConnectionSettings.from(env::get).jdbcProperties().forEach(p::setProperty);
        return p;
    }

    private static String url(String host, int port) {
        return "jdbc:postgresql://" + host + ":" + port + "/postgres";
    }

    @Test
    void verifiedTlsThroughTheTransactionPoolerRepeatedly() throws Exception {
        Properties p = props(settingsEnv("certs/supabase-root-2021.crt"));
        for (int i = 0; i < 25; i++) {
            try (Connection c = DriverManager.getConnection(url(HOST, 6543), p);
                 PreparedStatement ps = c.prepareStatement("SELECT count(*) FROM public.\"Monitors\" WHERE \"intervalSeconds\" > ?")) {
                assertThat(c.unwrap(PGConnection.class).getPrepareThreshold()).isZero();
                ps.setInt(1, 0);
                try (ResultSet rs = ps.executeQuery()) {
                    assertThat(rs.next()).isTrue();
                }
            }
        }
    }

    @Test
    void sessionPoolerForFlywayAlsoVerifiesTls() throws Exception {
        Properties p = props(settingsEnv("certs/supabase-root-2021.crt"));
        p.remove("prepareThreshold");
        try (Connection c = DriverManager.getConnection(url(HOST, 5432), p);
             ResultSet rs = c.createStatement().executeQuery("SELECT current_setting('server_version')")) {
            assertThat(rs.next()).isTrue();
            assertThat(rs.getString(1)).startsWith("17.");
        }
    }

    @Test
    void concurrentPoolLoadThroughTheTransactionPooler() throws Exception {
        int queries = Integer.parseInt(System.getenv().getOrDefault("SUPABASE_LIVE_LOAD", "200"));
        Properties p = props(settingsEnv("certs/supabase-root-2021.crt"));
        try (HikariDataSource ds = new HikariDataSource()) {
            ds.setJdbcUrl(url(HOST, 6543));
            ds.setUsername(p.getProperty("user"));
            ds.setPassword(p.getProperty("password"));
            ds.setMaximumPoolSize(20);
            ds.addDataSourceProperty("stringtype", "unspecified");
            DatabaseConnectionSettings.from(settingsEnv("certs/supabase-root-2021.crt")::get).jdbcProperties()
                    .forEach(ds::addDataSourceProperty);
            AtomicInteger ok = new AtomicInteger();
            List<String> errors = java.util.Collections.synchronizedList(new ArrayList<>());
            try (ExecutorService pool = Executors.newFixedThreadPool(20)) {
                List<Future<?>> futures = new ArrayList<>();
                for (int i = 0; i < queries; i++) {
                    int n = i;
                    futures.add(pool.submit(() -> {
                        // The same statement text on every connection: with server-side
                        // prepares this is what breaks behind a transaction pooler.
                        try (Connection c = ds.getConnection();
                             PreparedStatement ps = c.prepareStatement(
                                     "SELECT m.id, count(ch.id) FROM public.\"Monitors\" m "
                                             + "LEFT JOIN public.\"Checks\" ch ON ch.\"monitorId\" = m.id AND ch.\"checkedAt\" > now() - (? || ' minutes')::interval "
                                             + "GROUP BY m.id")) {
                            ps.setString(1, String.valueOf(5 + n % 10));
                            try (ResultSet rs = ps.executeQuery()) {
                                while (rs.next()) {
                                    rs.getString(1);
                                }
                            }
                            ok.incrementAndGet();
                        } catch (SQLException e) {
                            errors.add(e.getMessage());
                        }
                        return null;
                    }));
                }
                for (Future<?> f : futures) {
                    f.get();
                }
            }
            assertThat(errors).as("errors").isEmpty();
            assertThat(ok.get()).isEqualTo(queries);
        }
    }

    @Test
    void aDifferentRootCaIsRejected() {
        Properties p = props(settingsEnv("src/test/resources/tls/test-ca.crt"));
        assertThatThrownBy(() -> DriverManager.getConnection(url(HOST, 6543), p).close())
                .isInstanceOf(SQLException.class);
    }

    @Test
    void connectingByIpAddressFailsHostNameVerification() throws Exception {
        String ip = InetAddress.getByName(HOST).getHostAddress();
        Properties p = props(settingsEnv("certs/supabase-root-2021.crt"));
        assertThatThrownBy(() -> DriverManager.getConnection(url(ip, 6543), p).close())
                .isInstanceOf(SQLException.class)
                .hasMessageContaining(ip);
    }

    @Test
    void plaintextIsRefusedByTheServer() {
        Properties p = new Properties();
        p.setProperty("user", "postgres." + env("SUPABASE_LIVE_REF"));
        p.setProperty("password", env("SUPABASE_LIVE_PASSWORD"));
        p.setProperty("sslmode", "disable");
        assertThatThrownBy(() -> DriverManager.getConnection(url(HOST, 6543), p).close())
                .isInstanceOf(SQLException.class);
    }
}
