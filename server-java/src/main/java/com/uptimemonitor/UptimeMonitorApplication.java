package com.uptimemonitor;

import com.uptimemonitor.config.EnvValidationListener;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class UptimeMonitorApplication {

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(UptimeMonitorApplication.class);
        // Fail fast on missing/weak configuration before any bean (DataSource, JWT) is built.
        app.addListeners(new EnvValidationListener());
        app.run(args);
    }
}
