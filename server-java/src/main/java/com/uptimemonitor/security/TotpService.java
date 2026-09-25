package com.uptimemonitor.security;

import dev.samstevens.totp.code.CodeVerifier;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.code.DefaultCodeVerifier;
import dev.samstevens.totp.code.HashingAlgorithm;
import dev.samstevens.totp.exceptions.QrGenerationException;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.qr.ZxingPngQrGenerator;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.secret.SecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.util.Utils;
import org.springframework.stereotype.Component;

/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30s, +/-1 step) - the same parameters speakeasy used,
 * so secrets enrolled through the Node server keep working.
 */
@Component
public class TotpService {

    public static final String APP_NAME = "UptimeMonitor";

    public record Enrollment(String secret, String otpauthUrl, String qrDataUrl) {
    }

    // 32 base32 chars = 160-bit secret, same size as speakeasy.generateSecret({ length: 20 }).
    private final SecretGenerator secretGenerator = new DefaultSecretGenerator(32);
    private final CodeVerifier verifier;

    public TotpService() {
        DefaultCodeVerifier v = new DefaultCodeVerifier(
                new DefaultCodeGenerator(HashingAlgorithm.SHA1, 6), new SystemTimeProvider());
        v.setTimePeriod(30);
        v.setAllowedTimePeriodDiscrepancy(1);
        this.verifier = v;
    }

    public Enrollment newEnrollment(String email) {
        String secret = secretGenerator.generate();
        QrData data = new QrData.Builder()
                .label(APP_NAME + " (" + email + ")")
                .secret(secret)
                .issuer(APP_NAME)
                .algorithm(HashingAlgorithm.SHA1)
                .digits(6)
                .period(30)
                .build();
        try {
            byte[] png = new ZxingPngQrGenerator().generate(data);
            return new Enrollment(secret, data.getUri(),
                    Utils.getDataUriForImage(png, "image/png"));
        } catch (QrGenerationException e) {
            throw new IllegalStateException("QR code generation failed", e);
        }
    }

    public boolean verify(String base32Secret, String code) {
        if (base32Secret == null || code == null) {
            return false;
        }
        String cleaned = code.replaceAll("\\s+", "");
        return verifier.isValidCode(base32Secret, cleaned);
    }
}
