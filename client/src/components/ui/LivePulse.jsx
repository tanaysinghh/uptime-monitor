import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";

/**
 * A small "live" indicator: labeled dot in --pulse orange.
 * When `trigger` value changes, the dot does a single scale+opacity pulse.
 *
 * Respects prefers-reduced-motion: shows a static ring instead of animating.
 */
export const LivePulse = ({ trigger = 0, label = "LIVE", className }) => {
  const reduce = useReducedMotion();
  const [pulseKey, setPulseKey] = useState(0);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setPulseKey((k) => k + 1);
  }, [trigger]);

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
            key={pulseKey}
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
