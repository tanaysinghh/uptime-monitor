import { cn } from "../../lib/utils";
import { AlertTriangle } from "lucide-react";

// Loading — a small animated bar strip, in the design language, not a spinner.
export const Loading = ({ label = "Loading", className }) => (
  <div className={cn("flex flex-col items-center justify-center py-16 gap-3", className)} role="status">
    <div className="flex items-end gap-[3px] h-6" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] bg-ink"
          style={{
            animation: `um-load 1.1s ${i * 0.12}s ease-in-out infinite`,
            transformOrigin: "bottom",
          }}
        />
      ))}
    </div>
    <span className="text-xs font-num uppercase tracking-wider text-muted">{label}</span>
    <style>{`@keyframes um-load { 0%,100% { height: 6px } 50% { height: 22px } }`}</style>
  </div>
);

// Empty — editorial: display-serif line + secondary text + optional CTA.
export const Empty = ({ title, description, action, icon: Icon, className }) => (
  <div className={cn("hairline bg-paper py-16 px-8 text-center", className)}>
    {Icon && (
      <div className="inline-flex items-center justify-center w-12 h-12 mb-6 hairline bg-paper text-muted">
        <Icon className="w-5 h-5" strokeWidth={1.5} />
      </div>
    )}
    <h3 className="font-display text-xl italic text-ink mb-2">{title}</h3>
    {description && <p className="text-sm text-muted max-w-sm mx-auto">{description}</p>}
    {action && <div className="mt-6 inline-flex">{action}</div>}
  </div>
);

// Error — same voice as Empty but with a subtle down-brick tint.
export const ErrorState = ({ title = "Something went wrong", description, action, className }) => (
  <div className={cn("hairline bg-st-down-wash py-12 px-8 text-center", className)} role="alert">
    <div className="inline-flex items-center justify-center w-12 h-12 mb-4 bg-paper hairline text-st-down">
      <AlertTriangle className="w-5 h-5" strokeWidth={1.5} />
    </div>
    <h3 className="font-display text-xl italic text-ink mb-2">{title}</h3>
    {description && <p className="text-sm text-muted max-w-sm mx-auto">{description}</p>}
    {action && <div className="mt-6 inline-flex">{action}</div>}
  </div>
);
