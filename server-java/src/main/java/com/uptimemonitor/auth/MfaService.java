package com.uptimemonitor.auth;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.Times;
import com.uptimemonitor.domain.SecurityEvent;
import com.uptimemonitor.domain.User;
import com.uptimemonitor.repository.UserRepository;
import com.uptimemonitor.security.AuthUser;
import com.uptimemonitor.security.BackupCodes;
import com.uptimemonitor.security.MfaCrypto;
import com.uptimemonitor.security.SecurityEventService;
import com.uptimemonitor.security.TotpService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Port of controllers/mfaController.js: TOTP enrollment (secret stored AES-GCM encrypted),
 * confirmation that issues ten one-time backup codes, disabling (password + current code,
 * signs out other sessions) and backup-code regeneration.
 */
@Service
public class MfaService {

    private final UserRepository users;
    private final TotpService totp;
    private final MfaCrypto mfaCrypto;
    private final PasswordEncoder passwordEncoder;
    private final SessionService sessions;
    private final SecurityEventService securityEvents;

    public MfaService(UserRepository users, TotpService totp, MfaCrypto mfaCrypto, PasswordEncoder passwordEncoder,
                      SessionService sessions, SecurityEventService securityEvents) {
        this.users = users;
        this.totp = totp;
        this.mfaCrypto = mfaCrypto;
        this.passwordEncoder = passwordEncoder;
        this.sessions = sessions;
        this.securityEvents = securityEvents;
    }

    public Map<String, Object> setup(AuthUser principal) {
        User user = users.findById(principal.id()).orElseThrow(() -> ApiException.notFound("User not found"));
        if (user.isMfaEnabled()) {
            throw ApiException.badRequest("MFA is already enabled. Disable it first to re-enroll.");
        }
        TotpService.Enrollment enrollment = totp.newEnrollment(user.getEmail());
        user.setMfaSecret(mfaCrypto.encrypt(enrollment.secret()));
        users.save(user);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("secret", enrollment.secret());
        body.put("otpauthUrl", enrollment.otpauthUrl());
        body.put("qrDataUrl", enrollment.qrDataUrl());
        return body;
    }

    public Map<String, Object> verify(AuthUser principal, String code, HttpServletRequest request) {
        User user = users.findById(principal.id()).orElse(null);
        if (user == null || user.getMfaSecret() == null) {
            throw ApiException.badRequest("MFA setup not started");
        }
        if (user.isMfaEnabled()) {
            throw ApiException.badRequest("MFA already enabled");
        }
        requireValidTotp(user, code);

        List<String> codes = BackupCodes.generate();
        user.setMfaBackupCodes(codes.stream().map(BackupCodes::hash).toList());
        user.setMfaEnabled(true);
        user.setMfaConfirmedAt(Times.now());
        users.save(user);
        securityEvents.record(user.getId(), user.getOrganizationId(), SecurityEvent.MFA_ENABLED, request);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", true);
        body.put("backupCodes", codes);
        return body;
    }

    public Map<String, Object> disable(AuthUser principal, String password, String code, HttpServletRequest request) {
        User user = requireMfaEnabled(principal);
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw ApiException.unauthorized("Invalid credentials");
        }
        requireValidTotp(user, code);

        user.setMfaEnabled(false);
        user.setMfaSecret(null);
        user.setMfaBackupCodes(new ArrayList<>());
        user.setMfaConfirmedAt(null);
        users.save(user);
        sessions.revokeAllForUser(user.getId(), principal.sessionId());
        securityEvents.record(user.getId(), user.getOrganizationId(), SecurityEvent.MFA_DISABLED, request);
        return Map.of("enabled", false);
    }

    public Map<String, Object> regenerateBackupCodes(AuthUser principal, String code, HttpServletRequest request) {
        User user = requireMfaEnabled(principal);
        requireValidTotp(user, code);

        List<String> codes = BackupCodes.generate();
        user.setMfaBackupCodes(codes.stream().map(BackupCodes::hash).toList());
        users.save(user);
        securityEvents.record(user.getId(), user.getOrganizationId(), SecurityEvent.BACKUP_CODES_REGENERATED, request);
        return Map.of("backupCodes", codes);
    }

    private User requireMfaEnabled(AuthUser principal) {
        User user = users.findById(principal.id()).orElse(null);
        if (user == null || !user.isMfaEnabled()) {
            throw ApiException.badRequest("MFA is not enabled");
        }
        return user;
    }

    private void requireValidTotp(User user, String code) {
        if (!totp.verify(mfaCrypto.decrypt(user.getMfaSecret()), code)) {
            throw ApiException.unauthorized("Invalid code");
        }
    }
}
