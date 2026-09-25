package com.uptimemonitor.auth;

import com.uptimemonitor.domain.SecurityEvent;
import com.uptimemonitor.domain.User;
import com.uptimemonitor.repository.SecurityEventRepository;
import com.uptimemonitor.repository.UserRepository;
import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.TestApi;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.code.HashingAlgorithm;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static com.uptimemonitor.support.TestApi.STRONG_PASSWORD;
import static org.assertj.core.api.Assertions.assertThat;

/** MFA enrollment lifecycle through the API: setup -> verify -> login challenge -> disable. */
class MfaEnrollmentTest extends ApiTestBase {

    @Autowired
    UserRepository users;
    @Autowired
    SecurityEventRepository events;

    private TestApi.Registered reg;

    @BeforeEach
    void register() throws Exception {
        reg = api.register();
    }

    private static String totp(String secret) throws Exception {
        return new DefaultCodeGenerator(HashingAlgorithm.SHA1, 6).generate(secret, Instant.now().getEpochSecond() / 30);
    }

    private static String wrongCode(String secret) throws Exception {
        return totp(secret).equals("000000") ? "111111" : "000000";
    }

    /** setup + verify; returns [secret, backupCodes...] */
    private JsonNode enroll() throws Exception {
        TestApi.Response setup = api.post("/api/auth/mfa/setup", null, reg.accessToken());
        String secret = setup.body().get("secret").asString();
        TestApi.Response verify = api.post("/api/auth/mfa/verify", Map.of("code", totp(secret)), reg.accessToken());
        assertThat(verify.status()).isEqualTo(200);
        return mapper.createObjectNode().put("secret", secret).set("codes", verify.body().get("backupCodes"));
    }

    @Test
    void setupReturnsSecretOtpauthUrlAndQrAndStoresTheSecretEncrypted() throws Exception {
        TestApi.Response r = api.post("/api/auth/mfa/setup", null, reg.accessToken());
        assertThat(r.status()).isEqualTo(200);
        String secret = r.body().get("secret").asString();
        assertThat(secret).matches("[A-Z2-7]{32}");
        assertThat(r.body().get("otpauthUrl").asString()).startsWith("otpauth://totp/").contains("secret=" + secret)
                .contains("issuer=UptimeMonitor");
        assertThat(r.body().get("qrDataUrl").asString()).startsWith("data:image/png;base64,");

        User u = users.findById(UUID.fromString(reg.userId())).orElseThrow();
        assertThat(u.isMfaEnabled()).isFalse();
        assertThat(u.getMfaSecret()).isNotNull().isNotEqualTo(secret);
    }

    @Test
    void verifyEnablesMfaReturnsTenBackupCodesAndRecordsEvent() throws Exception {
        JsonNode enrolled = enroll();
        assertThat(enrolled.get("codes").size()).isEqualTo(10);
        User u = users.findById(UUID.fromString(reg.userId())).orElseThrow();
        assertThat(u.isMfaEnabled()).isTrue();
        assertThat(u.getMfaConfirmedAt()).isNotNull();
        assertThat(u.getMfaBackupCodes()).hasSize(10).noneMatch(h -> h.contains("-"));
        assertThat(events.findByUserIdAndEventType(u.getId(), SecurityEvent.MFA_ENABLED)).hasSize(1);
        assertThat(api.get("/api/auth/me", reg.accessToken()).body().get("user").get("mfaEnabled").asBoolean()).isTrue();
    }

    @Test
    void verifyErrors() throws Exception {
        assertThat(api.post("/api/auth/mfa/verify", Map.of("code", "123456"), reg.accessToken()).error())
                .isEqualTo("MFA setup not started");
        String secret = api.post("/api/auth/mfa/setup", null, reg.accessToken()).body().get("secret").asString();
        TestApi.Response wrong = api.post("/api/auth/mfa/verify", Map.of("code", wrongCode(secret)), reg.accessToken());
        assertThat(wrong.status()).isEqualTo(401);
        assertThat(wrong.error()).isEqualTo("Invalid code");
        assertThat(api.post("/api/auth/mfa/verify", Map.of("code", "12"), reg.accessToken()).status()).isEqualTo(400);
    }

