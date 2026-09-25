package com.uptimemonitor.publicapi;

import com.uptimemonitor.common.JsNumbers;

/** Shields-style SVG badge, byte-identical to renderBadge() in badgeController.js. */
final class BadgeRenderer {

    static final String UP = "#22c55e";
    static final String DOWN = "#ef4444";
    static final String UNKNOWN = "#9ca3af";
    static final String WARN = "#eab308";
    private static final String LABEL_BG = "#555";

    private BadgeRenderer() {
    }

    static String escapeXml(String unsafe) {
        return unsafe.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static long approxWidth(String text) {
        return Math.round(text.length() * 6.5 + 12);
    }

    static String render(String label, String value, String valueColor) {
        String safeLabel = escapeXml(label);
        String safeValue = escapeXml(value);
        long labelW = approxWidth(label);
        long valueW = approxWidth(value);
        long totalW = labelW + valueW;
        String labelX = JsNumbers.toString(labelW / 2.0);
        String valueX = JsNumbers.toString(labelW + valueW / 2.0);

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + totalW + "\" height=\"20\" role=\"img\" aria-label=\"" + safeLabel + ": " + safeValue + "\">\n"
                + "  <title>" + safeLabel + ": " + safeValue + "</title>\n"
                + "  <linearGradient id=\"s\" x2=\"0\" y2=\"100%\">\n"
                + "    <stop offset=\"0\" stop-color=\"#bbb\" stop-opacity=\".1\"/>\n"
                + "    <stop offset=\"1\" stop-opacity=\".1\"/>\n"
                + "  </linearGradient>\n"
                + "  <clipPath id=\"r\"><rect width=\"" + totalW + "\" height=\"20\" rx=\"3\" fill=\"#fff\"/></clipPath>\n"
                + "  <g clip-path=\"url(#r)\">\n"
                + "    <rect width=\"" + labelW + "\" height=\"20\" fill=\"" + LABEL_BG + "\"/>\n"
                + "    <rect x=\"" + labelW + "\" width=\"" + valueW + "\" height=\"20\" fill=\"" + valueColor + "\"/>\n"
                + "    <rect width=\"" + totalW + "\" height=\"20\" fill=\"url(#s)\"/>\n"
                + "  </g>\n"
                + "  <g fill=\"#fff\" text-anchor=\"middle\" font-family=\"Verdana,Geneva,DejaVu Sans,sans-serif\" font-size=\"11\">\n"
                + "    <text x=\"" + labelX + "\" y=\"15\" fill=\"#010101\" fill-opacity=\".3\">" + safeLabel + "</text>\n"
                + "    <text x=\"" + labelX + "\" y=\"14\">" + safeLabel + "</text>\n"
                + "    <text x=\"" + valueX + "\" y=\"15\" fill=\"#010101\" fill-opacity=\".3\">" + safeValue + "</text>\n"
                + "    <text x=\"" + valueX + "\" y=\"14\">" + safeValue + "</text>\n"
                + "  </g>\n"
                + "</svg>";
    }
}
