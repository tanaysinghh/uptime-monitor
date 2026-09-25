package com.uptimemonitor.common;

/** JavaScript's Number#toString(), for output that must match the Node server byte for byte. */
public final class JsNumbers {

    private JsNumbers() {
    }

    public static String toString(Number n) {
        if (n instanceof Integer || n instanceof Long || n instanceof Short || n instanceof Byte) {
            return n.toString();
        }
        double d = n.doubleValue();
        if (Double.isNaN(d)) return "NaN";
        if (Double.isInfinite(d)) return d > 0 ? "Infinity" : "-Infinity";
        if (d == Math.rint(d) && Math.abs(d) < 1e21) {
            return Long.toString((long) d);
        }
        String s = Double.toString(d);
        int e = s.indexOf('E');
        if (e < 0) {
            return s;
        }
        String mantissa = s.substring(0, e);
        if (mantissa.endsWith(".0")) {
            mantissa = mantissa.substring(0, mantissa.length() - 2);
        }
        String exp = s.substring(e + 1);
        return mantissa + "e" + (exp.startsWith("-") ? exp : "+" + exp);
    }
}
