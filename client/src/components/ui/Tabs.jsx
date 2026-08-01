import { cn } from "../../lib/utils";

// Sharp segmented control — ink fills the active tab.
export const Tabs = ({ value, onChange, options, ariaLabel = "Tabs", className }) => (
  <div className={cn("inline-flex hairline bg-paper", className)} role="tablist" aria-label={ariaLabel}>
    {options.map((opt, i) => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value}
          role="tab"
          aria-selected={active}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-4 h-9 text-xs font-num uppercase tracking-wider transition-colors flex items-center gap-2",
            i > 0 && "hairline-l",
            active ? "bg-ink text-paper" : "text-muted hover:text-ink"
          )}
        >
          {opt.label}
          {opt.count != null && (
            <span className={cn("font-num", active ? "text-paper/70" : "text-muted")}>
              {opt.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
