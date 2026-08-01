import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Brandmark } from "./ui/Brand";
import { UptimeStrip } from "./ui/UptimeStrip";

// Two-column shell for Login / Register / MFA challenge.
// Left: brand + editorial serif tagline + a live uptime strip for identity.
// Right: form column, generous whitespace, single-column.
export const AuthShell = ({ eyebrow, title, description, children, footer }) => {
  const reduce = useReducedMotion();

  // A hand-crafted "healthy service" strip for identity — deterministic, not random.
  const seed = Array.from({ length: 90 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (89 - i));
    const iso = d.toISOString().split("T")[0];
    // Two seeded dips make the strip feel real.
    const dip1 = i === 30, dip2 = i === 68;
    return { date: iso, uptimePercentage: dip1 ? 92 : dip2 ? 96 : 100 };
  });

  return (
    <div className="min-h-screen bg-paper text-ink grid lg:grid-cols-2">
      {/* Left rail — identity */}
      <aside className="hidden lg:flex flex-col justify-between px-16 py-12 hairline-r bg-paper relative overflow-hidden">
        <Link to="/" className="inline-flex items-center gap-3 text-ink" aria-label="Home">
          <Brandmark size={22} />
          <span className="font-display text-xl leading-none">Uptime Monitor</span>
        </Link>

        <div>
          <p className="text-[10px] font-num uppercase tracking-[0.2em] text-muted mb-6">
            An engineering instrument
          </p>
          <h2 className="font-display text-2xl leading-tight text-ink">
            <em>Precision monitoring</em>,<br />
            without the noise.
          </h2>
          <p className="text-sm text-muted mt-6 max-w-sm leading-relaxed">
            30-second checks. p95/p99 latency. Sharp status pages. Alerts that fire only when they should.
          </p>

          <div className="mt-10 pt-6 hairline-t">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">
                Live · production API
              </span>
              <span className="font-num text-xs text-ink">99.94%</span>
            </div>
            <UptimeStrip
              uptimeDays={seed}
              size="sm"
              showLegend={false}
              ariaLabel="Sample uptime — 90 days"
            />
          </div>
        </div>

        <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">
          © {new Date().getFullYear()} · Open source
        </div>
      </aside>

      {/* Right column — form */}
      <main className="flex items-center justify-center px-6 py-12 md:px-16">
        <motion.div
          initial={reduce ? {} : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.35, ease: [0.25, 1, 0.5, 1] }}
          className="w-full max-w-sm"
        >
          {/* Mobile brand */}
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 text-ink mb-10">
            <Brandmark size={20} />
            <span className="font-display text-lg leading-none">Uptime Monitor</span>
          </Link>

          {eyebrow && (
            <div className="text-[10px] font-num uppercase tracking-[0.2em] text-muted mb-3">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-2xl leading-tight text-ink">{title}</h1>
          {description && <p className="text-sm text-muted mt-3">{description}</p>}

          <div className="mt-10">{children}</div>

          {footer && <div className="mt-8 text-sm text-muted">{footer}</div>}
        </motion.div>
      </main>
    </div>
  );
};
