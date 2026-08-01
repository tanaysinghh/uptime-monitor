import { cn } from "../../lib/utils";

// Semantic status indicator. Color + shape + label available — never color alone.
// status: "up" | "down" | "degraded" | "maintenance" | "pending" | "paused"
const statusMap = {
  up:          { bg: "bg-st-up",       label: "Operational" },
  down:        { bg: "bg-st-down",     label: "Down" },
  degraded:    { bg: "bg-st-degraded", label: "Degraded" },
  maintenance: { bg: "bg-st-maint",    label: "Maintenance" },
  paused:      { bg: "bg-muted",       label: "Paused" },
  pending:     { bg: "bg-bone-strong", label: "Pending" },
};

export const StatusDot = ({ status = "pending", size = "md", className }) => {
  const conf = statusMap[status] || statusMap.pending;
  const sizeClass = size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-3 h-3" : "w-2 h-2";
  return (
    <span
      role="img"
      aria-label={conf.label}
      className={cn(
        "inline-block rounded-full shrink-0",
        sizeClass,
        conf.bg,
        className
      )}
    />
  );
};

export const StatusLabel = ({ status = "pending", className }) => {
  const conf = statusMap[status] || statusMap.pending;
  const textColor = {
    up:          "text-st-up",
    down:        "text-st-down",
    degraded:    "text-st-degraded",
    maintenance: "text-st-maint",
    paused:      "text-muted",
    pending:     "text-muted",
  }[status] || "text-muted";
  return <span className={cn("text-xs font-medium uppercase tracking-wider", textColor, className)}>{conf.label}</span>;
};

// eslint-disable-next-line react-refresh/only-export-components
export { statusMap };
