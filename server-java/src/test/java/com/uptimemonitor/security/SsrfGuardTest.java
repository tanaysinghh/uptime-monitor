package com.uptimemonitor.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.net.InetAddress;
import java.net.UnknownHostException;

import static org.assertj.core.api.Assertions.assertThat;

/** Port of server/tests/ssrfGuard.test.js (DNS is stubbed so tests run offline). */
class SsrfGuardTest {

    @ParameterizedTest
    @CsvSource({
            "127.0.0.1, true",
            "10.0.0.1, true",
            "172.16.5.6, true",
            "192.168.1.1, true",
            "169.254.169.254, true",
            "0.0.0.0, true",
            "100.64.0.1, true",
            "8.8.8.8, false",
            "1.1.1.1, false",
            "::1, true",
            "fe80::1, true",
            "fd00::1, true",
            "2606:4700:4700::1111, false",
            "0:0:0:0:0:0:0:1, true",
            "::ffff:10.0.0.1, true",
    })
    void isPrivateAddress(String ip, boolean expected) {
        assertThat(SsrfGuard.isPrivateAddress(ip)).isEqualTo(expected);
    }

    private static SsrfGuard guard(String... resolvedIps) {
        return new SsrfGuard(false, host -> {
            try {
                InetAddress[] out = new InetAddress[resolvedIps.length];
                for (int i = 0; i < resolvedIps.length; i++) {
                    out[i] = InetAddress.getByName(resolvedIps[i]);
                }
                return out;
            } catch (UnknownHostException e) {
                throw new IllegalStateException(e);
            }
        });
    }

    @Test
    void rejectsNonHttpProtocol() {
        assertThat(guard().validateMonitorUrl("file:///etc/passwd").ok()).isFalse();
    }

    @Test
    void rejectsPrivateIpLiteral() {
        SsrfGuard.Result r = guard().validateMonitorUrl("http://192.168.0.1/");
        assertThat(r.ok()).isFalse();
        assertThat(r.reason()).containsIgnoringCase("private");
    }

    @Test
    void rejectsLocalhostAndInternalHostnames() {
        assertThat(guard().validateMonitorUrl("http://localhost/api").ok()).isFalse();
        assertThat(guard().validateMonitorUrl("http://db.internal/").ok()).isFalse();
        assertThat(guard().validateMonitorUrl("http://app.localhost/").ok()).isFalse();
    }

    @Test
    void rejectsMalformedUrl() {
        assertThat(guard().validateMonitorUrl("not a url").ok()).isFalse();
    }

    @Test
    void rejectsHostnamesThatResolveToPrivateAddresses() {
        assertThat(guard("93.184.216.34", "10.1.2.3").validateMonitorUrl("https://rebind.example/").ok()).isFalse();
    }

    @Test
    void acceptsPublicHostnames() {
        assertThat(guard("93.184.216.34").validateMonitorUrl("https://example.com/health").ok()).isTrue();
        assertThat(guard().validateMonitorUrl("http://8.8.8.8/").ok()).isTrue();
    }

    @Test
    void rejectsIpv6LoopbackLiteral() {
        assertThat(guard().validateMonitorUrl("http://[::1]:8080/").ok()).isFalse();
    }

    @Test
    void allowPrivateUrlsBypassesAllChecks() {
        SsrfGuard open = new SsrfGuard(true, host -> {
            throw new AssertionError("must not resolve");
        });
        assertThat(open.validateMonitorUrl("http://127.0.0.1:5000/").ok()).isTrue();
    }
}
