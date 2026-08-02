# Uptime Monitor — Design System

The product's identity is *precise engineering instrument*: deep-emerald, editorial-technical, with a single reserved color for live moments. Trust before excitement. Numbers are the hero.

## Palette

Unified — no light/dark split. The site is dark-emerald everywhere.

### Core (used everywhere)
| Token | Value | Purpose |
|---|---|---|
| `--color-ink` | `#F2F4EF` | Text, primary buttons, icons — near-white with a hint of warmth |
| `--color-paper` | `#103A2E` | Page background — deep forest/bottle emerald |
| `--color-bone` | `#133024` | Hairline borders, subtle lifted surfaces |
| `--color-bone-strong` | `#1E4234` | Dividers, no-data bars |
| `--color-muted` | `#8FA69A` | Secondary text, timestamps — muted silver-mint |
| `--color-pulse` | `#E8A15D` | **Reserved.** Live-check pulse, focus rings, brand mark accent — warm amber |

### Semantic status — used **only** in status contexts
| Token | Value | Meaning |
|---|---|---|
| `--color-st-up` | `#4FBF83` | Operational / healthy |
| `--color-st-degraded` | `#E5B04A` | Degraded / slow |
| `--color-st-down` | `#E86454` | Incident / down |
| `--color-st-maint` | `#8A9CA8` | Maintenance / no data |

**Rule:** amber `#E5B04A` means *degraded* and nothing else. Coral-red `#E86454` means *incident* and nothing else. Pulse amber `#E8A15D` is never used for status. Every status color is accompanied by an icon or label — never color alone.

## Typography — three voices

| Family | Use | Notes |
|---|---|---|
| `Instrument Serif` (`--font-display`) | Page titles, hero headlines, empty-state headers | Editorial-serif in a dev product — deliberately unexpected. Use with restraint. |
| `IBM Plex Sans` (`--font-sans`) | UI text, labels, buttons, body | Workhorse. |
| `IBM Plex Mono` (`--font-mono`) | Every number, timestamp, ms/pct, status code, API key | Tabular figures. Use the `font-num` utility. |

**Scale:** `12 / 14 / 16 / 20 / 28 / 44 / 72`. Nothing in between.

Fonts are loaded via Google Fonts CDN with subset delivery. For strict self-hosted delivery, swap the `@import` at the top of `src/index.css` for the `@fontsource/*` packages listed in `package.json`.

## Layout

- **Spacing:** `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96` (px). Nothing else.
- **Radius:** `0`. Everywhere. Committed. All Tailwind `rounded-*` classes resolve to 0 by design. The only round things are true circles (avatars, dots, pulse).
- **Elevation:** no drop shadows anywhere. Surfaces separate by 1px `--color-bone` hairlines and by whitespace. The `hairline`, `hairline-t`, `hairline-b`, `hairline-l`, `hairline-r` utilities apply the standard 1px border in `--color-bone`.
- **Focus:** 2px pulse-orange outline with 2px offset. Never remove without replacing.

## Signature element — Uptime Strip

`<UptimeStrip uptimeDays={...} size="md" />` is the product's DNA. 90 vertical bars, one per day:

- **Up (≥99%)** — full-height ink bar
- **Degraded (95–99%)** — 60% height, amber
- **Down (<95%)** — 30% height, brick red
- **No data** — 1px baseline in bone-strong

The rightmost bar (today) hosts a small pulse dot. When paired with `<LivePulse trigger={...} />`, the dot animates a single scale/opacity pulse whenever `trigger` changes — driven by Socket.IO `check.completed` events.

This strip appears on Landing (hero), Dashboard (per-monitor row), MonitorDetail (large hero), Public Status Page (giant per-service). One idea, four scales.

## Motion — Framer Motion only

- Page enter: `opacity + y:8 → 0`, 240ms `ease-out-quart`, stagger children 40ms.
- Route change: 180ms crossfade.
- Live pulse: 1.2s scale 1 → 2.6 with opacity 0.7 → 0.
- Number updates: 120ms crossfade digit swap (tabular figures prevent CLS).
- No decorative hover motion elsewhere.
- All motion is off when `prefers-reduced-motion: reduce`.

## Reference — cross-pollination

- Better Stack / Cronitor — uptime bar concept (sharpened here).
- Linear — table density on data-heavy views.
- Vercel / Rauno.me editorial — hairline monochrome discipline (warmed here).
- Anthropic — editorial serif display used sparingly.

**Explicitly not used**: neobrutalism, glassmorphism, generic template kits, purple/indigo gradients.

## Anti-slop checklist (revisit before shipping)

- [ ] No purple/indigo gradient accents
- [ ] No glassmorphism / frosted panels
- [ ] No drop shadows on cards
- [ ] No generic centered gradient hero
- [ ] Stat cards visually differentiated by data shape
- [ ] Three type families in play (serif / sans / mono)
- [ ] Everything sharp (0 radius) or it's a true circle
