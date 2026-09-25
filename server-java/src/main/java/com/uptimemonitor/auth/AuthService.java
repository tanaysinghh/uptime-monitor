package com.uptimemonitor.auth;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.Http;
import com.uptimemonitor.common.Json;
import com.uptimemonitor.common.Times;
import com.uptimemonitor.domain.MfaChallenge;
import com.uptimemonitor.domain.Organization;
import com.uptimemonitor.domain.SecurityEvent;
import com.uptimemonitor.domain.Session;
import com.uptimemonitor.domain.User;
import com.uptimemonitor.repository.MfaChallengeRepository;
import com.uptimemonitor.repository.OrganizationRepository;
import com.uptimemonitor.repository.UserRepository;
import com.uptimemonitor.security.AuthUser;
import com.uptimemonitor.security.BackupCodes;
import com.uptimemonitor.security.JwtService;
import com.uptimemonitor.security.MfaCrypto;
import com.uptimemonitor.security.PasswordPolicy;
import com.uptimemonitor.security.SecurityEventService;
import com.uptimemonitor.security.TotpService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/** Port of controllers/authController.js: register, login + lockout, MFA challenge, refresh. */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    static final int LOCKOUT_THRESHOLD = 5;
    static final Duration LOCKOUT_DURATION = Duration.ofMinutes(15);
    static final Duration MFA_CHALLENGE_TTL = Duration.ofMinutes(5);
    private static final String GENERIC_LOGIN_FAILURE = "Invalid credentials";
    private static final Pattern TOTP_FORMAT = Pattern.compile("^\\d{6,10}$");
    private static final Pattern NON_SLUG = Pattern.compile("[^a-z0-9]+");

    private final UserRepository users;
    private final OrganizationRepository organizations;
    private final MfaChallengeRepository challenges;
    private final SessionService sessionService;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;
    private final SecurityEventService securityEvents;
    private final JwtService jwt;
    private final TotpService totp;
    private final MfaCrypto mfaCrypto;
    private final TransactionTemplate tx;
    private final Json json;
    /** Compared against when the email is unknown, so response time doesn't reveal accounts. */
    private final String dummyHash;

    public AuthService(UserRepository users, OrganizationRepository organizations, MfaChallengeRepository challenges,
                       SessionService sessionService, PasswordEncoder passwordEncoder, PasswordPolicy passwordPolicy,
                       SecurityEventService securityEvents, JwtService jwt, TotpService totp, MfaCrypto mfaCrypto,
                       TransactionTemplate tx, Json json) {
        this.users = users;
        this.organizations = organizations;
        this.challenges = challenges;
        this.sessionService = sessionService;
        this.passwordEncoder = passwordEncoder;
        this.passwordPolicy = passwordPolicy;
        this.securityEvents = securityEvents;
        this.jwt = jwt;
        this.totp = totp;
        this.mfaCrypto = mfaCrypto;
        this.tx = tx;
        this.json = json;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    // ---- register ------------------------------------------------------------------

    public Map<String, Object> register(String email, String password, String name, String orgName,
                                        HttpServletRequest request) {
        requireStrongPassword(password, List.of(email, name, orgName));

        if (users.findByEmail(email).isPresent()) {
            throw ApiException.badRequest("Email already registered");
        }
        String slug = slugify(orgName);
        if (organizations.findBySlug(slug).isPresent()) {
            throw ApiException.badRequest("Organization name already taken");
        }

        record Created(Organization org, User user) {
        }
        Created created = tx.execute(status -> {
            Organization org = new Organization();
            org.setName(orgName);
            org.setSlug(slug);
            organizations.save(org);

            User user = new User();
            user.setEmail(email);
            user.setPassword(passwordEncoder.encode(password));
            user.setName(name);
            user.setOrganizationId(org.getId());
            user.setIsVerified(true);
            users.save(user);
            return new Created(org, user);
        });

        SessionService.Tokens tokens = sessionService.issueSession(created.user(), request);
        return authResponse(created.user(), created.org(), tokens);
    }

    static String slugify(String orgName) {
        String slug = NON_SLUG.matcher(orgName.toLowerCase(Locale.ROOT)).replaceAll("-");
        if (slug.startsWith("-")) {
            slug = slug.substring(1);
        }
        if (slug.endsWith("-")) {
            slug = slug.substring(0, slug.length() - 1);
        }
        return slug;
    }

    // ---- login ---------------------------------------------------------------------

    public Map<String, Object> login(String email, String password, HttpServletRequest request) {
        Optional<User> found = users.findByEmail(email);
        if (found.isEmpty()) {
            passwordEncoder.matches(password, dummyHash);
            throw ApiException.unauthorized(GENERIC_LOGIN_FAILURE);
        }
        User user = found.get();
        Instant now = Times.now();

        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            log.warn("login blocked by lockout userId={} ip={} lockedUntil={}", user.getId(),
                    Http.clientIp(request), user.getLockedUntil());
            throw ApiException.unauthorized(GENERIC_LOGIN_FAILURE);
        }

        if (!passwordEncoder.matches(password, user.getPassword())) {
            user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
            boolean justLocked = user.getFailedLoginAttempts() >= LOCKOUT_THRESHOLD;
            if (justLocked) {
                user.setLockedUntil(now.plus(LOCKOUT_DURATION));
            }
            users.save(user);
            securityEvents.record(user.getId(), user.getOrganizationId(), SecurityEvent.LOGIN_FAILURE, request,
                    Map.of("attempts", user.getFailedLoginAttempts()));
            if (justLocked) {
                securityEvents.record(user.getId(), user.getOrganizationId(), SecurityEvent.ACCOUNT_LOCKED, request,
                        Map.of("lockedUntil", user.getLockedUntil().toString()));
            }
            throw ApiException.unauthorized(GENERIC_LOGIN_FAILURE);
        }

        if (user.getFailedLoginAttempts() > 0 || user.getLockedUntil() != null) {
            user.setFailedLoginAttempts(0);
            user.setLockedUntil(null);
            users.save(user);
        }

        if (user.isMfaEnabled()) {
            MfaChallenge challenge = new MfaChallenge();
            challenge.setUserId(user.getId());
            challenge.setExpiresAt(now.plus(MFA_CHALLENGE_TTL));
            challenge.setIpAddress(truncate(Http.clientIp(request), 45));
            challenges.save(challenge);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("requiresMfa", true);
            body.put("mfaChallengeToken", jwt.generateMfaChallengeToken(user.getId(), challenge.getId()));
            return body;
        }

        securityEvents.record(user.getId(), user.getOrganizationId(), SecurityEvent.LOGIN_SUCCESS, request);
        SessionService.Tokens tokens = sessionService.issueSession(user, request);
        return authResponse(user, organizationOf(user), tokens);
    }

    // ---- MFA challenge (second step of login) --------------------------------------

    public Map<String, Object> completeMfaChallenge(String challengeToken, String code, HttpServletRequest request) {
        JwtService.MfaChallengeClaims claims = jwt.verifyMfaChallengeToken(challengeToken)
                .orElseThrow(() -> ApiException.unauthorized("Invalid or expired MFA challenge"));
        if (claims.challengeId() == null || claims.userId() == null) {
            throw ApiException.unauthorized("Invalid MFA challenge");
        }

        MfaChallenge challenge = challenges.findById(claims.challengeId())
                .filter(c -> c.getUsedAt() == null)
                .filter(c -> !c.getExpiresAt().isBefore(Instant.now()))
                .orElseThrow(() -> ApiException.unauthorized("Invalid or expired MFA challenge"));

        User user = users.findById(claims.userId())
                .filter(u -> u.isMfaEnabled() && u.getMfaSecret() != null)
                .orElseThrow(() -> ApiException.unauthorized("Invalid MFA challenge"));

        String cleaned = code == null ? "" : code.replaceAll("\\s+", "");
        boolean ok = false;
        boolean usedBackupCode = false;

        boolean totpFormat = TOTP_FORMAT.matcher(cleaned).matches();
        if (totpFormat && totp.verify(mfaCrypto.decrypt(user.getMfaSecret()), cleaned)) {
            ok = true;
        } else if (!totpFormat) {
            BackupCodes.ConsumeResult result = BackupCodes.consumeMatching(cleaned, user.getMfaBackupCodes());
            if (result.matched()) {
                ok = true;
                usedBackupCode = true;
                user.setMfaBackupCodes(result.remaining());
                users.save(user);
            }
        }

        if (!ok) {
            securityEvents.record(user.getId(), user.getOrganizationId(), SecurityEvent.MFA_CHALLENGE_FAILURE, request);
            throw ApiException.unauthorized("Invalid code");
        }

        challenge.setUsedAt(Times.now());
        challenges.save(challenge);

        securityEvents.record(user.getId(), user.getOrganizationId(),
                usedBackupCode ? SecurityEvent.BACKUP_CODE_USED : SecurityEvent.MFA_CHALLENGE_SUCCESS, request,
                usedBackupCode ? Map.of("remaining", user.getMfaBackupCodes().size()) : Map.of());

        SessionService.Tokens tokens = sessionService.issueSession(user, request);
        return authResponse(user, organizationOf(user), tokens);
    }

    // ---- refresh -------------------------------------------------------------------

    public Map<String, Object> refresh(String refreshToken, HttpServletRequest request) {
        JwtService.RefreshClaims claims = jwt.verifyRefreshToken(refreshToken)
                .orElseThrow(() -> ApiException.unauthorized("Invalid refresh token"));
        if (claims.sessionId() == null) {
            throw ApiException.unauthorized("Invalid refresh token");
        }
        Session session = sessionService.findActiveSession(claims.sessionId(), refreshToken)
                .orElseThrow(() -> ApiException.unauthorized("Session revoked or expired"));
        User user = (claims.userId() == null ? Optional.<User>empty() : users.findById(claims.userId()))
                .orElseThrow(() -> ApiException.unauthorized("User not found"));

        SessionService.Tokens tokens = sessionService.rotateSession(session, user, request);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("accessToken", tokens.accessToken());
        body.put("refreshToken", tokens.refreshToken());
        return body;
    }

    // ---- me ------------------------------------------------------------------------

    /**
     * The full user (secrets excluded) with its organization embedded as "Organization",
     * like Sequelize's include. It is also exposed as "organization" - the key the login
     * response uses and the dashboard reads - so a page reload no longer loses it.
     */
    public Map<String, Object> me(AuthUser principal) {
        User user = users.findById(principal.id()).orElseThrow(() -> ApiException.notFound("User not found"));
        Map<String, Object> body = json.toMap(user);
        Object org = organizationOf(user);
        body.put("Organization", org);
        body.put("organization", org);
        return body;
    }

    // ---- helpers -------------------------------------------------------------------

    void requireStrongPassword(String password, List<String> userInputs) {
        PasswordPolicy.Result pw = passwordPolicy.evaluate(password, userInputs);
        if (!pw.ok()) {
            throw new ApiException(400, pw.reason(), Map.of("passwordScore", pw.score()));
        }
    }

    Organization organizationOf(User user) {
        return user.getOrganizationId() == null ? null
                : organizations.findById(user.getOrganizationId()).orElse(null);
    }

    Map<String, Object> publicUser(User user, Organization org) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", user.getId());
        m.put("email", user.getEmail());
        m.put("name", user.getName());
        m.put("role", user.getRole());
        m.put("organizationId", user.getOrganizationId());
        m.put("organization", org == null ? null : json.toMap(org));
        m.put("mfaEnabled", user.isMfaEnabled());
        return m;
    }

    private Map<String, Object> authResponse(User user, Organization org, SessionService.Tokens tokens) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("user", publicUser(user, org));
        body.put("accessToken", tokens.accessToken());
        body.put("refreshToken", tokens.refreshToken());
        return body;
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
