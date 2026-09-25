package com.uptimemonitor.security;

import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.List;

/** Method-security equivalent of rbac.js requireEditor (admin or editor). */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@PreAuthorize("hasAnyRole('admin', 'editor')")
public @interface RequireEditor {
    List<String> ROLES = List.of("admin", "editor");
}
