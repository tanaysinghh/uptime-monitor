package com.uptimemonitor.auth;

import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.TestApi;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;

import java.util.Map;

import static com.uptimemonitor.support.TestApi.STRONG_PASSWORD;
import static org.assertj.core.api.Assertions.assertThat;

/** Sessions, password change and the security event feed. */
class AccountApiTest extends ApiTestBase {

    private TestApi.Response login(String email, String password) throws Exception {
        return api.post("/api/auth/login", Map.of("email", email, "password", password));
    }

    private String currentSessionId(String accessToken) throws Exception {
        for (JsonNode s : api.get("/api/auth/sessions", accessToken).body().get("sessions")) {
            if (s.get("current").asBoolean()) {
                return s.get("id").asString();
            }
        }
        throw new AssertionError("no current session");
    }

    @Test
    void sessionsListMarksTheCurrentOneAndHidesTokenHashes() throws Exception {
        TestApi.Registered reg = api.register();
        api.exec(MockMvcRequestBuilders.post("/api/auth/login").contentType("application/json")
                .header("User-Agent", "SecondDevice/1.0")
                .content(mapper.writeValueAsString(Map.of("email", reg.email(), "password", STRONG_PASSWORD))));

        JsonNode sessions = api.get("/api/auth/sessions", reg.accessToken()).body().get("sessions");
        assertThat(sessions.size()).isEqualTo(2);
        assertThat(sessions.findValues("current").stream().filter(JsonNode::asBoolean).count()).isEqualTo(1);
        assertThat(sessions.findValuesAsString("userAgent")).contains("SecondDevice/1.0");
        assertThat(sessions.get(0).has("refreshTokenHash")).isFalse();
        assertThat(sessions.get(0).propertyNames())
                .containsExactlyInAnyOrder("id", "userAgent", "ipAddress", "createdAt", "lastUsedAt", "expiresAt", "current");
    }

    @Test
    void revokeASessionOfYourOwn() throws Exception {
        TestApi.Registered reg = api.register();
        String other = login(reg.email(), STRONG_PASSWORD).body().get("accessToken").asString();
        String otherSessionId = currentSessionId(other);

        TestApi.Response r = api.delete("/api/auth/sessions/" + otherSessionId, reg.accessToken());
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("message").asString()).isEqualTo("Session revoked");
        assertThat(api.get("/api/auth/me", other).error()).isEqualTo("Session revoked");
        assertThat(api.delete("/api/auth/sessions/" + otherSessionId, reg.accessToken()).error())
                .isEqualTo("Session not found");
    }

    @Test
    void cannotRevokeSomeoneElsesSession() throws Exception {
        TestApi.Registered victim = api.register();
        String victimSession = api.get("/api/auth/sessions", victim.accessToken()).body().get("sessions").get(0)
                .get("id").asString();
        TestApi.Registered attacker = api.register();
        assertThat(api.delete("/api/auth/sessions/" + victimSession, attacker.accessToken()).status()).isEqualTo(404);
        assertThat(api.get("/api/auth/me", victim.accessToken()).status()).isEqualTo(200);
        assertThat(api.delete("/api/auth/sessions/nope", attacker.accessToken()).status()).isEqualTo(400);
    }

    @Test
    void logoutAllDevicesRevokesEverySessionIncludingTheCurrentOne() throws Exception {
        TestApi.Registered reg = api.register();
        login(reg.email(), STRONG_PASSWORD);
        TestApi.Response r = api.post("/api/auth/logout-all-devices", null, reg.accessToken());
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("revoked").asInt()).isEqualTo(2);
        assertThat(r.body().get("message").asString()).isEqualTo("All sessions revoked");
        assertThat(api.get("/api/auth/me", reg.accessToken()).status()).isEqualTo(401);
        assertThat(api.post("/api/auth/refresh-token", Map.of("refreshToken", reg.refreshToken())).status())
                .isEqualTo(401);
    }

    @Test
    void changePasswordFlow() throws Exception {
        TestApi.Registered reg = api.register();
        String otherDevice = login(reg.email(), STRONG_PASSWORD).body().get("refreshToken").asString();

        TestApi.Response wrong = api.post("/api/auth/password",
                Map.of("currentPassword", "nope-nope", "newPassword", "An0ther-Strong#Passphrase"), reg.accessToken());
        assertThat(wrong.status()).isEqualTo(401);
        assertThat(wrong.error()).isEqualTo("Current password is incorrect");

        TestApi.Response weak = api.post("/api/auth/password",
                Map.of("currentPassword", STRONG_PASSWORD, "newPassword", "password1"), reg.accessToken());
        assertThat(weak.status()).isEqualTo(400);
        assertThat(weak.body().has("passwordScore")).isTrue();

        String newPassword = "An0ther-Strong#Passphrase";
        TestApi.Response ok = api.post("/api/auth/password",
                Map.of("currentPassword", STRONG_PASSWORD, "newPassword", newPassword), reg.accessToken());
        assertThat(ok.status()).isEqualTo(200);
        assertThat(ok.body().get("message").asString()).isEqualTo("Password changed. Other active sessions were signed out.");

        assertThat(api.post("/api/auth/refresh-token", Map.of("refreshToken", otherDevice)).status()).isEqualTo(401);
        assertThat(api.post("/api/auth/refresh-token", Map.of("refreshToken", reg.refreshToken())).status()).isEqualTo(200);
        assertThat(login(reg.email(), STRONG_PASSWORD).status()).isEqualTo(401);
        assertThat(login(reg.email(), newPassword).status()).isEqualTo(200);
    }

    @Test
    void securityEventsFeedIsNewestFirstAndLimited() throws Exception {
        TestApi.Registered reg = api.register();
        login(reg.email(), "wrong-password-1");
        login(reg.email(), STRONG_PASSWORD);

        JsonNode events = api.get("/api/security/events", reg.accessToken()).body().get("events");
        assertThat(events.findValuesAsString("eventType")).containsExactly("login_success", "login_failure");
        assertThat(events.get(1).get("metadata").get("attempts").asInt()).isEqualTo(1);
        assertThat(events.get(0).propertyNames())
                .containsExactlyInAnyOrder("id", "eventType", "ipAddress", "userAgent", "metadata", "createdAt");
        assertThat(api.get("/api/security/events?limit=1", reg.accessToken()).body().get("events").size()).isEqualTo(1);
        assertThat(api.get("/api/security/events?limit=-3", reg.accessToken()).status()).isEqualTo(200);
    }

    @Test
    void parseLimitMatchesNodeSemantics() {
        assertThat(AccountService.parseLimit(null)).isEqualTo(50);
        assertThat(AccountService.parseLimit("abc")).isEqualTo(50);
        assertThat(AccountService.parseLimit("0")).isEqualTo(50);
        assertThat(AccountService.parseLimit("10")).isEqualTo(10);
        assertThat(AccountService.parseLimit("500")).isEqualTo(200);
        assertThat(AccountService.parseLimit("-3")).isEqualTo(1);
    }
}
