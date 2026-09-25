package com.uptimemonitor.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Port of server/tests/passwordPolicy.test.js, plus score parity with the JS zxcvbn. */
class PasswordPolicyTest {

    private final PasswordPolicy policy = new PasswordPolicy();

    @Test
    void rejectsTooShort() {
        assertThat(policy.evaluate("Ab1!", List.of()).ok()).isFalse();
    }

    @Test
    void rejectsExtremelyCommon() {
        assertThat(policy.evaluate("password12345", List.of()).ok()).isFalse();
    }

    @Test
    void rejectsTooLong() {
        assertThat(policy.evaluate("a".repeat(300), List.of()).ok()).isFalse();
    }

    @Test
    void rejectsPasswordIdenticalToAUserInput() {
        assertThat(policy.evaluate("acmeacmeacme", List.of("acmeacmeacme")).ok()).isFalse();
    }

    @Test
    void acceptsAStrongPassphrase() {
        PasswordPolicy.Result r = policy.evaluate("correct horse battery staple x9", List.of());
        assertThat(r.ok()).isTrue();
        assertThat(r.score()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void acceptsARandomMix() {
        assertThat(policy.evaluate("Tr0ub4dor&3xample!", List.of()).ok()).isTrue();
    }

    @Test
    void weakPasswordsCarryAHumanReadableReason() {
        PasswordPolicy.Result r = policy.evaluate("qwertyuiop", List.of());
        assertThat(r.ok()).isFalse();
        assertThat(r.reason()).isNotBlank();
    }

    /** Scores produced by zxcvbn@4.4.2 (the Node dependency) for the same inputs. */
    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "password12345|1",
            "Tr0ub4dor&3xample!|4",
            "correct horse battery staple x9|4",
            "acmeacmeacme|1",
            "qwertyuiop|0",
            "Summer2024!|2",
            "kT9#vLq2!mZ|4",
            "letmein123|1",
    })
    void scoresMatchTheJavascriptImplementation(String password, int jsScore) {
        assertThat(policy.evaluate(password, List.of()).score()).isEqualTo(jsScore);
    }
}
