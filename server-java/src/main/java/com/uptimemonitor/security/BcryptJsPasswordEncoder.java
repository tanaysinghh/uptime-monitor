package com.uptimemonitor.security;

import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * BCrypt (cost 12) that is hash-compatible with bcryptjs in both directions.
 *
 * <p>bcrypt only uses the first 72 bytes of a password. bcryptjs silently truncates,
 * while Spring's BCryptPasswordEncoder rejects passwords longer than 72 bytes - and the
 * password policy allows up to 200 characters. Truncating to 72 UTF-8 bytes here yields
 * byte-identical input to what bcryptjs hashed, so existing users' hashes keep verifying.
 */
public class BcryptJsPasswordEncoder implements PasswordEncoder {

    private static final int MAX_BYTES = 72;
    private final int cost;

    public BcryptJsPasswordEncoder(int cost) {
        this.cost = cost;
    }

    @Override
    public String encode(CharSequence rawPassword) {
        return BCrypt.hashpw(truncatedBytes(rawPassword), BCrypt.gensalt("$2a", cost));
    }

    @Override
    public boolean matches(CharSequence rawPassword, String encodedPassword) {
        if (rawPassword == null || encodedPassword == null || !encodedPassword.startsWith("$2")) {
            return false;
        }
        try {
            return BCrypt.checkpw(truncatedBytes(rawPassword), encodedPassword);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static byte[] truncatedBytes(CharSequence raw) {
        byte[] bytes = raw.toString().getBytes(StandardCharsets.UTF_8);
        return bytes.length > MAX_BYTES ? Arrays.copyOf(bytes, MAX_BYTES) : bytes;
    }
}
