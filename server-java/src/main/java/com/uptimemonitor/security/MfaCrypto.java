package com.uptimemonitor.security;

import com.uptimemonitor.common.Crypto;
import com.uptimemonitor.config.AppProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;

/**
 * AES-256-GCM encryption of TOTP secrets at rest, byte-compatible with utils/mfaCrypto.js:
 * base64(iv[12] || authTag[16] || ciphertext). Java's GCM output is ciphertext||tag, so the
 * tag is moved to match Node's layout.
 */
@Component
public class MfaCrypto {

    private static final int IV_LEN = 12;
    private static final int TAG_LEN = 16;

    private final SecretKeySpec key;

    @Autowired
    public MfaCrypto(AppProperties props) {
        this(props.mfaEncryptionKey(), props.isTest());
    }

    MfaCrypto(String hexKey, boolean testMode) {
        this.key = new SecretKeySpec(keyBytes(hexKey, testMode), "AES");
    }

    private static byte[] keyBytes(String hexKey, boolean testMode) {
        String hex = hexKey == null ? "" : hexKey.replaceAll("(?i)[^0-9a-f]", "");
        if (hex.length() != 64) {
            if (testMode) {
                try {
                    return MessageDigest.getInstance("SHA-256").digest("test-mfa-key".getBytes(StandardCharsets.UTF_8));
                } catch (GeneralSecurityException e) {
                    throw new IllegalStateException(e);
                }
            }
            throw new IllegalStateException("MFA_ENCRYPTION_KEY missing or wrong length");
        }
        return HexFormat.of().parseHex(hex);
    }

    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LEN];
            Crypto.RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LEN * 8, iv));
            byte[] out = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] enc = Arrays.copyOfRange(out, 0, out.length - TAG_LEN);
            byte[] tag = Arrays.copyOfRange(out, out.length - TAG_LEN, out.length);
            return Base64.getEncoder().encodeToString(
                    ByteBuffer.allocate(IV_LEN + TAG_LEN + enc.length).put(iv).put(tag).put(enc).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("MFA secret encryption failed", e);
        }
    }

    public String decrypt(String ciphertext) {
        try {
            byte[] buf = Base64.getDecoder().decode(ciphertext);
            byte[] iv = Arrays.copyOfRange(buf, 0, IV_LEN);
            byte[] tag = Arrays.copyOfRange(buf, IV_LEN, IV_LEN + TAG_LEN);
            byte[] enc = Arrays.copyOfRange(buf, IV_LEN + TAG_LEN, buf.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LEN * 8, iv));
            byte[] joined = ByteBuffer.allocate(enc.length + TAG_LEN).put(enc).put(tag).array();
            return new String(cipher.doFinal(joined), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("MFA secret decryption failed", e);
        }
    }
}
