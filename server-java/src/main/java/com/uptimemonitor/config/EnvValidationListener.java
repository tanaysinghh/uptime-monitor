package com.uptimemonitor.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * Runs {@link EnvValidator} once the environment (including imported .env files) is
 * prepared, before the application context and DataSource exist. A failure aborts
 * startup with a non-zero exit code, like process.exit(1) in the Node server.
 */
public class EnvValidationListener implements ApplicationListener<ApplicationEnvironmentPreparedEvent> {

    private static final Logger log = LoggerFactory.getLogger(EnvValidationListener.class);

    @Override
    public void onApplicationEvent(ApplicationEnvironmentPreparedEvent event) {
        ConfigurableEnvironment env = event.getEnvironment();
        try {
            EnvValidator.Result result = EnvValidator.validate(env::getProperty);
            log.info("Environment validated [{}]", result.nodeEnv());
        } catch (EnvValidator.EnvValidationException e) {
            System.err.println(e.getMessage());
            throw e;
        }
    }
}
