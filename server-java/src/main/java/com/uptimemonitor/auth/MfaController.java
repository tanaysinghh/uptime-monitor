package com.uptimemonitor.auth;

import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.ratelimit.Limiter;
import com.uptimemonitor.ratelimit.RateLimited;
import com.uptimemonitor.security.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** /api/auth/mfa/* for the signed-in user (the login challenge lives in AuthController). */
@RestController
@RequestMapping("/api/auth/mfa")
public class MfaController {

    private final MfaService mfa;

    public MfaController(MfaService mfa) {
        this.mfa = mfa;
    }

    @PostMapping("/setup")
    @RateLimited(Limiter.MFA)
    Map<String, Object> setup(@AuthenticationPrincipal AuthUser user) {
        return mfa.setup(user);
    }

    @PostMapping("/verify")
    @RateLimited(Limiter.MFA)
    Map<String, Object> verify(@AuthenticationPrincipal AuthUser user,
                               @RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        String code = v.string("code", 6, 10, false, null);
        v.validate();
        return mfa.verify(user, code, request);
    }

    @PostMapping("/disable")
    @RateLimited(Limiter.MFA)
    Map<String, Object> disable(@AuthenticationPrincipal AuthUser user,
                                @RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        String password = v.nonEmptyString("password");
        String code = v.string("code", 6, 10, false, null);
        v.validate();
        return mfa.disable(user, password, code, request);
    }

    @PostMapping("/backup-codes/regenerate")
    @RateLimited(Limiter.MFA)
    Map<String, Object> regenerate(@AuthenticationPrincipal AuthUser user,
                                   @RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        String code = v.string("code", 6, 10, false, null);
        v.validate();
        return mfa.regenerateBackupCodes(user, code, request);
    }
}
