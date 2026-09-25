package com.uptimemonitor.security;

import com.uptimemonitor.config.AppProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.util.Locale;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;

/**
 * Port of utils/ssrfGuard.js: only http/https, no loopback/internal hostnames, and the
 * host (literal or every DNS answer) must not be a private, loopback, link-local, CGNAT
 * or IPv4-mapped address. ALLOW_PRIVATE_URLS=true disables the guard (local development).
 */
@Component
public class SsrfGuard {

    public record Result(boolean ok, String reason) {
        static Result allowed() {
            return new Result(true, null);
        }

        static Result denied(String reason) {
            return new Result(false, reason);
        }
    }

    // {a, b, c, d, prefixBits}
    private static final int[][] PRIVATE_V4_RANGES = {
            {10, 0, 0, 0, 8},
            {127, 0, 0, 0, 8},
            {169, 254, 0, 0, 16},
            {172, 16, 0, 0, 12},
            {192, 168, 0, 0, 16},
            {0, 0, 0, 0, 8},
            {100, 64, 0, 0, 10},
    };

    private static final Set<String> ALLOWED_PROTOCOLS = Set.of("http", "https");
    private static final Pattern IPV4_LITERAL = Pattern.compile("^\\d{1,3}(\\.\\d{1,3}){3}$");

    private final boolean allowPrivate;
    private final Function<String, InetAddress[]> resolver;

    @Autowired
    public SsrfGuard(AppProperties props) {
        this(props.allowPrivateUrls(), SsrfGuard::resolve);
    }

    SsrfGuard(boolean allowPrivate, Function<String, InetAddress[]> resolver) {
        this.allowPrivate = allowPrivate;
        this.resolver = resolver;
    }

    public Result validateMonitorUrl(String rawUrl) {
        if (allowPrivate) {
            return Result.allowed();
        }
        URI uri;
        try {
            uri = new URI(rawUrl == null ? "" : rawUrl.trim());
        } catch (URISyntaxException e) {
            return Result.denied("Invalid URL");
        }
        if (uri.getScheme() == null) {
            return Result.denied("Invalid URL");
        }
        String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        if (!ALLOWED_PROTOCOLS.contains(scheme)) {
            return Result.denied("Protocol " + scheme + ": not allowed. Use http or https.");
        }
        String host = uri.getHost();
        if (host == null || host.isEmpty()) {
            return Result.denied("URL missing hostname");
        }
        if (host.startsWith("[") && host.endsWith("]")) {
            host = host.substring(1, host.length() - 1);
        }
        String lowered = host.toLowerCase(Locale.ROOT);
        if (lowered.equals("localhost") || lowered.endsWith(".localhost") || lowered.endsWith(".internal")) {
            return Result.denied("Loopback / internal hostnames are not allowed");
        }

        if (isIpLiteral(host)) {
            return isPrivateAddress(host)
                    ? Result.denied("URL resolves to a private / loopback address")
                    : Result.allowed();
        }

        InetAddress[] records;
        try {
            records = resolver.apply(host);
        } catch (RuntimeException e) {
            return Result.denied("DNS lookup failed: " + (e.getCause() != null ? "ENOTFOUND" : e.getMessage()));
        }
        if (records == null || records.length == 0) {
            return Result.denied("DNS lookup returned no records");
        }
        for (InetAddress r : records) {
            if (isPrivateAddress(r.getHostAddress())) {
                return Result.denied("URL resolves to a private / loopback address");
            }
        }
        return Result.allowed();
    }

    private static InetAddress[] resolve(String host) {
        try {
            return InetAddress.getAllByName(host);
        } catch (UnknownHostException e) {
            throw new IllegalStateException("ENOTFOUND", e);
        }
    }

    static boolean isIpLiteral(String host) {
        return IPV4_LITERAL.matcher(host).matches() || host.contains(":");
    }

    public static boolean isPrivateAddress(String ip) {
        if (ip == null) {
            return false;
        }
        if (IPV4_LITERAL.matcher(ip).matches()) {
            return isPrivateV4(ip);
        }
        if (ip.contains(":")) {
            return isPrivateV6(ip);
        }
        return false;
    }

    private static boolean isPrivateV4(String ip) {
        String[] parts = ip.split("\\.");
        long value = 0;
        for (String p : parts) {
            int octet = Integer.parseInt(p);
            if (octet > 255) {
                return false;
            }
            value = (value << 8) | octet;
        }
        for (int[] r : PRIVATE_V4_RANGES) {
            long network = ((long) r[0] << 24) | ((long) r[1] << 16) | ((long) r[2] << 8) | r[3];
            long mask = r[4] == 0 ? 0 : (0xFFFFFFFFL << (32 - r[4])) & 0xFFFFFFFFL;
            if ((value & mask) == (network & mask)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isPrivateV6(String ip) {
        String lower = ip.toLowerCase(Locale.ROOT);
        int zone = lower.indexOf('%');
        if (zone >= 0) {
            lower = lower.substring(0, zone);
        }
        // Normalize "0:0:0:0:0:0:0:1" (Java's textual form) to "::1" before prefix checks.
        try {
            InetAddress addr = InetAddress.getByName(lower);
            if (addr instanceof Inet6Address v6 && v6.isLoopbackAddress()) {
                return true;
            }
            if (addr instanceof Inet4Address) {
                // IPv4-mapped (::ffff:a.b.c.d) - Java unwraps these to Inet4Address.
                return true;
            }
        } catch (UnknownHostException ignored) {
            // fall through to prefix rules
        }
        return lower.equals("::1")
                || lower.startsWith("fc")
                || lower.startsWith("fd")
                || lower.startsWith("fe80")
                || lower.startsWith("::ffff:");
    }
}
