package com.uptimemonitor.monitor;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class KeepAliveTest {

    @Test
    void pingsEveryConfiguredUrlAndSurvivesFailures() throws Exception {
        AtomicInteger hits = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/health", exchange -> {
            hits.incrementAndGet();
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        server.start();
        try {
            String up = "http://127.0.0.1:" + server.getAddress().getPort() + "/api/health";
            KeepAlive keepAlive = new KeepAlive(up + ", http://127.0.0.1:1/unreachable ," + up);
            assertThat(keepAlive.urls()).hasSize(3);
            keepAlive.ping(); // the unreachable URL is logged, not thrown
            assertThat(hits.get()).isEqualTo(2);
        } finally {
            server.stop(0);
        }
    }
}
