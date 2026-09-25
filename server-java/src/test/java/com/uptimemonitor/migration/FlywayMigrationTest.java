package com.uptimemonitor.migration;

import com.uptimemonitor.support.PostgresTestcontainer;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies both upgrade paths: a fresh database gets V1+V2, and a database that the Node
 * server created with sequelize.sync({ alter: true }) - no Flyway history, duplicated
 * UNIQUE constraints - is baselined at V1 and cleaned up by V2 without data loss.
 */
class FlywayMigrationTest {

    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(PostgresTestcontainer.IMAGE);

    @BeforeAll
    static void start() {
        POSTGRES.start();
    }

    @AfterAll
    static void stop() {
        POSTGRES.stop();
    }

    private static Connection connect(String db) throws Exception {
        String url = POSTGRES.getJdbcUrl().replace("/" + POSTGRES.getDatabaseName(), "/" + db);
        return DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private static void createDatabase(String name) throws Exception {
        try (Connection c = connect(POSTGRES.getDatabaseName()); Statement s = c.createStatement()) {
            s.execute("CREATE DATABASE " + name);
        }
    }

    private static Flyway flyway(String db) {
        String url = POSTGRES.getJdbcUrl().replace("/" + POSTGRES.getDatabaseName(), "/" + db);
        return Flyway.configure()
                .dataSource(url, POSTGRES.getUsername(), POSTGRES.getPassword())
                .baselineOnMigrate(true)
                .baselineVersion("1")
                .load();
    }

    private static List<String> uniqueConstraints(Connection c) throws Exception {
        List<String> names = new ArrayList<>();
        try (Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SELECT con.conname FROM pg_constraint con "
                     + "JOIN pg_namespace n ON n.oid = con.connamespace "
                     + "WHERE con.contype = 'u' AND n.nspname = 'public' ORDER BY con.conname")) {
            while (rs.next()) {
                names.add(rs.getString(1));
            }
        }
        return names;
    }

    @Test
    void freshDatabaseGetsTheFullSchema() throws Exception {
        createDatabase("fresh_db");
        var result = flyway("fresh_db").migrate();
        assertThat(result.migrationsExecuted).isEqualTo(2);
        try (Connection c = connect("fresh_db")) {
            assertThat(uniqueConstraints(c)).containsExactlyInAnyOrder(
                    "Monitors_heartbeatToken_key", "Organizations_slug_key", "Users_email_key");
        }
    }

    @Test
    void existingSequelizeDatabaseIsBaselinedAndDeduplicated() throws Exception {
        createDatabase("sequelize_db");
        String v1 = new ClassPathResource("db/migration/V1__baseline_schema.sql")
                .getContentAsString(StandardCharsets.UTF_8);
        try (Connection c = connect("sequelize_db"); Statement s = c.createStatement()) {
            // Simulate what the Node server left behind: the schema, some data, and the
            // duplicate constraints repeated sync({ alter: true }) runs create.
            s.execute(v1);
            for (int i = 1; i <= 3; i++) {
                s.execute("ALTER TABLE \"Users\" ADD CONSTRAINT \"Users_email_key" + i + "\" UNIQUE (email)");
                s.execute("ALTER TABLE \"Organizations\" ADD CONSTRAINT \"Organizations_slug_key" + i + "\" UNIQUE (slug)");
            }
            s.execute("INSERT INTO \"Organizations\" (id, name, slug, \"createdAt\", \"updatedAt\") "
                    + "VALUES ('11111111-1111-4111-8111-111111111111', 'Legacy', 'legacy', now(), now())");
        }

        var result = flyway("sequelize_db").migrate();

        List<String> applied = Arrays.stream(flyway("sequelize_db").info().applied())
                .map(MigrationInfo::getDescription).toList();
        assertThat(applied).contains("<< Flyway Baseline >>", "drop duplicate unique constraints");
        assertThat(result.migrationsExecuted).isEqualTo(1);
        try (Connection c = connect("sequelize_db"); Statement s = c.createStatement()) {
            assertThat(uniqueConstraints(c)).containsExactlyInAnyOrder(
                    "Monitors_heartbeatToken_key", "Organizations_slug_key", "Users_email_key");
            ResultSet rs = s.executeQuery("SELECT count(*) FROM \"Organizations\"");
            rs.next();
            assertThat(rs.getInt(1)).isEqualTo(1);
        }
    }

    @Test
    void duplicatesReAddedByTheNodeServerAreCleanedOnEveryBoot() throws Exception {
        createDatabase("alternating_db");
        flyway("alternating_db").migrate();
        try (Connection c = connect("alternating_db"); Statement s = c.createStatement()) {
            // the Node fallback server ran sync({ alter: true }) in between
            s.execute("ALTER TABLE \"Users\" ADD CONSTRAINT \"Users_email_key1\" UNIQUE (email)");
        }
        var result = flyway("alternating_db").migrate(); // next Java boot: nothing pending
        assertThat(result.migrationsExecuted).isZero();
        try (Connection c = connect("alternating_db")) {
            assertThat(uniqueConstraints(c)).doesNotContain("Users_email_key1");
        }
    }
}
