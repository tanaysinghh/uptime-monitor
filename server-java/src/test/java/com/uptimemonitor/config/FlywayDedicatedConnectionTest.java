package com.uptimemonitor.config;

import com.uptimemonitor.support.PostgresTestcontainer;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * With FLYWAY_DB_PORT set, the application context gives Flyway its own connection (in
 * production: Supabase's session pooler) while the app pool keeps using DB_PORT.
 */
@SpringBootTest
@ActiveProfiles("test")
class FlywayDedicatedConnectionTest {

    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(PostgresTestcontainer.IMAGE);

    @BeforeAll
    static void start() {
        POSTGRES.start();
    }

    @AfterAll
    static void stop() {
        POSTGRES.stop();
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("DB_HOST", POSTGRES::getHost);
        registry.add("DB_NAME", POSTGRES::getDatabaseName);
        registry.add("DB_USER", POSTGRES::getUsername);
        registry.add("DB_PASSWORD", POSTGRES::getPassword);
        registry.add("FLYWAY_DB_PORT", () -> POSTGRES.getMappedPort(5432));
    }

    @Autowired
    Flyway flyway;

    @Autowired
    DataSource appDataSource;

    @Test
    void flywayRunsOnItsOwnConnectionAndTheSchemaIsInPlace() {
        assertThat(flyway.getConfiguration().getDataSource()).isNotSameAs(appDataSource);
        assertThat(flyway.getConfiguration().getUrl())
                .isEqualTo("jdbc:postgresql://" + POSTGRES.getHost() + ":" + POSTGRES.getMappedPort(5432)
                        + "/" + POSTGRES.getDatabaseName());
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("2");
    }
}
