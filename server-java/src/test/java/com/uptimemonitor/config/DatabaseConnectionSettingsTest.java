package com.uptimemonitor.config;

import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.HexFormat;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Mirrors server/tests/database.test.js for the Java side. */
class DatabaseConnectionSettingsTest {

    static final Path BUNDLED_CA = Path.of("certs/supabase-root-2021.crt");

    private static DatabaseConnectionSettings settings(Map<String, String> env) {
        return DatabaseConnectionSettings.from(env::get);
    }

    @Test
    void noTlsForLocalPostgres() {
        var s = settings(Map.of());
        assertThat(s.jdbcProperties()).isEmpty();
        assertThat(s.tlsRequired()).isFalse();
        assertThat(s.flywayPort()).isNull();
    }

    @Test
    void dbSslWithCaFileVerifiesAgainstThatRoot() {
        var s = settings(Map.of("DB_SSL", "true", "DB_SSL_CA_FILE", BUNDLED_CA.toString()));
        assertThat(s.tlsRequired()).isTrue();
        assertThat(s.jdbcProperties()).containsEntry("sslmode", "verify-full")
                .containsEntry("sslrootcert", BUNDLED_CA.toAbsolutePath().normalize().toString())
                .doesNotContainKey("sslfactory");
    }

    @Test
    void missingCaFileFailsAtStartupRatherThanOnFirstQuery() {
        assertThatThrownBy(() -> settings(Map.of("DB_SSL", "true", "DB_SSL_CA_FILE", "certs/nope.crt")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DB_SSL_CA_FILE");
    }

    @Test
    void caAsPemTextIsWrittenToAFileWithEscapedNewlinesRestored() throws Exception {
        var s = settings(Map.of("DB_SSL", "true",
                "DB_SSL_CA", "-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----"));
        Path file = Path.of(s.jdbcProperties().get("sslrootcert"));
        assertThat(Files.readString(file)).isEqualTo("-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----");
    }

    @Test
    void withoutAPinnedRootTheJvmTrustStoreIsUsedAndVerificationStaysOn() {
        var s = settings(Map.of("DB_SSL", "true"));
        assertThat(s.jdbcProperties()).containsEntry("sslmode", "verify-full")
                .containsEntry("sslfactory", "org.postgresql.ssl.DefaultJavaSSLFactory");
    }

    @Test
    void caSettingsAreIgnoredUnlessDbSslIsTrue() {
        assertThat(settings(Map.of("DB_SSL_CA_FILE", BUNDLED_CA.toString(), "DB_SSL", "false")).jdbcProperties()).isEmpty();
    }

    @Test
    void prepareThresholdForTransactionPoolers() {
        assertThat(settings(Map.of("DB_PREPARE_THRESHOLD", "0")).jdbcProperties()).containsEntry("prepareThreshold", "0");
        assertThatThrownBy(() -> settings(Map.of("DB_PREPARE_THRESHOLD", "zero")))
                .isInstanceOf(NumberFormatException.class);
    }

    @Test
    void flywayUrlUsesItsOwnPortKeepsTlsAndDropsPrepareTuning() {
        var s = settings(Map.of("DB_SSL", "true", "DB_SSL_CA_FILE", BUNDLED_CA.toString(),
                "DB_PREPARE_THRESHOLD", "0", "FLYWAY_DB_PORT", "5432"));
        String url = s.flywayUrl("aws-0-us-west-2.pooler.supabase.com", "postgres");
        assertThat(url).startsWith("jdbc:postgresql://aws-0-us-west-2.pooler.supabase.com:5432/postgres?")
                .contains("sslmode=verify-full")
                .contains("sslrootcert=" + java.net.URLEncoder.encode(
                        BUNDLED_CA.toAbsolutePath().normalize().toString(), StandardCharsets.UTF_8))
                .doesNotContain("prepareThreshold");
    }

    @Test
    void bundledCaIsSupabaseRoot2021PinnedByFingerprint() throws Exception {
        X509Certificate cert;
        try (InputStream in = Files.newInputStream(BUNDLED_CA)) {
            cert = (X509Certificate) CertificateFactory.getInstance("X.509").generateCertificate(in);
        }
        assertThat(cert.getSubjectX500Principal().getName()).contains("CN=Supabase Root 2021 CA");
        String fingerprint = HexFormat.ofDelimiter(":").withUpperCase()
                .formatHex(MessageDigest.getInstance("SHA-256").digest(cert.getEncoded()));
        assertThat(fingerprint).isEqualTo(
                "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA");
    }

    @Test
    void bundledCaMatchesTheNodeServersCopy() throws Exception {
        Path nodeCopy = Path.of("../server/src/config/certs/supabase-root-2021.crt");
        org.junit.jupiter.api.Assumptions.assumeTrue(Files.exists(nodeCopy), "Node server not checked out alongside");
        assertThat(Files.readAllBytes(BUNDLED_CA)).isEqualTo(Files.readAllBytes(nodeCopy));
    }
}
