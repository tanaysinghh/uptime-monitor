package com.uptimemonitor.web;

import com.uptimemonitor.common.Http;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Port of middlewares/requestId.js + the morgan access log: accept a sane incoming
 * X-Request-Id or mint one, echo it on the response, expose it to logs via MDC.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String ATTRIBUTE = "requestId";
    private static final Pattern VALID = Pattern.compile("^[a-zA-Z0-9-]{8,128}$");
    private static final Logger accessLog = LoggerFactory.getLogger("http.access");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String incoming = request.getHeader("X-Request-Id");
        String id = incoming != null && VALID.matcher(incoming).matches() ? incoming : UUID.randomUUID().toString();
        request.setAttribute(ATTRIBUTE, id);
        response.setHeader("X-Request-Id", id);
        MDC.put(ATTRIBUTE, id);
        long started = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            long ms = (System.nanoTime() - started) / 1_000_000;
            String query = request.getQueryString();
            accessLog.info("{} {} {}{} {} {}ms", Http.clientIp(request), request.getMethod(), request.getRequestURI(),
                    query == null ? "" : "?" + query, response.getStatus(), ms);
            MDC.remove(ATTRIBUTE);
        }
    }

    public static String current(HttpServletRequest request) {
        Object id = request.getAttribute(ATTRIBUTE);
        return id == null ? null : id.toString();
    }
}
