package com.uptimemonitor.security;

import com.uptimemonitor.config.AppProperties;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.code.HashingAlgorithm;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Data written by the Node server must remain usable by the Java server (and vice versa)
 * because both run against the same database. Every expected value below was produced by
 * the Node dependencies themselves (bcryptjs, jsonwebtoken, utils/mfaCrypto.js, speakeasy).
 */
class NodeCompatibilityTest {

    static final String JWT_SECRET = "test_secret_at_least_32_characters_long_xxx";

    @Test
    void verifiesBcryptjsHashes() {
        BcryptJsPasswordEncoder encoder = new BcryptJsPasswordEncoder(4);
        String nodeHash = "$2b$04$pH6PX/kJgrAZucdNuU2bse/jTfwl107u.yB6hBg1v2xwuYkh22UXi";
        assertThat(encoder.matches("Tr0ub4dor&3xample!", nodeHash)).isTrue();
        assertThat(encoder.matches("Tr0ub4dor&3xample?", nodeHash)).isFalse();
    }

    @Test
    void verifiesBcryptjsHashesOfPasswordsLongerThan72Bytes() {
        BcryptJsPasswordEncoder encoder = new BcryptJsPasswordEncoder(4);
        String longPassword = "ü".repeat(40) + "tail-that-bcrypt-ignores";
        String nodeHash = "$2b$04$J0SMS.weWAkoXxACTZuJc.bmsFOOEnb2tmMfu9kpgeHjB1IwxkZQq";
        assertThat(encoder.matches(longPassword, nodeHash)).isTrue();
        // Spring's stock BCryptPasswordEncoder would throw for this input; ours hashes and verifies it.
        assertThat(encoder.matches(longPassword, encoder.encode(longPassword))).isTrue();
    }

    @Test
    void acceptsAccessTokensSignedByJsonwebtoken() {
        JwtService jwt = new JwtService(props());
        String nodeToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJzaWQiOiIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiLCJpYXQiOjE3OTAzMTY4MDUsImV4cCI6NDk0NjA3NjgwNX0.OSxf3XoHLXfJfwaDlPhZZw7K-rE2UdnYDpDV-_jTR-c";
        JwtService.AccessClaims claims = jwt.verifyAccessToken(nodeToken).orElseThrow();
        assertThat(claims.userId()).isEqualTo(UUID.fromString("11111111-1111-4111-8111-111111111111"));
        assertThat(claims.sessionId()).isEqualTo(UUID.fromString("22222222-2222-4222-8222-222222222222"));
        assertThat(claims.issuedAtSeconds()).isEqualTo(1790316805L);
    }

    @Test
    void decryptsMfaSecretsEncryptedByNode() {
        MfaCrypto crypto = new MfaCrypto("0123456789abcdef".repeat(4), false);
        assertThat(crypto.decrypt("AiLhh5GsAJa93pnj24gi6JdEJkPlEPQp+RVM1uK4oiQVy6etQ/iBYbRbLO8="))
                .isEqualTo("JBSWY3DPEHPK3PXP");
    }

    @Test
    void generatesTheSameTotpCodesAsSpeakeasy() throws Exception {
        DefaultCodeGenerator generator = new DefaultCodeGenerator(HashingAlgorithm.SHA1, 6);
        long counter = 1760000000L / 30;
        assertThat(generator.generate("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", counter)).isEqualTo("325812");
    }

    static AppProperties props() {
        return new AppProperties("test", "http://localhost:5173", false,
                new AppProperties.Jwt(JWT_SECRET, "test_refresh_secret_at_least_32_chars_diff", "15m", "7d"),
                "0".repeat(64), new AppProperties.RateLimit(false), new AppProperties.Scheduler(false),
                new AppProperties.Socket(false, 5001));
    }
}
