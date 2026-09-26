package com.uptimemonitor.realtime;

import com.uptimemonitor.security.AccessTokenAuthenticator;
import com.uptimemonitor.security.AuthUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Authentication and authorization for STOMP frames.
 *
 * <ul>
 *   <li>CONNECT may carry {@code Authorization: Bearer <access token>}. A token that is
 *       present must pass the same checks as the HTTP API; without one the connection is
 *       anonymous and can only follow public status pages.</li>
 *   <li>SUBSCRIBE to {@code /topic/org/{id}} requires an authenticated user of that
 *       organization; the token is re-checked, so a session revoked since CONNECT can't
 *       subscribe. {@code /topic/status/{slug}} is open. Any other destination is refused.</li>
 *   <li>SEND is always refused: clients never publish, so nobody can inject events into
 *       another organization's dashboard through the broker.</li>
 * </ul>
 * The Socket.IO server this replaces let any client join any organization's room.
 */
@Component
public class StompAuthInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompAuthInterceptor.class);

    static final String TOKEN_ATTRIBUTE = "stomp.accessToken";
    static final Pattern ORG_DESTINATION = Pattern.compile(
            "^" + Pattern.quote(StompConfig.ORG_TOPIC) + "([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$");
    static final Pattern STATUS_DESTINATION = Pattern.compile(
            "^" + Pattern.quote(StompConfig.STATUS_TOPIC) + "[a-z0-9]+(-[a-z0-9]+)*$");

    /** The STOMP session's user. */
    public record StompPrincipal(AuthUser user) implements Principal {
        @Override
        public String getName() {
            return user.id().toString();
        }
    }

    private final AccessTokenAuthenticator authenticator;

    public StompAuthInterceptor(AccessTokenAuthenticator authenticator) {
        this.authenticator = authenticator;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        switch (accessor.getCommand()) {
            case CONNECT, STOMP -> connect(accessor);
            case SUBSCRIBE -> subscribe(accessor);
            case SEND -> throw refuse("Clients cannot publish");
            default -> {
                // UNSUBSCRIBE, DISCONNECT, ACK/NACK, heartbeats
            }
        }
        return message;
    }

    private void connect(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader("Authorization");
        String token = AccessTokenAuthenticator.bearerToken(header);
        if (header != null && token == null) {
            throw refuse("Unauthorized: expected a Bearer token");
        }
        if (token == null) {
            return; // anonymous: public status pages only
        }
        AccessTokenAuthenticator.Result result = authenticator.authenticate(token);
        if (!result.ok()) {
            throw refuse("Unauthorized: " + result.error());
        }
        accessor.setUser(new StompPrincipal(result.user()));
        Map<String, Object> attributes = accessor.getSessionAttributes();
        if (attributes != null) {
            attributes.put(TOKEN_ATTRIBUTE, token);
        }
    }

    private void subscribe(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null) {
            throw refuse("Forbidden: no destination");
        }
        if (STATUS_DESTINATION.matcher(destination).matches()) {
            return;
        }
        Matcher org = ORG_DESTINATION.matcher(destination);
        if (!org.matches()) {
            throw refuse("Forbidden: unknown destination");
        }
        if (!(accessor.getUser() instanceof StompPrincipal principal)) {
            throw refuse("Unauthorized: organization updates need a signed-in user");
        }
        Map<String, Object> attributes = accessor.getSessionAttributes();
        Object token = attributes == null ? null : attributes.get(TOKEN_ATTRIBUTE);
        AccessTokenAuthenticator.Result current = token == null
                ? null : authenticator.authenticate(token.toString());
        if (current == null || !current.ok()) {
            throw refuse("Unauthorized: " + (current == null ? "no token" : current.error()));
        }
        UUID requested = UUID.fromString(org.group(1));
        if (!requested.equals(current.user().organizationId())) {
            log.warn("User {} tried to subscribe to organization {}", principal.getName(), requested);
            throw refuse("Forbidden: not a member of this organization");
        }
    }

    private static StompRefusedException refuse(String reason) {
        return new StompRefusedException(reason);
    }
}
