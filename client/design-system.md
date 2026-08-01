# Uptime Monitor — Design System

The product's identity is *precise engineering instrument*: monochrome-warm, editorial-technical, with a single reserved color for live moments. Trust before excitement. Numbers are the hero.

## Palette

### Core (used everywhere)
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--color-ink` | `#0E0E10` | `#F0EBE0` | Text, primary buttons, icons |
| `--color-paper` | `#F4EFE6` | `#14130F` | Page background (warm cream, not white) |
| `--color-bone` | `#EAE3D2` | `#24221D` | Hairline borders, subtle surfaces |
| `--color-bone-strong` | `#D8D0BC` | `#37342C` | Dividers, no-data bars |
| `--color-muted` | `#6B655A` | `#8A8477` | Secondary text, timestamps |
| `--color-pulse` | `#E85D2F` | `#E85D2F` | **Reserved.** Live-check pulse, focus rings, brand mark accent |

### Semantic status — used **only** in status contexts
| Token | Value | Meaning |
|---|---|---|
| `--color-st-up` | `#2E6B4E` | Operational / healthy |
| `--color-st-degraded` | `#C7902D` | Degraded / slow |
| `--color-st-down` | `#B23A2A` | Incident / down |
| `--color-st-maint` | `#4A5560` | Maintenance / no data |

**Rule:** amber `#C7902D` means *degraded* and nothing else. Brick red `#B23A2A` means *incident* and nothing else. Pulse orange `#E85D2F` is never used for status. Every status color is accompanied by an icon or label — never color alone.

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
