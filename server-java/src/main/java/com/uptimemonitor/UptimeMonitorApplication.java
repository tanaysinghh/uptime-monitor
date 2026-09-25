package com.uptimemonitor;

import com.uptimemonitor.config.EnvValidationListener;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

// Users authenticate with JWTs (JwtAuthFilter); Boot's default in-memory user store is unused.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
public class UptimeMonitorApplication {

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(UptimeMonitorApplication.class);
        // Fail fast on missing/weak configuration before any bean (DataSource, JWT) is built.
        app.addListeners(new EnvValidationListener());
        app.run(args);
    }
}
