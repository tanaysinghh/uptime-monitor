import { useMemo, useState } from "react";
import { cn } from "../../lib/utils";

/**
 * Signature element — 90-day uptime strip.
 *
 * Each day is a 3px-wide vertical bar. Height and color express state:
 *   up        = full-height ink
 *   degraded  = 60% height, degraded amber
 *   down      = 30% height, down brick
 *   no data   = 1px baseline
 *
 * The rightmost bar can render a `pulse` dot above it (used with LivePulse
 * on the parent to signal a fresh check).
 *
 * uptimeDays: [{ date: 'YYYY-MM-DD', uptimePercentage: number|null }]
 */
export const UptimeStrip = ({
  uptimeDays = [],
  days = 90,
  size = "md",
  showLegend = true,
  className,
  ariaLabel,
}) => {
  const bars = useMemo(() => {
    const out = [];
    const byDate = new Map(uptimeDays.map((d) => [d.date, d.uptimePercentage]));
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      const pct = byDate.has(iso) ? byDate.get(iso) : null;
      out.push({ date: iso, pct });
    }
    return out;
  }, [uptimeDays, days]);

  const sizeConf = {
    sm: { h: 24, w: 2, gap: 2 },
    md: { h: 32, w: 3, gap: 2 },
    lg: { h: 56, w: 5, gap: 3 },
  }[size] || { h: 32, w: 3, gap: 2 };

  const [hover, setHover] = useState(null);

  const barState = (pct) => {
    if (pct == null || pct < 0) return { kind: "none", hPct: 6, color: "bg-bone-strong" };
    if (pct >= 99) return { kind: "up", hPct: 100, color: "bg-ink" };
    if (pct >= 95) return { kind: "degraded", hPct: 60, color: "bg-st-degraded" };
    return { kind: "down", hPct: 30, color: "bg-st-down" };
  };

  const overallLabel = ariaLabel || `Uptime over the last ${days} days`;

  return (
    <div className={cn("w-full", className)} role="img" aria-label={overallLabel}>
      <div
        className="flex items-end w-full relative"
        style={{ height: sizeConf.h, gap: sizeConf.gap }}
        onMouseLeave={() => setHover(null)}
      >
        {bars.map((b, i) => {
          const s = barState(b.pct);
          const isToday = i === bars.length - 1;
          return (
            <div
              key={b.date}
              className="relative flex items-end justify-center"
              style={{ flex: 1, minWidth: sizeConf.w, height: sizeConf.h }}
              onMouseEnter={() => setHover({ ...b, ...s, idx: i })}
              tabIndex={-1}
            >
              <div
                className={cn("w-full transition-opacity", s.color, hover && hover.idx !== i && "opacity-40")}
                style={{ height: `${s.hPct}%` }}
                title={`${b.date} — ${b.pct == null ? "No data" : b.pct + "%"}`}
              />
              {isToday && (
                <span
                  data-live-pulse-target
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-pulse"
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>

      {showLegend && (
        <div className="flex items-center justify-between mt-2 text-[10px] font-num uppercase tracking-wider text-muted">
          <span>{days} days ago</span>
          {hover ? (
            <span className="text-ink">
              {hover.date} · {hover.pct == null ? "no data" : hover.pct + "%"}
            </span>
          ) : (
            <span className="opacity-0 select-none">·</span>
          )}
          <span>Today</span>
        </div>
      )}
    </div>
  );
};