    @Test
    void cannotSetupOrVerifyTwice() throws Exception {
        String secret = enroll().get("secret").asString();
        assertThat(api.post("/api/auth/mfa/setup", null, reg.accessToken()).error())
                .isEqualTo("MFA is already enabled. Disable it first to re-enroll.");
        assertThat(api.post("/api/auth/mfa/verify", Map.of("code", totp(secret)), reg.accessToken()).error())
                .isEqualTo("MFA already enabled");
    }

    @Test
    void enrolledUserMustPassTheChallengeAtLogin() throws Exception {
        String secret = enroll().get("secret").asString();
        TestApi.Response login = api.post("/api/auth/login", Map.of("email", reg.email(), "password", STRONG_PASSWORD));
        assertThat(login.body().get("requiresMfa").asBoolean()).isTrue();
        TestApi.Response done = api.post("/api/auth/mfa/challenge", Map.of(
                "mfaChallengeToken", login.body().get("mfaChallengeToken").asString(), "code", totp(secret)));
        assertThat(done.status()).isEqualTo(200);
    }

    @Test
    void disableRequiresPasswordAndCodeThenSignsOutOtherSessions() throws Exception {
        String secret = enroll().get("secret").asString();
        // a second device, signed in through the MFA challenge
        TestApi.Response login = api.post("/api/auth/login", Map.of("email", reg.email(), "password", STRONG_PASSWORD));
        String otherDevice = api.post("/api/auth/mfa/challenge", Map.of(
                        "mfaChallengeToken", login.body().get("mfaChallengeToken").asString(), "code", totp(secret)))
                .body().get("accessToken").asString();

        assertThat(api.post("/api/auth/mfa/disable", Map.of("password", "wrong-password", "code", totp(secret)),
                reg.accessToken()).error()).isEqualTo("Invalid credentials");
        assertThat(api.post("/api/auth/mfa/disable", Map.of("password", STRONG_PASSWORD, "code", wrongCode(secret)),
                reg.accessToken()).error()).isEqualTo("Invalid code");

        TestApi.Response disabled = api.post("/api/auth/mfa/disable",
                Map.of("password", STRONG_PASSWORD, "code", totp(secret)), reg.accessToken());
        assertThat(disabled.status()).isEqualTo(200);
        assertThat(disabled.body().get("enabled").asBoolean()).isFalse();

        User u = users.findById(UUID.fromString(reg.userId())).orElseThrow();
        assertThat(u.isMfaEnabled()).isFalse();
        assertThat(u.getMfaSecret()).isNull();
        assertThat(u.getMfaBackupCodes()).isEmpty();
        assertThat(api.get("/api/auth/me", reg.accessToken()).status()).isEqualTo(200);
        assertThat(api.get("/api/auth/me", otherDevice).error()).isEqualTo("Session revoked");
        assertThat(api.post("/api/auth/mfa/disable", Map.of("password", STRONG_PASSWORD, "code", "123456"),
                reg.accessToken()).error()).isEqualTo("MFA is not enabled");
    }

    @Test
    void regenerateBackupCodesInvalidatesTheOldOnes() throws Exception {
        JsonNode enrolled = enroll();
        String secret = enrolled.get("secret").asString();
        String oldCode = enrolled.get("codes").get(0).asString();

        TestApi.Response r = api.post("/api/auth/mfa/backup-codes/regenerate", Map.of("code", totp(secret)),
                reg.accessToken());
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("backupCodes").size()).isEqualTo(10);
        assertThat(events.findByUserIdAndEventType(UUID.fromString(reg.userId()),
                SecurityEvent.BACKUP_CODES_REGENERATED)).hasSize(1);

        TestApi.Response login = api.post("/api/auth/login", Map.of("email", reg.email(), "password", STRONG_PASSWORD));
        TestApi.Response withOld = api.post("/api/auth/mfa/challenge", Map.of(
                "mfaChallengeToken", login.body().get("mfaChallengeToken").asString(), "code", oldCode));
        assertThat(withOld.status()).isEqualTo(401);
    }

    @Test
    void mfaEndpointsRequireAuthentication() throws Exception {
        assertThat(api.post("/api/auth/mfa/setup", null).status()).isEqualTo(401);
        assertThat(api.post("/api/auth/mfa/verify", Map.of("code", "123456")).status()).isEqualTo(401);
    }
}
