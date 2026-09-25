package com.uptimemonitor.team;

import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.Fixtures;
import com.uptimemonitor.support.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.uptimemonitor.support.TestApi.STRONG_PASSWORD;
import static org.assertj.core.api.Assertions.assertThat;

class TeamAndApiKeyApiTest extends ApiTestBase {

    @Autowired
    Fixtures fixtures;

    private TestApi.Registered admin;

    @BeforeEach
    void registerAdmin() throws Exception {
        admin = api.register();
    }

    private String newEmail() {
        return "member-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    private TestApi.Response invite(String token, String email, String role) throws Exception {
        return api.post("/api/team/members",
                Map.of("email", email, "name", "Member", "password", STRONG_PASSWORD, "role", role), token);
    }

    // ---- team ------------------------------------------------------------------------

    @Test
    void membersListNeverExposesPasswordOrMfaSecrets() throws Exception {
        JsonNode members = api.get("/api/team/members", admin.accessToken()).body().get("members");
        assertThat(members.size()).isEqualTo(1);
        JsonNode me = members.get(0);
        assertThat(me.get("email").asString()).isEqualTo(admin.email());
        assertThat(me.has("password")).isFalse();
        assertThat(me.has("mfaSecret")).isFalse();
        assertThat(me.has("mfaBackupCodes")).isFalse();
        assertThat(me.propertyNames()).containsExactly("id", "email", "name", "role", "isVerified",
                "organizationId", "mfaEnabled", "createdAt", "updatedAt");
    }

    @Test
    void adminInvitesMemberWhoCanLogIn() throws Exception {
        String email = newEmail();
        TestApi.Response r = invite(admin.accessToken(), email, "editor");
        assertThat(r.status()).isEqualTo(201);
        assertThat(r.body().get("member").get("role").asString()).isEqualTo("editor");
        assertThat(r.body().get("member").propertyNames()).containsExactly("id", "email", "name", "role", "createdAt");
        TestApi.Response login = api.post("/api/auth/login", Map.of("email", email, "password", STRONG_PASSWORD));
        assertThat(login.body().get("user").get("organizationId").asString()).isEqualTo(admin.organizationId());

        TestApi.Response defaultRole = api.post("/api/team/members",
                Map.of("email", newEmail(), "name", "Viewer", "password", STRONG_PASSWORD), admin.accessToken());
        assertThat(defaultRole.body().get("member").get("role").asString()).isEqualTo("viewer");
    }

    @Test
    void inviteRules() throws Exception {
        String editor = fixtures.memberToken(api, admin.organizationId(), "editor");
        TestApi.Response notAdmin = invite(editor, newEmail(), "viewer");
        assertThat(notAdmin.status()).isEqualTo(403);
        assertThat(notAdmin.error()).isEqualTo("Only admins can invite members");

        assertThat(invite(admin.accessToken(), admin.email(), "viewer").error()).isEqualTo("Email already registered");
        TestApi.Response weak = api.post("/api/team/members",
                Map.of("email", newEmail(), "name", "W", "password", "password1"), admin.accessToken());
        assertThat(weak.status()).isEqualTo(400);
        assertThat(weak.body().has("passwordScore")).isTrue();
        assertThat(invite(admin.accessToken(), newEmail(), "owner").error()).isEqualTo("Validation failed");
    }

