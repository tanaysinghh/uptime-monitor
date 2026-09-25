package com.uptimemonitor.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.Map;

/** 401 with the same messages as auth.js ("No token provided", "Invalid token", ...). */
@Component
public class JsonAuthEntryPoint implements AuthenticationEntryPoint {

    private final JsonMapper mapper;

    public JsonAuthEntryPoint(JsonMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException ex)
            throws IOException {
        Object reason = request.getAttribute(JwtAuthFilter.AUTH_ERROR_ATTRIBUTE);
        String message = reason != null ? reason.toString() : "No token provided";
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), Map.of("error", message));
    }
}
