package com.uptimemonitor.realtime;

import com.uptimemonitor.config.AppProperties;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.task.SimpleAsyncTaskSchedulerBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.SimpleAsyncTaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

/**
 * STOMP over WebSocket at {@code /ws} on the HTTP port, replacing the Socket.IO server
 * (which needed its own port). An in-memory broker fans events out to:
 * <ul>
 *   <li>{@code /topic/org/{organizationId}}: dashboards; subscribing needs a valid access
 *       token for that organization, sent in the CONNECT frame</li>
 *   <li>{@code /topic/status/{slug}}: public status pages; open, as the page itself is</li>
 * </ul>
 * Each message carries the Socket.IO event name in an {@code event} header and the same
 * JSON payload the Node server emits. Clients cannot publish (see {@link StompAuthInterceptor}).
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSocketMessageBroker
@ConditionalOnProperty(prefix = "app.realtime", name = "enabled", havingValue = "true", matchIfMissing = true)
public class StompConfig implements WebSocketMessageBrokerConfigurer, DisposableBean {

    public static final String ENDPOINT = "/ws";
    public static final String ORG_TOPIC = "/topic/org/";
    public static final String STATUS_TOPIC = "/topic/status/";
    /** Server and client heartbeat interval: a dropped connection is noticed within ~2 intervals. */
    public static final long HEARTBEAT_MS = 10_000;

    private final AppProperties props;
    private final StompAuthInterceptor authInterceptor;
    // Heartbeat timer for the broker. Owned here rather than declared as a bean, so it
    // cannot become the scheduler that @Scheduled methods pick up.
    private final ThreadPoolTaskScheduler heartbeatScheduler = new ThreadPoolTaskScheduler();

    public StompConfig(AppProperties props, StompAuthInterceptor authInterceptor) {
        this.props = props;
        this.authInterceptor = authInterceptor;
        heartbeatScheduler.setPoolSize(1);
        heartbeatScheduler.setThreadNamePrefix("stomp-heartbeat-");
        heartbeatScheduler.setDaemon(true);
        heartbeatScheduler.initialize();
    }

    @Override
    public void destroy() {
        heartbeatScheduler.shutdown();
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint(ENDPOINT).setAllowedOrigins(props.clientUrl());
        registry.setErrorHandler(new StompErrorHandler());
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic")
                .setHeartbeatValue(new long[]{HEARTBEAT_MS, HEARTBEAT_MS})
                .setTaskScheduler(heartbeatScheduler);
        // No @MessageMapping handlers: clients only subscribe.
        registry.setApplicationDestinationPrefixes("/app");
        // Outbound frames go through a thread pool; without this, a burst of check results
        // can reach a client out of order.
        registry.setPreservePublishOrder(true);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authInterceptor);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        // Clients send only small control frames.
        registration.setMessageSizeLimit(16 * 1024);
    }

    /**
     * {@code @EnableWebSocketMessageBroker} registers its own TaskScheduler, which makes
     * Boot's auto-configured one back off, and {@code @Scheduled} would then silently run
     * on the broker's pool. Keep scheduled jobs on Boot's (virtual-thread) scheduler.
     */
    @Bean(name = "taskScheduler")
    SimpleAsyncTaskScheduler taskScheduler(SimpleAsyncTaskSchedulerBuilder builder) {
        return builder.build();
    }
}
