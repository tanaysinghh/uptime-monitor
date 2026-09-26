package com.uptimemonitor.config;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * PgJDBC connection properties derived from the same variables the Node server reads
 * (server/src/config/database.js), so one environment configures either backend.
 *
 * <ul>
 *   <li>{@code DB_SSL=true}: TLS required, certificate and host name verified
 *       ({@code sslmode=verify-full}). Verification is never switched off.</li>
 *   <li>{@code DB_SSL_CA_FILE}: PEM file with the provider's root CA (Supabase signs with
 *       its own "Supabase Root 2021 CA"), relative to the working directory.
 *       {@code DB_SSL_CA}: the same PEM as text (literal {@code \n} accepted).
 *       Without either, the JVM trust store is used, which covers public CAs (Neon).</li>
 *   <li>{@code DB_PREPARE_THRESHOLD}: set to 0 behind a transaction-mode pooler (Supabase
 *       port 6543). Consecutive transactions can land on different server connections, so
 *       server-side prepared statements must not be reused.</li>
 *   <li>{@code FLYWAY_DB_PORT}: run Flyway on its own connection to this port (Supabase's
 *       session pooler, 5432). Flyway holds a Postgres advisory lock across its run, which
 *       a transaction-mode pooler does not guarantee.</li>
 * </ul>
 */
public final class DatabaseConnectionSettings {

    public static final String VERIFY_FULL = "verify-full";

    private final Map<String, String> jdbcProperties;
    private final Integer flywayPort;

    private DatabaseConnectionSettings(Map<String, String> jdbcProperties, Integer flywayPort) {
        this.jdbcProperties = Map.copyOf(jdbcProperties);
        this.flywayPort = flywayPort;
    }

    public static DatabaseConnectionSettings from(Function<String, String> env) {
        Map<String, String> props = new LinkedHashMap<>();
        if ("true".equals(trim(env.apply("DB_SSL")))) {
            props.put("sslmode", VERIFY_FULL);
            String caFile = trim(env.apply("DB_SSL_CA_FILE"));
            String caText = env.apply("DB_SSL_CA");
            if (caFile != null) {
                Path path = Path.of(caFile).toAbsolutePath().normalize();
                if (!Files.isReadable(path)) {
                    throw new IllegalStateException("DB_SSL_CA_FILE is not a readable file: " + path);
                }
                props.put("sslrootcert", path.toString());
            } else if (trim(caText) != null) {
                props.put("sslrootcert", writeTempPem(caText.replace("\\n", "\n")).toString());
            } else {
                // No pinned root: trust the JVM's CA store; PgJDBC still checks the host name.
                props.put("sslfactory", "org.postgresql.ssl.DefaultJavaSSLFactory");
            }
        }
        String threshold = trim(env.apply("DB_PREPARE_THRESHOLD"));
        if (threshold != null) {
            props.put("prepareThreshold", String.valueOf(Integer.parseInt(threshold)));
        }
        String flyway = trim(env.apply("FLYWAY_DB_PORT"));
        return new DatabaseConnectionSettings(props, flyway == null ? null : Integer.valueOf(flyway));
    }

    /** Properties for the application's pool. */
    public Map<String, String> jdbcProperties() {
        return jdbcProperties;
    }

    /** Port for Flyway's own connection, or null to share the application's datasource. */
    public Integer flywayPort() {
        return flywayPort;
    }

    public boolean tlsRequired() {
        return VERIFY_FULL.equals(jdbcProperties.get("sslmode"));
    }

    /** Flyway runs once over a session connection, so it needs TLS but no prepare tuning. */
    public String flywayUrl(String host, String database) {
        StringBuilder url = new StringBuilder("jdbc:postgresql://").append(host).append(':').append(flywayPort)
                .append('/').append(database);
        char sep = '?';
        for (Map.Entry<String, String> e : jdbcProperties.entrySet()) {
            if (e.getKey().equals("prepareThreshold")) {
                continue;
            }
            url.append(sep).append(e.getKey()).append('=').append(encode(e.getValue()));
            sep = '&';
        }
        return url.toString();
    }

    private static String encode(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static Path writeTempPem(String pem) {
        try {
            Path file = Files.createTempFile("db-ca-", ".pem");
            file.toFile().deleteOnExit();
            Files.writeString(file, pem, StandardCharsets.UTF_8);
            try {
                Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
            } catch (UnsupportedOperationException ignored) {
                // Windows: the temp directory is already per-user.
            }
            return file;
        } catch (IOException e) {
            throw new UncheckedIOException("Could not write DB_SSL_CA to a temp file", e);
        }
    }

    private static String trim(String s) {
        return s == null || s.trim().isEmpty() ? null : s.trim();
    }
}
