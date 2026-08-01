import { useReducedMotion, motion } from "framer-motion";
import { cn } from "../../lib/utils";

/**
 * A small "live" indicator: labeled dot in --pulse orange.
 * When `trigger` value changes, the dot does a single scale+opacity pulse.
 * The `trigger` value itself is used as the animation key so each change
 * remounts the motion element — no effect / setState needed.
 *
 * Respects prefers-reduced-motion: shows a static dot only, no animation.
 */
export const LivePulse = ({ trigger = 0, label = "LIVE", className }) => {
  const reduce = useReducedMotion();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[10px] font-num uppercase tracking-wider text-muted",
        className
      )}
      aria-live="polite"
    >
      <span className="relative inline-flex w-2 h-2">
        <span className="absolute inset-0 rounded-full bg-pulse" />
        {!reduce && (
          <motion.span
            key={trigger}
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 2.6, opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.25, 1, 0.5, 1] }}
            className="absolute inset-0 rounded-full bg-pulse"
          />
        )}
      </span>
      <span>{label}</span>
    </span>
  );
};
