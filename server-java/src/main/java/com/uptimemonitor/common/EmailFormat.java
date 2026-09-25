package com.uptimemonitor.common;

import java.util.regex.Pattern;

/** Pragmatic equivalent of validator.js isEmail() with default options. */
public final class EmailFormat {

    private static final Pattern LOCAL = Pattern.compile("^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$");
    private static final Pattern LABEL = Pattern.compile("^[A-Za-z0-9\\u00a1-\\uffff]([A-Za-z0-9\\u00a1-\\uffff-]{0,61}[A-Za-z0-9\\u00a1-\\uffff])?$");
    private static final Pattern TLD = Pattern.compile("^([a-zA-Z\\u00a1-\\uffff]{2,}|xn--[a-zA-Z0-9-]{2,})$");

    private EmailFormat() {
    }

    public static boolean isEmail(String email) {
        if (email == null || email.length() > 254) {
            return false;
        }
        int at = email.lastIndexOf('@');
        if (at <= 0 || at == email.length() - 1) {
            return false;
        }
        String local = email.substring(0, at);
        String domain = email.substring(at + 1);
        if (local.length() > 64 || !LOCAL.matcher(local).matches()) {
            return false;
        }
        String[] labels = domain.split("\\.", -1);
        if (labels.length < 2) {
            return false;
        }
        for (String label : labels) {
            if (!LABEL.matcher(label).matches()) {
                return false;
            }
        }
        return TLD.matcher(labels[labels.length - 1]).matches();
    }
}
