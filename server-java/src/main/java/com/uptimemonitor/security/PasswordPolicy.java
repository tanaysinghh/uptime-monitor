package com.uptimemonitor.security;

import com.nulabinc.zxcvbn.Strength;
import com.nulabinc.zxcvbn.Zxcvbn;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Port of utils/passwordPolicy.js: 8-200 characters and a zxcvbn score of at least 2,
 * with the user's own email/name/org penalised as dictionary words.
 */
@Component
public class PasswordPolicy {

    public static final int MIN_SCORE = 2;
    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 200;

    public record Result(boolean ok, int score, String reason) {
    }

    private final Zxcvbn zxcvbn = new Zxcvbn();

    public Result evaluate(String password, List<String> userInputs) {
        if (password == null || password.length() < MIN_LENGTH) {
            return new Result(false, 0, "Password must be at least " + MIN_LENGTH + " characters.");
        }
        if (password.length() > MAX_LENGTH) {
            return new Result(false, 0, "Password must be at most " + MAX_LENGTH + " characters.");
        }

        List<String> inputs = userInputs == null ? List.of()
                : userInputs.stream().filter(Objects::nonNull).filter(s -> !s.isEmpty()).toList();
        Strength strength = zxcvbn.measure(password, inputs);
        if (strength.getScore() < MIN_SCORE) {
            String warning = strength.getFeedback().getWarning(Locale.ENGLISH);
            List<String> suggestions = strength.getFeedback().getSuggestions(Locale.ENGLISH);
            String feedback = warning != null && !warning.isEmpty() ? warning
                    : suggestions != null && !suggestions.isEmpty() ? suggestions.get(0)
                    : "Password is too weak. Try adding more length or unrelated words.";
            return new Result(false, strength.getScore(), feedback);
        }
        return new Result(true, strength.getScore(), null);
    }
}
