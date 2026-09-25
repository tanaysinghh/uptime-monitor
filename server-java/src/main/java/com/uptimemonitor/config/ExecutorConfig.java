package com.uptimemonitor.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class ExecutorConfig {

    /**
     * Virtual-thread executor for monitor checks and alert delivery (blocking network
     * I/O). Spring closes it on shutdown, which waits for in-flight checks to finish.
     */
    @Bean(destroyMethod = "close")
    ExecutorService backgroundExecutor() {
        return Executors.newThreadPerTaskExecutor(Thread.ofVirtual().name("bg-", 0).factory());
    }
}
