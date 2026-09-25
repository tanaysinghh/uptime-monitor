package com.uptimemonitor.security;

import com.uptimemonitor.common.Durations;
import com.uptimemonitor.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

/**
 * HS256 tokens wire-compatible with the Node server's jsonwebtoken usage (same secrets,
 * same claim names: userId, sid, jti, typ, iat, exp), so tokens issued by either backend
 * are accepted by the other.
 */
@Service
public class JwtService {

    public static final String TYP_MFA_CHALLENGE = "mfa_challenge";
    private static final Duration MFA_CHALLENGE_TTL = Duration.ofMinutes(5);

    public record AccessClaims(UUID userId, UUID sessionId, long issuedAtSeconds) {
    }

    public record RefreshClaims(UUID userId, UUID sessionId) {
    }

    public record MfaChallengeClaims(UUID userId, UUID challengeId) {
    }

    private final SecretKey accessKey;
    private final SecretKey refreshKey;
    private final Duration accessTtl;
    private final Duration refreshTtl;

    public JwtService(AppProperties props) {
        this.accessKey = hmacKey(props.jwt().secret());
        this.refreshKey = hmacKey(props.jwt().refreshSecret());
        this.accessTtl = Durations.parse(props.jwt().expiresIn());
        this.refreshTtl = Durations.parse(props.jwt().refreshExpiresIn());
    }

    private static SecretKey hmacKey(String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT secrets must be at least 32 bytes");
        }
        return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    public Duration refreshTtl() {
        return refreshTtl;
    }

    public String generateAccessToken(UUID userId, UUID sessionId) {
        Instant now = Instant.now();
        var builder = Jwts.builder()
                .claim("userId", userId.toString());
        if (sessionId != null) {
            builder.claim("sid", sessionId.toString());
        }
        return builder
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtl)))
                .signWith(accessKey, Jwts.SIG.HS256)
                .compact();
    }

    public String generateRefreshToken(UUID userId, UUID sessionId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .claim("userId", userId.toString())
                .claim("sid", sessionId.toString())
                .claim("jti", UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(refreshTtl)))
                .signWith(refreshKey, Jwts.SIG.HS256)
                .compact();
    }

    public String generateMfaChallengeToken(UUID userId, UUID challengeId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .claim("userId", userId.toString())
                .claim("cid", challengeId.toString())
                .claim("typ", TYP_MFA_CHALLENGE)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(MFA_CHALLENGE_TTL)))
                .signWith(accessKey, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * Verifies an access token. Unlike the Node middleware, tokens carrying a "typ" claim
     * (i.e. MFA challenge tokens, signed with the same secret) are rejected here: in Node an
     * mfaChallengeToken could be replayed as a Bearer token, bypassing the second factor.
     */
    public Optional<AccessClaims> verifyAccessToken(String token) {
        return parse(token, accessKey).flatMap(claims -> {
            if (claims.get("typ") != null) {
                return Optional.empty();
            }
            UUID userId = uuidClaim(claims, "userId");
            if (userId == null) {
                return Optional.empty();
            }
            long iat = claims.getIssuedAt() == null ? 0 : claims.getIssuedAt().toInstant().getEpochSecond();
            return Optional.of(new AccessClaims(userId, uuidClaim(claims, "sid"), iat));
        });
    }

    public Optional<RefreshClaims> verifyRefreshToken(String token) {
        return parse(token, refreshKey).map(claims ->
                new RefreshClaims(uuidClaim(claims, "userId"), uuidClaim(claims, "sid")));
    }

    /** Empty if invalid/expired; claims with null ids if the token is not an MFA challenge. */
    public Optional<MfaChallengeClaims> verifyMfaChallengeToken(String token) {
        return parse(token, accessKey).map(claims -> {
            if (!TYP_MFA_CHALLENGE.equals(claims.get("typ"))) {
                return new MfaChallengeClaims(null, null);
            }
            return new MfaChallengeClaims(uuidClaim(claims, "userId"), uuidClaim(claims, "cid"));
        });
    }

    private static Optional<Claims> parse(String token, SecretKey key) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static UUID uuidClaim(Claims claims, String name) {
        Object v = claims.get(name);
        if (v == null) {
            return null;
        }
        try {
            return UUID.fromString(v.toString());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
