package com.uptimemonitor.web;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Replaces Boot's default /error page (used for errors raised outside Spring MVC, e.g. in
 * filters) so every error body keeps the {@code {"error": "..."}} shape.
 */
@RestController
public class JsonErrorController implements ErrorController {

    @RequestMapping("/error")
    ResponseEntity<Map<String, Object>> error(HttpServletRequest request) {
        Object code = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        int status = code instanceof Integer i ? i : 500;
        String message = switch (status) {
            case 404 -> "Not found";
            case 401 -> "No token provided";
            case 403 -> "Forbidden";
            default -> status >= 500 ? "Internal server error" : "Request failed";
        };
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
