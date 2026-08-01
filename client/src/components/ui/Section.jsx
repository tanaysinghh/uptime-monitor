import { cn } from "../../lib/utils";

// Page section with an editorial header — small label above serif title.
export const PageHeader = ({ eyebrow, title, description, actions, className }) => (
  <header className={cn("flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-6 hairline-b mb-8", className)}>
    <div>
      {eyebrow && (
        <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted mb-2">
          {eyebrow}
        </div>
      )}
      <h1 className="font-display text-xl md:text-2xl leading-none text-ink">{title}</h1>
      {description && (
        <p className="text-sm text-muted mt-2 max-w-xl">{description}</p>
      )}
    </div>
    {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
  </header>
);

// Section header for internal groupings inside a page.
export const SectionHeader = ({ title, description, actions, eyebrow, className }) => (
  <div className={cn("flex items-end justify-between gap-4 mb-4", className)}>
    <div>
      {eyebrow && (
        <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted mb-1">{eyebrow}</div>
      )}
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      {description && <p className="text-xs text-muted mt-1">{description}</p>}
    </div>
    {actions && <div>{actions}</div>}
  </div>
);
