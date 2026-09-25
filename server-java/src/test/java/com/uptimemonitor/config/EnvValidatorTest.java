package com.uptimemonitor.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Port of server/tests/env.test.js. */
class EnvValidatorTest {

    private final Map<String, String> env = new HashMap<>();

    @BeforeEach
    void validTestEnv() {
        env.put("NODE_ENV", "test");
        env.put("JWT_SECRET", "test_secret_at_least_32_characters_long_xxx");
        env.put("JWT_REFRESH_SECRET", "test_refresh_secret_at_least_32_chars_diff");
        env.put("JWT_EXPIRES_IN", "15m");
        env.put("JWT_REFRESH_EXPIRES_IN", "7d");
        env.put("CLIENT_URL", "http://localhost:5173");
        env.put("DB_HOST", "localhost");
        env.put("DB_PORT", "5432");
        env.put("DB_NAME", "test");
        env.put("DB_USER", "test");
        env.put("DB_PASSWORD", "test");
        env.put("MFA_ENCRYPTION_KEY", "0".repeat(64));
    }

    @Test
    void passesWithAllRequiredVarsInTestEnv() {
        EnvValidator.Result result = EnvValidator.validate(env::get);
        assertThat(result.nodeEnv()).isEqualTo("test");
        assertThat(result.isProd()).isFalse();
        assertThat(result.port()).isEqualTo(5000);
    }

    @Test
    void failsWhenARequiredVarIsMissing() {
        env.remove("JWT_SECRET");
        assertThatThrownBy(() -> EnvValidator.validate(env::get))
                .isInstanceOf(EnvValidator.EnvValidationException.class)
                .hasMessageContaining("missing required environment variables: JWT_SECRET");
    }

    @Test
    void blankValuesCountAsMissing() {
        env.put("DB_HOST", "   ");
        assertThatThrownBy(() -> EnvValidator.validate(env::get)).hasMessageContaining("DB_HOST");
    }

    @Test
    void productionRejectsShortJwtSecret() {
        env.put("NODE_ENV", "production");
        env.put("JWT_SECRET", "short");
        assertThatThrownBy(() -> EnvValidator.validate(env::get)).hasMessageContaining("at least 32");
    }

    @Test
    void productionRejectsPlaceholderSecret() {
        env.put("NODE_ENV", "production");
        env.put("JWT_SECRET", "your_super_secret_key_change_this_in_production");
        env.put("JWT_REFRESH_SECRET", "another_reasonably_long_random_string_here_ok_ok");
        assertThatThrownBy(() -> EnvValidator.validate(env::get)).hasMessageContaining("placeholder");
    }

    @Test
    void productionRejectsDuplicateJwtSecrets() {
        env.put("NODE_ENV", "production");
        String same = "a_reasonably_long_random_secret_that_is_over_32_chars";
        env.put("JWT_SECRET", same);
        env.put("JWT_REFRESH_SECRET", same);
        assertThatThrownBy(() -> EnvValidator.validate(env::get)).hasMessageContaining("must be different");
    }

    @Test
    void productionRejectsMalformedMfaKey() {
        env.put("NODE_ENV", "production");
        env.put("JWT_SECRET", "a_reasonably_long_random_secret_that_is_over_32_chars");
        env.put("JWT_REFRESH_SECRET", "a_different_long_random_secret_that_is_over_32_chars");
        env.put("MFA_ENCRYPTION_KEY", "abc");
        assertThatThrownBy(() -> EnvValidator.validate(env::get)).hasMessageContaining("MFA_ENCRYPTION_KEY");
    }

    @Test
    void anyEnvironmentRejectsJwtSecretsTooShortForHs256() {
        env.put("NODE_ENV", "development");
        env.put("JWT_SECRET", "dev-secret");
        assertThatThrownBy(() -> EnvValidator.validate(env::get)).hasMessageContaining("HS256");
    }
}
