package com.uptimemonitor.common;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CommonUtilsTest {

    /** Expected values produced by validator.js normalizeEmail() (express-validator). */
    @ParameterizedTest
    @CsvSource({
            "John.Doe+tag@GoogleMail.com, johndoe@gmail.com",
            "a..b@gmail.com, a..b@gmail.com",
            "User+x@Outlook.com, user@outlook.com",
            "first-last-tag@yahoo.com, first-last@yahoo.com",
            "Me@Yandex.com, me@yandex.ru",
            "Mixed.Case@Example.ORG, mixed.case@example.org",
            "x+y@icloud.com, x@icloud.com",
    })
    void normalizeEmailMatchesValidatorJs(String input, String expected) {
        assertThat(EmailNormalizer.normalize(input)).isEqualTo(expected);
    }

    @Test
    void emailFormat() {
        assertThat(EmailFormat.isEmail("user@example.com")).isTrue();
        assertThat(EmailFormat.isEmail("first.last+tag@sub.example.co.uk")).isTrue();
        assertThat(EmailFormat.isEmail("no-at-sign")).isFalse();
        assertThat(EmailFormat.isEmail("user@localhost")).isFalse();
        assertThat(EmailFormat.isEmail("user@@example.com")).isFalse();
        assertThat(EmailFormat.isEmail(".user@example.com")).isFalse();
        assertThat(EmailFormat.isEmail("user@example.c")).isFalse();
    }

    @Test
    void parseDuration() {
        assertThat(Durations.parseMillis("15m")).isEqualTo(900_000);
        assertThat(Durations.parseMillis("7d")).isEqualTo(604_800_000);
        assertThat(Durations.parseMillis("30s")).isEqualTo(30_000);
        assertThat(Durations.parseMillis("2h")).isEqualTo(7_200_000);
        assertThat(Durations.parseMillis("500")).isEqualTo(500);
        assertThat(Durations.parseMillis("garbage")).isZero();
        assertThat(Durations.parseMillis(null)).isZero();
    }

    @Test
    void validatorIntCoercionMatchesExpressValidator() {
        assertThat(RequestValidator.toInt(30)).isEqualTo(30);
        assertThat(RequestValidator.toInt("30")).isEqualTo(30);
        assertThat(RequestValidator.toInt(30.0)).isEqualTo(30);
        assertThat(RequestValidator.toInt(30.5)).isNull();
        assertThat(RequestValidator.toInt("abc")).isNull();
        assertThat(RequestValidator.toInt(true)).isNull();
    }

    @Test
    void validatorCollectsAllFieldErrors() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "");
        body.put("intervalSeconds", 5);
        body.put("method", null);
        RequestValidator v = RequestValidator.of(body);
        v.string("name", 1, 200, true, null);
        v.optionalInt("intervalSeconds", 30, 86400);
        v.in("method", RequestValidator.MONITOR_METHODS, true);
        v.optionalArray("tags");
        assertThatThrownBy(v::validate)
                .isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getDetails())
                        .extracting(ValidationException.FieldError::field)
                        .containsExactly("name", "intervalSeconds", "method"));
    }

    @Test
    void uuidParam() {
        assertThat(RequestValidator.isUuid("00000000-0000-0000-0000-000000000000")).isTrue();
        assertThatThrownBy(() -> RequestValidator.uuidParam("id", "not-a-uuid"))
                .isInstanceOfSatisfying(ValidationException.class, e ->
                        assertThat(e.getDetails()).containsExactly(
                                new ValidationException.FieldError("id", "id must be a UUID")));
    }

    @Test
    void iso8601Parsing() {
        assertThat(RequestValidator.parseIso8601("2026-01-02T03:04:05.000Z")).isNotNull();
        assertThat(RequestValidator.parseIso8601("2026-01-02T03:04:05+05:30")).isNotNull();
        assertThat(RequestValidator.parseIso8601("2026-01-02")).isNotNull();
        assertThat(RequestValidator.parseIso8601("yesterday")).isNull();
    }

    @Test
    void sha256AndConstantTimeEquals() {
        assertThat(Crypto.sha256Hex("abc")).isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assertThat(Crypto.constantTimeEquals("a", "a")).isTrue();
        assertThat(Crypto.constantTimeEquals("a", "b")).isFalse();
        assertThat(Crypto.constantTimeEquals(null, "b")).isFalse();
        assertThat(List.of(Crypto.randomHex(16), Crypto.randomHex(16))).doesNotHaveDuplicates();
    }
}
