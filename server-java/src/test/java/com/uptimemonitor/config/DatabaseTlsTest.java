package com.uptimemonitor.config;

import com.uptimemonitor.support.PostgresTestcontainer;
import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.postgresql.PGConnection;
import org.springframework.mock.env.MockEnvironment;
import org.testcontainers.images.builder.Transferable;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Real TLS handshakes against a Postgres that only accepts encrypted connections, with a
 * server certificate issued for "localhost" by a test CA (src/test/resources/tls). This is
 * the same trust shape as Supabase: a private root CA pinned by file, verify-full.
 */
class DatabaseTlsTest {

    static final Path TLS = Path.of("src/test/resources/tls");

    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(PostgresTestcontainer.IMAGE)
            .withCopyToContainer(Transferable.of(read("server.crt")), "/tls/server.crt")
            .withCopyToContainer(Transferable.of(read("server.key")), "/tls/server.key")
            .withCopyToContainer(Transferable.of("""
                    local all all trust
                    hostssl all all all scram-sha-256
                    host all all all reject
                    """), "/tls/pg_hba.conf")
            // Postgres refuses a key readable by others, and files copied in are owned by root.
            .withCreateContainerCmdModifier(cmd -> cmd.withEntrypoint("sh", "-c",
                    "cp /tls/server.crt /tls/server.key /tls/pg_hba.conf /var/lib/postgresql/ && "
                            + "chown postgres /var/lib/postgresql/server.* /var/lib/postgresql/pg_hba.conf && "
                            + "chmod 600 /var/lib/postgresql/server.key && "
                            + "exec docker-entrypoint.sh postgres -c fsync=off -c ssl=on "
                            + "-c ssl_cert_file=/var/lib/postgresql/server.crt "
                            + "-c ssl_key_file=/var/lib/postgresql/server.key "
                            + "-c hba_file=/var/lib/postgresql/pg_hba.conf"));

    @BeforeAll
    static void start() {
        POSTGRES.start();
    }

    @AfterAll
    static void stop() {
        POSTGRES.stop();
    }

    private static byte[] read(String name) {
        try {
            return Files.readAllBytes(TLS.resolve(name));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static Map<String, String> env(String caFile) {
        Map<String, String> env = new HashMap<>();
        env.put("DB_SSL", "true");
        env.put("DB_SSL_CA_FILE", TLS.resolve(caFile).toString());
        env.put("DB_PREPARE_THRESHOLD", "0");
        return env;
    }

    private static Connection connect(String host, Map<String, String> env) throws SQLException {
        Properties props = new Properties();
        props.setProperty("user", POSTGRES.getUsername());
        props.setProperty("password", POSTGRES.getPassword());
        DatabaseConnectionSettings.from(env::get).jdbcProperties().forEach(props::setProperty);
        return DriverManager.getConnection(url(host), props);
    }

    private static String url(String host) {
        return "jdbc:postgresql://" + host + ":" + POSTGRES.getMappedPort(5432) + "/" + POSTGRES.getDatabaseName();
    }

    private static Map<String, Object> sslStatus(Connection c) throws SQLException {
        try (Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid()")) {
            rs.next();
            return Map.of("ssl", rs.getBoolean(1), "version", rs.getString(2), "cipher", rs.getString(3));
        }
    }

    @Test
    void pinnedCaAndMatchingHostNameConnectOverTls() throws Exception {
        try (Connection c = connect("localhost", env("test-ca.crt"))) {
            var ssl = sslStatus(c);
            assertThat(ssl.get("ssl")).isEqualTo(true);
            assertThat((String) ssl.get("version")).startsWith("TLSv1.");
            assertThat(c.unwrap(PGConnection.class).getPrepareThreshold()).isZero();
        }
    }

    @Test
    void certificateFromAnotherCaIsRejected() {
        assertThatThrownBy(() -> connect("localhost", env("other-ca.crt")).close())
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("SSL");
    }

    @Test
    void hostNameNotOnTheCertificateIsRejected() {
        // Same server and CA, but the certificate names "localhost", not 127.0.0.1.
        assertThatThrownBy(() -> connect("127.0.0.1", env("test-ca.crt")).close())
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("127.0.0.1");
    }

    @Test
    void jvmTrustStoreDoesNotTrustAPrivateCa() {
        Map<String, String> noPin = new HashMap<>(Map.of("DB_SSL", "true"));
        assertThatThrownBy(() -> connect("localhost", noPin).close()).isInstanceOf(SQLException.class);
    }

    @Test
    void plaintextIsRefusedByAServerThatRequiresTls() {
        Map<String, String> plain = new HashMap<>();
        Properties props = new Properties();
        props.setProperty("user", POSTGRES.getUsername());
        props.setProperty("password", POSTGRES.getPassword());
        props.setProperty("sslmode", "disable");
        assertThatThrownBy(() -> DriverManager.getConnection(url("localhost"), props).close())
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("no encryption");
        assertThat(DatabaseConnectionSettings.from(plain::get).tlsRequired()).isFalse();
    }

    @Test
    void hikariPoolGetsTheSettingsFromTheBeanPostProcessor() throws Exception {
        MockEnvironment environment = new MockEnvironment();
        env("test-ca.crt").forEach(environment::setProperty);
        try (HikariDataSource ds = new HikariDataSource()) {
            ds.setJdbcUrl(url("localhost"));
            ds.setUsername(POSTGRES.getUsername());
            ds.setPassword(POSTGRES.getPassword());
            ds.setMaximumPoolSize(4);
            DatabaseConfig.hikariConnectionSettings(environment).postProcessBeforeInitialization(ds, "dataSource");
            for (int i = 0; i < 20; i++) {
                try (Connection c = ds.getConnection()) {
                    assertThat(sslStatus(c).get("ssl")).isEqualTo(true);
                    assertThat(c.unwrap(PGConnection.class).getPrepareThreshold()).isZero();
                }
            }
        }
    }

    @Test
    void flywayMigratesOverItsOwnTlsConnection() {
        Map<String, String> env = env("test-ca.crt");
        env.put("FLYWAY_DB_PORT", String.valueOf(POSTGRES.getMappedPort(5432)));
        var settings = DatabaseConnectionSettings.from(env::get);
        var result = Flyway.configure()
                .dataSource(settings.flywayUrl("localhost", POSTGRES.getDatabaseName()),
                        POSTGRES.getUsername(), POSTGRES.getPassword())
                .baselineOnMigrate(true)
                .baselineVersion("1")
                .load()
                .migrate();
        assertThat(result.success).isTrue();
        assertThat(result.migrationsExecuted).isEqualTo(2);
    }
}
