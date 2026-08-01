import { cn } from "../../lib/utils";

// Brandmark: a 6-bar uptime strip echoing the signature element, with a pulse dot.
// Deliberately not an emoji, not an off-the-shelf lucide icon.
export const Brandmark = ({ size = 20, withPulse = true, className }) => {
  const bars = [0.6, 1.0, 0.5, 0.9, 0.4, 0.8];
  const gap = Math.max(1, Math.round(size / 12));
  const barW = Math.max(1, Math.round(size / 10));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {bars.map((h, i) => {
        const totalW = bars.length * barW + (bars.length - 1) * gap;
        const startX = (size - totalW) / 2;
        const x = startX + i * (barW + gap);
        const barH = size * h;
        const y = size - barH;
        return <rect key={i} x={x} y={y} width={barW} height={barH} fill="currentColor" />;
      })}
      {withPulse && (
        <circle
          cx={size - Math.max(2, size / 8)}
          cy={Math.max(2, size / 8)}
          r={Math.max(1.5, size / 12)}
          fill="#E8A15D"
        />
      )}
    </svg>
  );
};

export const Wordmark = ({ className }) => (
  <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
    <Brandmark size={18} />
    <span className="font-display text-lg leading-none tracking-tight">Uptime</span>
    <span className="text-[10px] font-num uppercase tracking-[0.2em] text-muted mt-0.5">MONITOR</span>
  </span>
);
