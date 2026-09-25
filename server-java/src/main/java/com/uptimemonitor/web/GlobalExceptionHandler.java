package com.uptimemonitor.web;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.ValidationException;
import com.uptimemonitor.config.AppProperties;
import com.uptimemonitor.security.RequireAdmin;
import com.uptimemonitor.security.RequireEditor;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.uptimemonitor.security.AuthUser;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps exceptions to the Node server's error shapes:
 * <ul>
 *   <li>{@code {"error": "..."}} for expected failures</li>
 *   <li>{@code {"error":"Validation failed","details":[...]}} for validation</li>
 *   <li>{@code {"error":"Not found"}} for unmapped routes - the client special-cases it</li>
 *   <li>500s: the message in dev, "Internal server error" in production</li>
 * </ul>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final AppProperties props;

    public GlobalExceptionHandler(AppProperties props) {
        this.props = props;
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, Object>> api(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(e.body());
    }

    @ExceptionHandler(ValidationException.class)
    ResponseEntity<Map<String, Object>> validation(ValidationException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "Validation failed");
        body.put("details", e.getDetails());
        return ResponseEntity.badRequest().body(body);
    }

    /** RBAC denial from method security, with the same message as middlewares/rbac.js. */
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Map<String, Object>> accessDenied(AccessDeniedException e, HandlerMethod handler) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthUser user)) {
            return ResponseEntity.status(401).body(Map.of("error", "Authentication required"));
        }
        List<String> allowed = allowedRoles(handler);
        String message = allowed.isEmpty()
                ? "Forbidden"
                : "Requires one of: " + String.join(", ", allowed) + ". You are " + user.role() + ".";
        return ResponseEntity.status(403).body(Map.of("error", message));
    }

    private static List<String> allowedRoles(HandlerMethod handler) {
        if (handler == null) {
            return List.of();
        }
        if (AnnotatedElementUtils.hasAnnotation(handler.getMethod(), RequireAdmin.class)
                || AnnotatedElementUtils.hasAnnotation(handler.getBeanType(), RequireAdmin.class)) {
            return RequireAdmin.ROLES;
        }
        if (AnnotatedElementUtils.hasAnnotation(handler.getMethod(), RequireEditor.class)
                || AnnotatedElementUtils.hasAnnotation(handler.getBeanType(), RequireEditor.class)) {
            return RequireEditor.ROLES;
        }
        return List.of();
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class,
            HttpRequestMethodNotSupportedException.class})
    ResponseEntity<Map<String, Object>> notFound() {
        return ResponseEntity.status(404).body(Map.of("error", "Not found"));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, Object>> unreadable(HttpServletRequest request) {
        return error(400, "Malformed JSON request body", request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<Map<String, Object>> mediaType(HttpServletRequest request) {
        return error(415, "Content-Type must be application/json", request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<Map<String, Object>> typeMismatch(MethodArgumentTypeMismatchException e, HttpServletRequest request) {
        return error(400, "Invalid value for " + e.getName(), request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> unhandled(Exception e, HttpServletRequest request) {
        log.error("unhandled request error {} {}", request.getMethod(), request.getRequestURI(), e);
        String message = props.isProd() ? "Internal server error" : String.valueOf(e.getMessage());
        return error(HttpStatus.INTERNAL_SERVER_ERROR.value(), message, request);
    }

    private static ResponseEntity<Map<String, Object>> error(int status, String message, HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        String requestId = RequestIdFilter.current(request);
        if (requestId != null) {
            body.put("requestId", requestId);
        }
        return ResponseEntity.status(status).body(body);
    }
}
