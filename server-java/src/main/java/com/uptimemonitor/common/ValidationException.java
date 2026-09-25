package com.uptimemonitor.common;

import java.util.List;

/** Rendered as {@code 400 {"error":"Validation failed","details":[{field,message}]}}. */
public class ValidationException extends RuntimeException {

    public record FieldError(String field, String message) {
    }

    private final List<FieldError> details;

    public ValidationException(List<FieldError> details) {
        super("Validation failed");
        this.details = List.copyOf(details);
    }

    public List<FieldError> getDetails() {
        return details;
    }
}
