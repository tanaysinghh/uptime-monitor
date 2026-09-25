package com.uptimemonitor.auth;

import com.uptimemonitor.domain.SecurityEvent;
import com.uptimemonitor.domain.User;
import com.uptimemonitor.repository.SecurityEventRepository;
import com.uptimemonitor.repository.SessionRepository;
import com.uptimemonitor.repository.UserRepository;
import com.uptimemonitor.security.BackupCodes;
import com.uptimemonitor.security.MfaCrypto;
import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.TestApi;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.code.HashingAlgorithm;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.uptimemonitor.support.TestApi.STRONG_PASSWORD;
import static org.assertj.core.api.Assertions.assertThat;

/** Port of server/tests/authSecurity.test.js: lockout, MFA challenge flow, session revocation. */
class AuthSecurityTest extends ApiTestBase {

    @Autowired
    UserRepository users;
    @Autowired
    SessionRepository sessions;
    @Autowired
    SecurityEventRepository events;
    @Autowired
    MfaCrypto mfaCrypto;

    private TestApi.Response login(String email, String password) throws Exception {
        return api.post("/api/auth/login", Map.of("email", email, "password", password));
    }

    // ---- account lockout -----------------------------------------------------------

    @Test
    void fiveFailedLoginsLockTheAccountAndCorrectPasswordStillGetsGeneric401() throws Exception {
        TestApi.Registered reg = api.register();
        for (int i = 0; i < 5; i++) {
            TestApi.Response r = login(reg.email(), "wrongpasswordXX");
            assertThat(r.status()).isEqualTo(401);
            assertThat(r.error()).isEqualTo("Invalid credentials");
        }
        TestApi.Response locked = login(reg.email(), STRONG_PASSWORD);
        assertThat(locked.status()).isEqualTo(401);
        assertThat(locked.error()).isEqualTo("Invalid credentials");
    }

    @Test
    void successfulLoginResetsTheFailedCounter() throws Exception {
        TestApi.Registered reg = api.register();
        for (int i = 0; i < 3; i++) {
            login(reg.email(), "wrongpasswordXX");
        }
        assertThat(login(reg.email(), STRONG_PASSWORD).status()).isEqualTo(200);
        User u = users.findById(UUID.fromString(reg.userId())).orElseThrow();
        assertThat(u.getFailedLoginAttempts()).isZero();
        assertThat(u.getLockedUntil()).isNull();
    }

    @Test
    void accountLockedEventIsRecordedOnceOnTheFifthFailure() throws Exception {
        TestApi.Registered reg = api.register();
        for (int i = 0; i < 5; i++) {
            login(reg.email(), "wrongpasswordXX");
        }
        UUID userId = UUID.fromString(reg.userId());
        assertThat(events.findByUserIdAndEventType(userId, SecurityEvent.ACCOUNT_LOCKED)).hasSize(1);
        assertThat(events.findByUserIdAndEventType(userId, SecurityEvent.LOGIN_FAILURE)).hasSize(5);
    }

    @Test
    void lockoutExpires() throws Exception {
        TestApi.Registered reg = api.register();
        for (int i = 0; i < 5; i++) {
            login(reg.email(), "wrongpasswordXX");
        }
        User u = users.findById(UUID.fromString(reg.userId())).orElseThrow();
        u.setLockedUntil(Instant.now().minusSeconds(1));
        users.save(u);
        assertThat(login(reg.email(), STRONG_PASSWORD).status()).isEqualTo(200);
    }

    // ---- MFA challenge flow --------------------------------------------------------

    record MfaUser(TestApi.Registered reg, String secret, List<String> backupCodes) {
    }

    private MfaUser mfaUser() throws Exception {
        TestApi.Registered reg = api.register();
        String secret = new DefaultSecretGenerator(32).generate();
        List<String> codes = BackupCodes.generate();
        User u = users.findById(UUID.fromString(reg.userId())).orElseThrow();
        u.setMfaEnabled(true);
        u.setMfaSecret(mfaCrypto.encrypt(secret));
        u.setMfaBackupCodes(codes.stream().map(BackupCodes::hash).toList());
        users.save(u);
        return new MfaUser(reg, secret, codes);
    }

    private static String currentTotp(String secret) throws Exception {
        return new DefaultCodeGenerator(HashingAlgorithm.SHA1, 6).generate(secret, Instant.now().getEpochSecond() / 30);
    }