    @Test
    void roleChangesAndRemovalAreAdminOnlyAndAudited() throws Exception {
        String memberId = invite(admin.accessToken(), newEmail(), "viewer").body().get("member").get("id").asString();

        TestApi.Response promoted = api.put("/api/team/members/" + memberId + "/role", Map.of("role", "editor"),
                admin.accessToken());
        assertThat(promoted.status()).isEqualTo(200);
        assertThat(promoted.body().get("member").get("role").asString()).isEqualTo("editor");

        assertThat(api.put("/api/team/members/" + admin.userId() + "/role", Map.of("role", "viewer"),
                admin.accessToken()).error()).isEqualTo("Cannot change your own role");
        assertThat(api.delete("/api/team/members/" + admin.userId(), admin.accessToken()).error())
                .isEqualTo("Cannot remove yourself");

        String editor = fixtures.memberToken(api, admin.organizationId(), "editor");
        assertThat(api.delete("/api/team/members/" + memberId, editor).error()).isEqualTo("Only admins can remove members");
        assertThat(api.put("/api/team/members/" + memberId + "/role", Map.of("role", "admin"), editor).error())
                .isEqualTo("Only admins can change roles");

        TestApi.Registered otherOrg = api.register();
        assertThat(api.delete("/api/team/members/" + otherOrg.userId(), admin.accessToken()).error())
                .isEqualTo("Member not found");

        TestApi.Response removed = api.delete("/api/team/members/" + memberId, admin.accessToken());
        assertThat(removed.body().get("message").asString()).isEqualTo("Member removed");

        JsonNode logs = api.get("/api/team/audit-log", admin.accessToken()).body().get("logs");
        assertThat(logs.findValuesAsString("action")).containsExactly("remove_member", "update_role", "invite_member");
        assertThat(logs.get(0).get("User").get("email").asString()).isEqualTo(admin.email());
        assertThat(logs.get(1).get("details").get("newRole").asString()).isEqualTo("editor");
    }

    // ---- API keys --------------------------------------------------------------------

    @Test
    void adminCreatesKeyShownOnceAndStoredHashed() throws Exception {
        TestApi.Response r = api.post("/api/api-keys",
                Map.of("name", "ci", "permissions", List.of("read", "write"), "expiresAt", "2030-01-01T00:00:00Z"),
                admin.accessToken());
        assertThat(r.status()).isEqualTo(201);
        String key = r.body().get("key").asString();
        assertThat(key).matches("um_[0-9a-f]{64}");
        JsonNode apiKey = r.body().get("apiKey");
        assertThat(apiKey.get("keyPrefix").asString()).isEqualTo(key.substring(0, 10));
        assertThat(apiKey.get("expiresAt").asString()).isEqualTo("2030-01-01T00:00:00.000Z");
        assertThat(apiKey.has("keyHash")).isFalse();

        JsonNode keys = api.get("/api/api-keys", admin.accessToken()).body().get("keys");
        assertThat(keys.size()).isEqualTo(1);
        assertThat(keys.get(0).has("keyHash")).isFalse();
        assertThat(keys.get(0).get("isActive").asBoolean()).isTrue();
        assertThat(keys.get(0).get("permissions").size()).isEqualTo(2);
    }

    @Test
    void keyRulesAndRevocation() throws Exception {
        String editor = fixtures.memberToken(api, admin.organizationId(), "editor");
        assertThat(api.post("/api/api-keys", Map.of("name", "x"), editor).error()).isEqualTo("Only admins can create API keys");
        assertThat(api.post("/api/api-keys", Map.of("name", "x", "expiresAt", "tomorrow"), admin.accessToken()).status())
                .isEqualTo(400);

        String id = api.post("/api/api-keys", Map.of("name", "ops"), admin.accessToken())
                .body().get("apiKey").get("id").asString();
        assertThat(api.put("/api/api-keys/" + id + "/revoke", null, editor).error()).isEqualTo("Only admins can revoke API keys");
        TestApi.Response revoked = api.put("/api/api-keys/" + id + "/revoke", null, admin.accessToken());
        assertThat(revoked.body().get("message").asString()).isEqualTo("API key revoked");
        assertThat(api.get("/api/api-keys", admin.accessToken()).body().get("keys").get(0).get("isActive").asBoolean())
                .isFalse();
        assertThat(api.put("/api/api-keys/" + UUID.randomUUID() + "/revoke", null, admin.accessToken()).status())
                .isEqualTo(404);

        JsonNode logs = api.get("/api/team/audit-log", admin.accessToken()).body().get("logs");
        assertThat(logs.findValuesAsString("action")).containsExactly("revoke_api_key", "create_api_key");
        assertThat(logs.get(1).get("details").get("permissions").get(0).asString()).isEqualTo("read");
    }
}
