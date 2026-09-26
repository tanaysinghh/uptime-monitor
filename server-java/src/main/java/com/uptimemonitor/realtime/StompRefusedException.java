package com.uptimemonitor.realtime;

import org.springframework.messaging.MessagingException;

/** A frame refused by {@link StompAuthInterceptor}; its message is safe to show the client. */
public class StompRefusedException extends MessagingException {

    public StompRefusedException(String reason) {
        super(reason);
    }
}
