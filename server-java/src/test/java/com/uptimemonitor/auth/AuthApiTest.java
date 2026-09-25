package com.uptimemonitor.auth;

import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.TestApi;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.util.Map;
import java.util.UUID;

import static com.uptimemonitor.support.TestApi.STRONG_PASSWORD;
import static org.assertj.core.api.Assertions.assertThat;

/** Port of server/tests/auth.test.js against the real database. */
class AuthApiTest extends ApiTestBase {

    private static String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    void registerCreatesUserOrgAndSession() throws Exception {
        String s = unique();
        TestApi.Response r = api.post("/api/auth/register", Map.of(
                "email", "Reg." + s + "@Example.com", "password", STRONG_PASSWORD,
                "name", "  Ada " + s + "  ", "orgName", "Acme Corp " + s + "!"));

        assertThat(r.status()).isEqualTo(201);
        JsonNode user = r.body().get("user");
        assertThat(user.get("email").asString()).isEqualTo("reg." + s + "@example.com");
        assertThat(user.get("name").asString()).isEqualTo("Ada " + s);
        assertThat(user.get("role").asString()).isEqualTo("admin");
        assertThat(user.get("mfaEnabled").asBoolean()).isFalse();
        assertThat(user.get("organization").get("slug").asString()).isEqualTo("acme-corp-" + s);
        assertThat(user.get("organization").get("brandColor").asString()).isEqualTo("#22c55e");
        assertThat(user.has("password")).isFalse();
        assertThat(r.body().get("accessToken").asString()).isNotBlank();
        assertThat(r.body().get("refreshToken").asString()).isNotBlank();
    }

    @Test
    void registerRejectsDuplicateEmail() throws Exception {
        TestApi.Registered existing = api.register();
        TestApi.Response r = api.post("/api/auth/register", Map.of(
                "email", existing.email(), "password", STRONG_PASSWORD, "name", "X", "orgName", "Other " + unique()));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.error()).isEqualTo("Email already registered");
    }

    @Test
    void registerRejectsTakenOrganizationSlug() throws Exception {
        String org = "Shared Org " + unique();
        api.post("/api/auth/register", Map.of("email", "a" + unique() + "@example.com",
                "password", STRONG_PASSWORD, "name", "A", "orgName", org));
        TestApi.Response r = api.post("/api/auth/register", Map.of("email", "b" + unique() + "@example.com",
                "password", STRONG_PASSWORD, "name", "B", "orgName", org));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.error()).isEqualTo("Organization name already taken");
    }

    @Test
    void registerRejectsWeakPasswordWithScore() throws Exception {
        TestApi.Response r = api.post("/api/auth/register", Map.of(
                "email", "weak" + unique() + "@example.com", "password", "password12345",
                "name", "W", "orgName", "Weak " + unique()));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.body().get("passwordScore").asInt()).isLessThan(2);
        assertThat(r.error()).isNotBlank();
    }

    @Test
    void registerValidationErrorsUseExpressValidatorShape() throws Exception {
        TestApi.Response r = api.post("/api/auth/register", Map.of("email", "nope", "password", "short"));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.error()).isEqualTo("Validation failed");
        assertThat(r.body().get("details").findValuesAsString("field"))
                .containsExactly("email", "password", "name", "orgName");
        assertThat(r.body().get("details").get(0).get("message").asString()).isEqualTo("Valid email required");
    }

    @Test
    void loginSucceedsWithNormalizedEmail() throws Exception {
        TestApi.Registered reg = api.register();
        TestApi.Response r = api.post("/api/auth/login",
                Map.of("email", reg.email().toUpperCase(), "password", STRONG_PASSWORD));
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("user").get("id").asString()).isEqualTo(reg.userId());
        assertThat(r.body().get("user").get("organization").get("slug").asString()).isEqualTo(reg.slug());
    }

    @Test
    void loginFailuresAreGeneric() throws Exception {
        TestApi.Registered reg = api.register();
        TestApi.Response wrongPw = api.post("/api/auth/login", Map.of("email", reg.email(), "password", "wrongpasswordXX"));
        TestApi.Response noUser = api.post("/api/auth/login",
                Map.of("email", "ghost" + unique() + "@example.com", "password", "whatever1"));
        assertThat(wrongPw.status()).isEqualTo(401);
        assertThat(noUser.status()).isEqualTo(401);
        assertThat(wrongPw.error()).isEqualTo("Invalid credentials").isEqualTo(noUser.error());
    }

    @Test
    void meReturnsUserWithOrganizationAndNoSecrets() throws Exception {
        TestApi.Registered reg = api.register();
        TestApi.Response r = api.get("/api/auth/me", reg.accessToken());
        assertThat(r.status()).isEqualTo(200);
        JsonNode user = r.body().get("user");
        assertThat(user.get("id").asString()).isEqualTo(reg.userId());
        assertThat(user.get("Organization").get("slug").asString()).isEqualTo(reg.slug());
        assertThat(user.get("organization").get("slug").asString()).isEqualTo(reg.slug());
        assertThat(user.get("isVerified").asBoolean()).isTrue();
        assertThat(user.get("createdAt").asString()).matches("\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d\\.\\d{3}Z");
        assertThat(user.has("password")).isFalse();
        assertThat(user.has("mfaSecret")).isFalse();
        assertThat(user.has("mfaBackupCodes")).isFalse();
    }

    @Test
    void protectedRoutesReportWhyAuthenticationFailed() throws Exception {
        assertThat(api.get("/api/auth/me").error()).isEqualTo("No token provided");
        TestApi.Response invalid = api.get("/api/auth/me", "garbage");
        assertThat(invalid.status()).isEqualTo(401);
        assertThat(invalid.error()).isEqualTo("Invalid token");
    }

    @Test
    void refreshRotatesTokenAndRejectsReplay() throws Exception {
        TestApi.Registered reg = api.register();
        TestApi.Response first = api.post("/api/auth/refresh-token", Map.of("refreshToken", reg.refreshToken()));
        assertThat(first.status()).isEqualTo(200);
        String rotated = first.body().get("refreshToken").asString();
        assertThat(rotated).isNotEqualTo(reg.refreshToken());
        assertThat(api.get("/api/auth/me", first.body().get("accessToken").asString()).status()).isEqualTo(200);

        TestApi.Response replay = api.post("/api/auth/refresh-token", Map.of("refreshToken", reg.refreshToken()));
        assertThat(replay.status()).isEqualTo(401);
        assertThat(replay.error()).isEqualTo("Session revoked or expired");
        assertThat(api.post("/api/auth/refresh-token", Map.of("refreshToken", rotated)).status()).isEqualTo(200);
    }

    @Test
    void refreshRejectsInvalidAndMissingTokens() throws Exception {
        TestApi.Response invalid = api.post("/api/auth/refresh-token", Map.of("refreshToken", "bogus"));
        assertThat(invalid.status()).isEqualTo(401);
        assertThat(invalid.error()).isEqualTo("Invalid refresh token");
        TestApi.Response accessAsRefresh = api.post("/api/auth/refresh-token",
                Map.of("refreshToken", api.register().accessToken()));
        assertThat(accessAsRefresh.status()).isEqualTo(401);
        assertThat(api.post("/api/auth/refresh-token", Map.of()).status()).isEqualTo(400);
    }
}
