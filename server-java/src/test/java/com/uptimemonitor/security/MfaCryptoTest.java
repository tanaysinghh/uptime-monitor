package com.uptimemonitor.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Port of server/tests/mfaCrypto.test.js. */
class MfaCryptoTest {

    private final MfaCrypto crypto = new MfaCrypto("0".repeat(64), false);

    @Test
    void roundTrips() {
        assertThat(crypto.decrypt(crypto.encrypt("JBSWY3DPEHPK3PXP"))).isEqualTo("JBSWY3DPEHPK3PXP");
    }

    @Test
    void usesAFreshIvForEveryEncryption() {
        assertThat(crypto.encrypt("same")).isNotEqualTo(crypto.encrypt("same"));
    }

    @Test
    void rejectsTamperedCiphertext() {
        String enc = crypto.encrypt("secret");
        char last = enc.charAt(enc.length() - 2);
        String tampered = enc.substring(0, enc.length() - 2) + (last == 'A' ? 'B' : 'A') + enc.charAt(enc.length() - 1);
        assertThatThrownBy(() -> crypto.decrypt(tampered)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void refusesToStartWithoutAValidKeyOutsideTests() {
        assertThatThrownBy(() -> new MfaCrypto("abc", false)).isInstanceOf(IllegalStateException.class);
        assertThat(new MfaCrypto("abc", true).decrypt(new MfaCrypto("", true).encrypt("x"))).isEqualTo("x");
    }
}
