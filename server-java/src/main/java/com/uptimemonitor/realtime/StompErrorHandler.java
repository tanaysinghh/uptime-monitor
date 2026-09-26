package com.uptimemonitor.realtime;

import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.web.socket.messaging.StompSubProtocolErrorHandler;

/**
 * ERROR frames carry the reason a frame was refused ("Unauthorized: ...", "Forbidden: ...")
 * so the client can tell an expired token from a real failure. Spring wraps interceptor
 * exceptions, so the refusal is unwrapped here; anything else gets a generic message
 * rather than internal details.
 */
public class StompErrorHandler extends StompSubProtocolErrorHandler {

    @Override
    public Message<byte[]> handleClientMessageProcessingError(Message<byte[]> clientMessage, Throwable ex) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(org.springframework.messaging.simp.stomp.StompCommand.ERROR);
        accessor.setMessage(reason(ex));
        accessor.setLeaveMutable(true);
        return handleInternal(accessor, new byte[0], ex, clientMessage == null ? null
                : org.springframework.messaging.support.MessageHeaderAccessor.getAccessor(clientMessage, StompHeaderAccessor.class));
    }

    static String reason(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof StompRefusedException refused) {
                return refused.getMessage();
            }
        }
        return "Internal error";
    }
}
