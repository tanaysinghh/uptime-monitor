package com.uptimemonitor.security;

import com.uptimemonitor.common.Crypto;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Port of utils/backupCodes.js: ten "XXXX-XXXX" codes from an unambiguous alphabet,
 * stored as SHA-256 of the de-hyphenated upper-cased code, consumed one at a time.
 */
public final class BackupCodes {

    public static final String ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    public static final int CODE_COUNT = 10;
    private static final int HALF_LEN = 4;

    public record ConsumeResult(boolean matched, List<String> remaining) {
    }

    private BackupCodes() {
    }

    public static List<String> generate() {
        List<String> codes = new ArrayList<>(CODE_COUNT);
        for (int i = 0; i < CODE_COUNT; i++) {
            codes.add(randomBlock() + "-" + randomBlock());
        }
        return codes;
    }

    private static String randomBlock() {
        byte[] bytes = new byte[HALF_LEN];
        Crypto.RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(HALF_LEN);
        for (byte b : bytes) {
            sb.append(ALPHABET.charAt((b & 0xff) % ALPHABET.length()));
        }
        return sb.toString();
    }

    public static String hash(String code) {
        return Crypto.sha256Hex(String.valueOf(code).replace("-", "").toUpperCase(Locale.ROOT));
    }

    public static ConsumeResult consumeMatching(String candidate, List<String> hashedList) {
        String target = hash(candidate);
        List<String> list = hashedList == null ? List.of() : hashedList;
        for (int i = 0; i < list.size(); i++) {
            if (Crypto.constantTimeEquals(list.get(i), target)) {
                List<String> remaining = new ArrayList<>(list);
                remaining.remove(i);
                return new ConsumeResult(true, remaining);
            }
        }
        return new ConsumeResult(false, list);
    }
}
