package com.uptimemonitor.config;

import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.flyway.autoconfigure.FlywayConfigurationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/** Applies {@link DatabaseConnectionSettings} to the Hikari pool and to Flyway. */
@Configuration(proxyBeanMethods = false)
public class DatabaseConfig {

    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

    @Bean
    static DatabaseConnectionSettings databaseConnectionSettings(Environment env) {
        return DatabaseConnectionSettings.from(env::getProperty);
    }

    // Static so the post-processor is registered before the DataSource bean is created.
    @Bean
    static BeanPostProcessor hikariConnectionSettings(Environment env) {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessBeforeInitialization(Object bean, String beanName) {
                if (bean instanceof HikariDataSource hikari) {
                    DatabaseConnectionSettings settings = DatabaseConnectionSettings.from(env::getProperty);
                    settings.jdbcProperties().forEach(hikari::addDataSourceProperty);
                    log.info("Database connection: TLS {}, prepareThreshold {}",
                            settings.tlsRequired() ? "verify-full" : "off",
                            settings.jdbcProperties().getOrDefault("prepareThreshold", "default"));
                }
                return bean;
            }
        };
    }

    @Bean
    FlywayConfigurationCustomizer flywayConnection(DatabaseConnectionSettings settings, Environment env) {
        return configuration -> {
            if (settings.flywayPort() == null) {
                return;
            }
            String url = settings.flywayUrl(env.getProperty("DB_HOST", "localhost"),
                    env.getProperty("DB_NAME", "uptime_monitor"));
            configuration.dataSource(url, env.getProperty("DB_USER"), env.getProperty("DB_PASSWORD"));
            log.info("Flyway uses its own connection on port {}", settings.flywayPort());
        };
    }
}
