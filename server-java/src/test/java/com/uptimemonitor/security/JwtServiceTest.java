package com.uptimemonitor.security;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private final JwtService jwt = new JwtService(NodeCompatibilityTest.props());

    @Test
    void accessTokenRoundTrip() {
        UUID user = UUID.randomUUID();
        UUID session = UUID.randomUUID();
        JwtService.AccessClaims claims = jwt.verifyAccessToken(jwt.generateAccessToken(user, session)).orElseThrow();
        assertThat(claims.userId()).isEqualTo(user);
        assertThat(claims.sessionId()).isEqualTo(session);
    }

    @Test
    void refreshTokensAreNotAcceptedAsAccessTokensAndViceVersa() {
        UUID user = UUID.randomUUID();
        UUID session = UUID.randomUUID();
        assertThat(jwt.verifyAccessToken(jwt.generateRefreshToken(user, session))).isEmpty();
        assertThat(jwt.verifyRefreshToken(jwt.generateAccessToken(user, session))).isEmpty();
    }

    @Test
    void mfaChallengeTokenCannotBeUsedAsAnAccessToken() {
        String challenge = jwt.generateMfaChallengeToken(UUID.randomUUID(), UUID.randomUUID());
        assertThat(jwt.verifyAccessToken(challenge)).isEmpty();
        assertThat(jwt.verifyMfaChallengeToken(challenge)).get()
                .extracting(JwtService.MfaChallengeClaims::challengeId).isNotNull();
    }

    @Test
    void accessTokenIsNotAnMfaChallenge() {
        String access = jwt.generateAccessToken(UUID.randomUUID(), UUID.randomUUID());
        assertThat(jwt.verifyMfaChallengeToken(access)).get()
                .extracting(JwtService.MfaChallengeClaims::challengeId).isNull();
    }

    @Test
    void rejectsGarbageAndTamperedTokens() {
        String token = jwt.generateAccessToken(UUID.randomUUID(), UUID.randomUUID());
        assertThat(jwt.verifyAccessToken("not.a.jwt")).isEmpty();
        assertThat(jwt.verifyAccessToken(token.substring(0, token.length() - 3) + "abc")).isEmpty();
        assertThat(jwt.verifyAccessToken("")).isEmpty();
    }

    @Test
    void refreshTokensAreUniqueEvenWhenIssuedInTheSameSecond() {
        UUID user = UUID.randomUUID();
        UUID session = UUID.randomUUID();
        assertThat(jwt.generateRefreshToken(user, session)).isNotEqualTo(jwt.generateRefreshToken(user, session));
    }
}
