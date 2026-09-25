package com.uptimemonitor.support;

import com.uptimemonitor.domain.Check;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.domain.User;
import com.uptimemonitor.repository.CheckRepository;
import com.uptimemonitor.repository.MonitorRepository;
import com.uptimemonitor.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Direct-to-database test data (bypasses API validation and the SSRF guard). */
@Component
public class Fixtures {

    private final UserRepository users;
    private final MonitorRepository monitors;
    private final CheckRepository checks;
    private final PasswordEncoder passwordEncoder;

    public Fixtures(UserRepository users, MonitorRepository monitors, CheckRepository checks,
                    PasswordEncoder passwordEncoder) {
        this.users = users;
        this.monitors = monitors;
        this.checks = checks;
        this.passwordEncoder = passwordEncoder;
    }

    /** Adds a member with the given role to an org and returns a fresh access token for it. */
    public String memberToken(TestApi api, String organizationId, String role) throws Exception {
        String email = role + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        User u = new User();
        u.setEmail(email);
        u.setName(role + " user");
        u.setRole(role);
        u.setOrganizationId(UUID.fromString(organizationId));
        u.setIsVerified(true);
        u.setPassword(passwordEncoder.encode(TestApi.STRONG_PASSWORD));
        users.save(u);
        TestApi.Response login = api.post("/api/auth/login", Map.of("email", email, "password", TestApi.STRONG_PASSWORD));
        return login.body().get("accessToken").asString();
    }

    public Monitor monitor(String organizationId, String url) {
        Monitor m = new Monitor();
        m.setName("fixture " + UUID.randomUUID().toString().substring(0, 6));
        m.setUrl(url);
        m.setOrganizationId(UUID.fromString(organizationId));
        m.setTimeoutMs(3000);
        return monitors.save(m);
    }

    public Check check(UUID monitorId, boolean success, Integer responseTimeMs, Instant at) {
        Check c = new Check();
        c.setMonitorId(monitorId);
        c.setIsSuccess(success);
        c.setStatusCode(success ? 200 : 500);
        c.setResponseTimeMs(responseTimeMs);
        c.setCheckedAt(at);
        return checks.save(c);
    }
}
