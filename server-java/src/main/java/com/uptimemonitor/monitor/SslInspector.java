package com.uptimemonitor.monitor;

import org.springframework.stereotype.Component;

import javax.naming.ldap.LdapName;
import javax.naming.ldap.Rdn;
import javax.net.ssl.SNIHostName;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.net.InetSocketAddress;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * TLS certificate expiry probe (checkSSLCertificate in healthCheckService.js). Validates
 * the chain and hostname like Node's tls.connect; any failure yields null.
 */
@Component
public class SslInspector {

    private static final int TIMEOUT_MS = 5000;
    private static final long DAY_MS = 24L * 60 * 60 * 1000;
    /** OpenSSL's notBefore/notAfter text, which Node's getPeerCertificate() returns. */
    private static final DateTimeFormatter OPENSSL_DATE =
            DateTimeFormatter.ofPattern("MMM ppd HH:mm:ss yyyy 'GMT'", Locale.ENGLISH).withZone(ZoneOffset.UTC);

    public Map<String, Object> inspect(String hostname) {
        SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
        try (SSLSocket socket = (SSLSocket) factory.createSocket()) {
            socket.connect(new InetSocketAddress(hostname, 443), TIMEOUT_MS);
            socket.setSoTimeout(TIMEOUT_MS);
            SSLParameters params = socket.getSSLParameters();
            params.setServerNames(List.of(new SNIHostName(hostname)));
            params.setEndpointIdentificationAlgorithm("HTTPS");
            socket.setSSLParameters(params);
            socket.startHandshake();

            Certificate[] chain = socket.getSession().getPeerCertificates();
            if (chain.length == 0 || !(chain[0] instanceof X509Certificate cert)) {
                return null;
            }
            Instant validTo = cert.getNotAfter().toInstant();
            long days = Math.floorDiv(validTo.toEpochMilli() - System.currentTimeMillis(), DAY_MS);

            Map<String, Object> info = new LinkedHashMap<>();
            info.put("validFrom", OPENSSL_DATE.format(cert.getNotBefore().toInstant()));
            info.put("validTo", OPENSSL_DATE.format(validTo));
            info.put("daysUntilExpiry", days);
            info.put("issuer", issuerOrganization(cert));
            info.put("isExpiringSoon", days <= 14);
            return info;
        } catch (Exception e) {
            return null;
        }
    }

    private static String issuerOrganization(X509Certificate cert) {
        try {
            for (Rdn rdn : new LdapName(cert.getIssuerX500Principal().getName()).getRdns()) {
                if ("O".equalsIgnoreCase(rdn.getType())) {
                    return String.valueOf(rdn.getValue());
                }
            }
        } catch (Exception ignored) {
            // fall through
        }
        return "Unknown";
    }
}
