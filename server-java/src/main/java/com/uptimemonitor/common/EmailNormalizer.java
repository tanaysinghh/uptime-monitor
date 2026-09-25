package com.uptimemonitor.common;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Exact port of validator.js normalizeEmail() with its default options, which is what
 * express-validator's {@code .normalizeEmail()} applied to every email the Node server
 * stored. Emails must be normalized identically or existing users could not log in
 * (e.g. "John.Doe+x@GoogleMail.com" was stored as "johndoe@gmail.com").
 */
public final class EmailNormalizer {

    private static final Set<String> ICLOUD = Set.of("icloud.com", "me.com");

    private static final Set<String> OUTLOOK = Set.of(
            "hotmail.at", "hotmail.be", "hotmail.ca", "hotmail.cl", "hotmail.co.il", "hotmail.co.nz",
            "hotmail.co.th", "hotmail.co.uk", "hotmail.com", "hotmail.com.ar", "hotmail.com.au",
            "hotmail.com.br", "hotmail.com.gr", "hotmail.com.mx", "hotmail.com.pe", "hotmail.com.tr",
            "hotmail.com.vn", "hotmail.cz", "hotmail.de", "hotmail.dk", "hotmail.es", "hotmail.fr",
            "hotmail.hu", "hotmail.id", "hotmail.ie", "hotmail.in", "hotmail.it", "hotmail.jp",
            "hotmail.kr", "hotmail.lv", "hotmail.my", "hotmail.ph", "hotmail.pt", "hotmail.sa",
            "hotmail.sg", "hotmail.sk", "live.be", "live.co.uk", "live.com", "live.com.ar",
            "live.com.mx", "live.de", "live.es", "live.eu", "live.fr", "live.it", "live.nl", "msn.com",
            "outlook.at", "outlook.be", "outlook.cl", "outlook.co.il", "outlook.co.nz", "outlook.co.th",
            "outlook.com", "outlook.com.ar", "outlook.com.au", "outlook.com.br", "outlook.com.gr",
            "outlook.com.pe", "outlook.com.tr", "outlook.com.vn", "outlook.cz", "outlook.de",
            "outlook.dk", "outlook.es", "outlook.fr", "outlook.hu", "outlook.id", "outlook.ie",
            "outlook.in", "outlook.it", "outlook.jp", "outlook.kr", "outlook.lv", "outlook.my",
            "outlook.ph", "outlook.pt", "outlook.sa", "outlook.sg", "outlook.sk", "passport.com");

    private static final Set<String> YAHOO = Set.of(
            "rocketmail.com", "yahoo.ca", "yahoo.co.uk", "yahoo.com", "yahoo.de", "yahoo.fr",
            "yahoo.in", "yahoo.it", "ymail.com");

    private static final Set<String> YANDEX = Set.of(
            "yandex.ru", "yandex.ua", "yandex.kz", "yandex.com", "yandex.by", "ya.ru");

    private static final Pattern DOTS = Pattern.compile("\\.+");

    private EmailNormalizer() {
    }

    /** Returns the normalized address, or null where validator.js returns false. */
    public static String normalize(String email) {
        int at = email.lastIndexOf('@');
        String user = at >= 0 ? email.substring(0, at) : "";
        String domain = (at >= 0 ? email.substring(at + 1) : email).toLowerCase(Locale.ROOT);

        if (domain.equals("gmail.com") || domain.equals("googlemail.com")) {
            user = user.split("\\+", -1)[0];
            user = removeSingleDots(user);
            if (user.isEmpty()) {
                return null;
            }
            user = user.toLowerCase(Locale.ROOT);
            domain = "gmail.com";
        } else if (ICLOUD.contains(domain) || OUTLOOK.contains(domain)) {
            user = user.split("\\+", -1)[0];
            if (user.isEmpty()) {
                return null;
            }
            user = user.toLowerCase(Locale.ROOT);
        } else if (YAHOO.contains(domain)) {
            String[] components = user.split("-", -1);
            user = components.length > 1
                    ? String.join("-", Arrays.copyOf(components, components.length - 1))
                    : components[0];
            if (user.isEmpty()) {
                return null;
            }
            user = user.toLowerCase(Locale.ROOT);
        } else if (YANDEX.contains(domain)) {
            user = user.toLowerCase(Locale.ROOT);
            domain = "yandex.ru";
        } else {
            user = user.toLowerCase(Locale.ROOT);
        }
        return user + "@" + domain;
    }

    /** Removes single dots but keeps runs of 2+ ("a..b" stays), like validator's dotsReplacer. */
    private static String removeSingleDots(String s) {
        Matcher m = DOTS.matcher(s);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            m.appendReplacement(sb, m.group().length() > 1 ? Matcher.quoteReplacement(m.group()) : "");
        }
        m.appendTail(sb);
        return sb.toString();
    }
}