    @Test
    void loginReturnsAChallengeTokenInsteadOfTokensWhenMfaEnabled() throws Exception {
        MfaUser m = mfaUser();
        TestApi.Response r = login(m.reg().email(), STRONG_PASSWORD);
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("requiresMfa").asBoolean()).isTrue();
        assertThat(r.body().get("mfaChallengeToken").asString()).isNotBlank();
        assertThat(r.body().has("accessToken")).isFalse();
    }

    @Test
    void validTotpCompletesTheChallenge() throws Exception {
        MfaUser m = mfaUser();
        String token = login(m.reg().email(), STRONG_PASSWORD).body().get("mfaChallengeToken").asString();
        TestApi.Response r = api.post("/api/auth/mfa/challenge",
                Map.of("mfaChallengeToken", token, "code", currentTotp(m.secret())));
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("accessToken").asString()).isNotBlank();
        assertThat(r.body().get("refreshToken").asString()).isNotBlank();
        assertThat(r.body().get("user").get("mfaEnabled").asBoolean()).isTrue();
    }

    @Test
    void wrongTotpReturns401AndRecordsFailure() throws Exception {
        MfaUser m = mfaUser();
        String token = login(m.reg().email(), STRONG_PASSWORD).body().get("mfaChallengeToken").asString();
        String wrong = currentTotp(m.secret()).equals("000000") ? "111111" : "000000";
        TestApi.Response r = api.post("/api/auth/mfa/challenge", Map.of("mfaChallengeToken", token, "code", wrong));
        assertThat(r.status()).isEqualTo(401);
        assertThat(r.error()).isEqualTo("Invalid code");
        assertThat(events.findByUserIdAndEventType(UUID.fromString(m.reg().userId()),
                SecurityEvent.MFA_CHALLENGE_FAILURE)).hasSize(1);
    }

    @Test
    void backupCodeWorksIsConsumedAndRecorded() throws Exception {
        MfaUser m = mfaUser();
        String token = login(m.reg().email(), STRONG_PASSWORD).body().get("mfaChallengeToken").asString();
        TestApi.Response r = api.post("/api/auth/mfa/challenge",
                Map.of("mfaChallengeToken", token, "code", m.backupCodes().get(2)));
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("accessToken").asString()).isNotBlank();
        UUID userId = UUID.fromString(m.reg().userId());
        assertThat(events.findByUserIdAndEventType(userId, SecurityEvent.BACKUP_CODE_USED)).hasSize(1);
        assertThat(users.findById(userId).orElseThrow().getMfaBackupCodes()).hasSize(9);
    }

    @Test
    void challengeTokenIsSingleUse() throws Exception {
        MfaUser m = mfaUser();
        String token = login(m.reg().email(), STRONG_PASSWORD).body().get("mfaChallengeToken").asString();
        String code = currentTotp(m.secret());
        assertThat(api.post("/api/auth/mfa/challenge", Map.of("mfaChallengeToken", token, "code", code)).status())
                .isEqualTo(200);
        assertThat(api.post("/api/auth/mfa/challenge", Map.of("mfaChallengeToken", token, "code", code)).status())
                .isEqualTo(401);
    }

    @Test
    void challengeTokenCannotBeUsedAsABearerToken() throws Exception {
        MfaUser m = mfaUser();
        String token = login(m.reg().email(), STRONG_PASSWORD).body().get("mfaChallengeToken").asString();
        TestApi.Response r = api.get("/api/auth/me", token);
        assertThat(r.status()).isEqualTo(401);
        assertThat(r.error()).isEqualTo("Invalid token");
    }

    // ---- session revocation ----------------------------------------------------------

    @Test
    void revokedSessionsRefreshTokenAndAccessTokenAreRejected() throws Exception {
        TestApi.Registered reg = api.register();
        sessions.revokeAllForUser(UUID.fromString(reg.userId()), Instant.now());
        assertThat(api.post("/api/auth/refresh-token", Map.of("refreshToken", reg.refreshToken())).status())
                .isEqualTo(401);
        TestApi.Response me = api.get("/api/auth/me", reg.accessToken());
        assertThat(me.status()).isEqualTo(401);
        assertThat(me.error()).isEqualTo("Session revoked");
    }

    @Test
    void tokensIssuedBeforeAPasswordChangeAreRejected() throws Exception {
        TestApi.Registered reg = api.register();
        User u = users.findById(UUID.fromString(reg.userId())).orElseThrow();
        u.setPasswordChangedAt(Instant.now().plusSeconds(5));
        users.save(u);
        TestApi.Response me = api.get("/api/auth/me", reg.accessToken());
        assertThat(me.status()).isEqualTo(401);
        assertThat(me.error()).isEqualTo("Token invalidated by password change");
    }
}
