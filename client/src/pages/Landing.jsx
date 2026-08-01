import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "../components/ui/button";
import { UptimeStrip } from "../components/ui/UptimeStrip";
import { StatusDot } from "../components/ui/StatusDot";
import { LivePulse } from "../components/ui/LivePulse";
import { Brandmark, Wordmark } from "../components/ui/Brand";
import {
  ArrowRight, Zap, Shield, Globe, BarChart3, Bell, Clock,
  Users, Key, Wrench, CheckCircle2, XCircle, ChevronDown,
  Terminal, HeartPulse, Menu, X, Layers,
} from "lucide-react";

// ==============================================================
// Nav
// ==============================================================
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#features",     label: "Features" },
    { href: "#how-it-works", label: "How it works" },
    { href: "#faq",          label: "FAQ" },
  ];

  return (
    <nav
      className={
        "fixed top-0 left-0 right-0 z-50 transition-colors " +
        (scrolled ? "bg-paper/95 backdrop-blur hairline-b" : "bg-transparent")
      }
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center">
            <Wordmark />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-muted hover:text-ink transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Button variant="text" size="sm" asChild><Link to="/login">Sign in</Link></Button>
            <Button size="sm" asChild><Link to="/register">Start free <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} /></Link></Button>
          </div>

          <button
            onClick={() => setOpen((o) => !o)}
            className="md:hidden p-2 text-ink"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="md:hidden pb-6">
            <div className="flex flex-col gap-1 hairline-t pt-3">
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm text-muted hover:text-ink py-2">
                  {l.label}
                </a>
              ))}
              <div className="flex gap-2 pt-3">
                <Button variant="ghost" size="sm" asChild className="flex-1 justify-center"><Link to="/login">Sign in</Link></Button>
                <Button size="sm" asChild className="flex-1 justify-center"><Link to="/register">Start free</Link></Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </nav>
  );
}

// ==============================================================
// Hero
// ==============================================================
function Hero() {
  const reduce = useReducedMotion();
  const [pulseTrigger, setPulseTrigger] = useState(0);

  // Fake but plausible uptime data — one small dip 30d ago, one degraded window 8d ago.
  const uptimeSeed = useMemo(() => Array.from({ length: 90 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (89 - i));
    const iso = d.toISOString().split("T")[0];
    let pct = 100;
    if (i === 60) pct = 91;
    if (i === 82) pct = 96;
    if (i === 83) pct = 97;
    return { date: iso, uptimePercentage: pct };
  }), []);

  // Fake live check every 4s to demo the pulse
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setPulseTrigger((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={reduce ? {} : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          className="font-display text-ink text-center leading-[0.95] mb-16 md:mb-24 text-[40px] sm:text-[52px] lg:text-[64px]"
        >
          Uptime Monitor
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7">
            <motion.div
              initial={reduce ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
              className="text-[10px] font-num uppercase tracking-[0.2em] text-muted mb-6"
            >
              An engineering instrument · v1.0
            </motion.div>

            <motion.h1
              initial={reduce ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06 }}
              className="font-display leading-[0.98] text-ink text-[44px] sm:text-[64px] lg:text-[88px]"
            >
              Watch your
              <br />
              <em className="text-ink">services breathe</em>.
            </motion.h1>

            <motion.p
              initial={reduce ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="text-base text-muted mt-8 max-w-lg leading-relaxed"
            >
              30-second checks. p95/p99 latency. Sharp public status pages. Alerts that fire only when they should.
              Built like an instrument, not a dashboard.
            </motion.p>

            <motion.div
              initial={reduce ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" asChild>
                <Link to="/register">Start monitoring — free <ArrowRight className="w-4 h-4" strokeWidth={2} /></Link>
              </Button>
              <Button variant="ghost" size="lg" asChild>
                <a href="#how-it-works">See how it works</a>
              </Button>
            </motion.div>

            <motion.div
              initial={reduce ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.28 }}
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-num uppercase tracking-wider text-muted"
            >
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-st-up" strokeWidth={2} /> No credit card</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-st-up" strokeWidth={2} /> 30s checks</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-st-up" strokeWidth={2} /> Open source</span>
            </motion.div>
          </div>

          {/* Live demo card — not a fake browser screenshot, an actual UptimeStrip. */}
          <motion.div
            initial={reduce ? {} : { opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className="lg:col-span-5"
          >
            <div className="hairline bg-paper p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">Production API</div>
                  <div className="font-num text-lg text-ink mt-0.5">api.example.com/health</div>
                </div>
                <LivePulse trigger={pulseTrigger} />
              </div>
              <UptimeStrip uptimeDays={uptimeSeed} size="lg" days={90} />
              <div className="grid grid-cols-3 gap-4 mt-6 hairline-t pt-5">
                {[
                  { label: "Uptime · 90d", value: "99.87%" },
                  { label: "Response", value: "142ms" },
                  { label: "p95", value: "310ms" },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="text-[10px] font-num uppercase tracking-wider text-muted">{m.label}</div>
                    <div className="font-num text-base text-ink mt-1">{m.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 hairline-t pt-4 space-y-2">
                {[
                  { name: "Auth Server",     status: "up",       ms: "38ms",  up: "100%" },
                  { name: "Payment Service", status: "up",       ms: "120ms", up: "99.95%" },
                  { name: "CDN Endpoint",    status: "degraded", ms: "410ms", up: "98.2%" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <StatusDot status={s.status} />
                      <span className="text-ink">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3 font-num text-muted text-xs">
                      <span>{s.ms}</span>
                      <span className={s.status === "up" ? "text-st-up" : "text-st-degraded"}>{s.up}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ==============================================================
// Marquee-ish stats strip (mono, dense)
// ==============================================================
function Numbers() {
  const stats = [
    { value: "10M+", label: "Health checks run" },
    { value: "99.9%", label: "Platform uptime" },
    { value: "30s",  label: "Check cadence" },
    { value: "500+", label: "Monitors tracked" },
  ];
  return (
    <section className="hairline-t hairline-b py-14">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.value}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              viewport={{ once: true }}
              className={i > 0 ? "md:hairline-l md:pl-8" : ""}
            >
              <div className="font-num text-3xl text-ink">{s.value}</div>
              <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted mt-2">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ==============================================================
// Problem/Solution — hairline paired columns, no gradient washes
// ==============================================================
function Contrast() {
  const oldWay = [
    "Manually checking if services are up",
    "Finding out about outages from users",
    "No visibility into latency degradation",
    "Scattered monitoring across tools",
  ];
  const newWay = [
    "Automated checks every 30 seconds",
    "Instant alerts before users notice",
    "p95 / p99 latency in real time",
    "One instrument for every endpoint",
  ];
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <div className="text-[10px] font-num uppercase tracking-[0.2em] text-muted mb-3">There's a better way</div>
          <h2 className="font-display text-4xl md:text-5xl leading-[1.02] text-ink">
            Stop firefighting. <em>Start preventing.</em>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-0 hairline">
          <div className="p-8 md:p-10 hairline-b md:hairline-b-0 md:hairline-r">
            <div className="inline-flex items-center gap-2 text-[10px] font-num uppercase tracking-[0.15em] text-st-down mb-6">
              <XCircle className="w-3 h-3" strokeWidth={2} /> The old way
            </div>
            <ul className="space-y-3">
              {oldWay.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-muted">
                  <span className="w-3 h-[1px] bg-st-down mt-2.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-8 md:p-10">
            <div className="inline-flex items-center gap-2 text-[10px] font-num uppercase tracking-[0.15em] text-st-up mb-6">
              <CheckCircle2 className="w-3 h-3" strokeWidth={2} /> With Uptime Monitor
            </div>
            <ul className="space-y-3">
              {newWay.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-ink">
                  <span className="w-3 h-[1px] bg-st-up mt-2.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ==============================================================
// Features — mono grid
// ==============================================================
function Features() {
  const items = [
    { icon: Zap,         title: "30-second health checks", desc: "Every endpoint, on the second. Know before your users do." },
    { icon: HeartPulse,  title: "Heartbeat monitoring",    desc: "Dead man's switch for cron jobs. If it doesn't ping in, we alert." },
    { icon: Shield,      title: "SSL certificate tracking", desc: "Automatic expiry detection. Fourteen days of warning." },
    { icon: Globe,       title: "Public status pages",     desc: "Branded, shareable. 90-day uptime bars. Incident history." },
    { icon: Bell,        title: "Multi-channel alerts",    desc: "Slack, Discord, webhooks, email. Wherever the team lives." },
    { icon: BarChart3,   title: "p95 / p99 latency",       desc: "Beyond averages. Percentile latencies that reveal reality." },
    { icon: Terminal,    title: "Response assertions",     desc: "JSON path, string match, status codes. Validate more than 200." },
    { icon: Wrench,      title: "Maintenance windows",     desc: "Schedule downtime without false alerts." },
    { icon: Users,       title: "Team management",         desc: "Roles, invitations, full audit log of every action." },
    { icon: Key,         title: "API key access",          desc: "SHA-256 hashed keys with granular permissions." },
    { icon: Layers,      title: "Incident timeline",       desc: "Auto-created after N failures. Auto-resolved on recovery." },
    { icon: Clock,       title: "Data retention",          desc: "90 days of check history with automatic cleanup." },
  ];
  return (
    <section id="features" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <div className="text-[10px] font-num uppercase tracking-[0.2em] text-muted mb-3">Feature set</div>
          <h2 className="font-display text-4xl md:text-5xl leading-[1.02] text-ink">
            Everything you need to <em>stay online</em>.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 hairline">
          {items.map((f, i) => {
            const Icon = f.icon;
            const col = i % 3;
            const row = Math.floor(i / 3);
            return (
              <div
                key={f.title}
                className={
                  "p-6 md:p-8 " +
                  ((col > 0 ? "lg:hairline-l " : "") +
                    (col > 0 ? "md:hairline-l " : "") +
                    (row > 0 ? "hairline-t " : ""))
                }
              >
                <Icon className="w-4 h-4 text-ink mb-6" strokeWidth={1.5} />
                <h3 className="text-base text-ink mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ==============================================================
// How it works — three steps
// ==============================================================
function HowItWorks() {
  const steps = [
    { n: "01", title: "Point us at an endpoint", desc: "URL, method, interval, expected status. That's it." },
    { n: "02", title: "We check every 30 seconds", desc: "SSL, response bodies, latency percentiles — all tracked." },
    { n: "03", title: "You hear only when it matters", desc: "Slack, Discord, webhooks, email. Cooldowns and dedup baked in." },
  ];
  return (
    <section id="how-it-works" className="py-24 hairline-t hairline-b bg-bone/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <div className="text-[10px] font-num uppercase tracking-[0.2em] text-muted mb-3">Workflow</div>
          <h2 className="font-display text-4xl md:text-5xl leading-[1.02] text-ink">Three steps. Then quiet.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-0 hairline bg-paper">
          {steps.map((s, i) => (
            <div key={s.n} className={"p-8 md:p-10 " + (i > 0 ? "md:hairline-l hairline-t md:hairline-t-0" : "")}>
              <div className="font-num text-3xl text-pulse mb-6">{s.n}</div>
              <h3 className="font-display text-xl text-ink mb-3">{s.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ==============================================================
// FAQ
// ==============================================================
function FAQ() {
  const [open, setOpen] = useState(null);
  const faqs = [
    { q: "Is Uptime Monitor right for me?", a: "If you run APIs, sites, or cron jobs that need to stay up — yes. Works equally well for a single side project or a fleet of hundreds of services." },
    { q: "How fast will I know about an outage?", a: "With 30-second checks and instant alerting to Slack/Discord/webhooks, typically within 90 seconds (three consecutive failures to suppress flaps)." },
    { q: "Do I need technical experience to set up?", a: "No. Add a URL, pick an interval — you're monitoring. Response body assertions and heartbeats are documented if you want to go deeper." },
    { q: "What if Uptime Monitor itself goes down?", a: "Redundant checkers across regions with automated failover. We publish our own status page." },
    { q: "Can I share status with my customers?", a: "Yes — every workspace gets a public status page with 90-day uptime bars and incident history. Visitors can subscribe to email updates." },
    { q: "Can I cancel anytime?", a: "No contracts. Downgrade or cancel from settings at any time." },
  ];
  return (
    <section id="faq" className="py-24 hairline-t">
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-12">
          <div className="text-[10px] font-num uppercase tracking-[0.2em] text-muted mb-3">Questions</div>
          <h2 className="font-display text-4xl md:text-5xl leading-[1.02] text-ink">Frequently asked.</h2>
        </div>
        <div className="hairline">
          {faqs.map((f, i) => (
            <div key={f.q} className={i > 0 ? "hairline-t" : ""}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-5 text-left hover:bg-bone/40 transition-colors"
                aria-expanded={open === i}
              >
                <span className="text-base text-ink pr-4">{f.q}</span>
                <ChevronDown className={"w-4 h-4 text-muted shrink-0 transition-transform " + (open === i ? "rotate-180" : "")} strokeWidth={1.8} />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm text-muted leading-relaxed max-w-2xl">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ==============================================================
// Final CTA
// ==============================================================
function FinalCTA() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-6">
        <div className="hairline bg-ink text-paper p-12 md:p-16 text-center relative overflow-hidden">
          <div className="absolute top-6 right-6">
            <LivePulse trigger={0} label="LIVE" className="text-paper/60" />
          </div>
          <div className="text-[10px] font-num uppercase tracking-[0.2em] text-paper/50 mb-4">Ready when you are</div>
          <h2 className="font-display text-4xl md:text-6xl text-paper leading-[1] mb-6">
            <em>Sleep better</em>.<br/>Start monitoring today.
          </h2>
          <p className="text-paper/70 text-base mb-10 max-w-md mx-auto">
            No credit card. Five monitors free forever. Set up in under two minutes.
          </p>
          <Link to="/register">
            <button className="h-12 px-8 bg-pulse text-paper hover:bg-paper hover:text-ink transition-colors text-sm font-medium inline-flex items-center gap-2">
              Start monitoring — free <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ==============================================================
// Footer
// ==============================================================
function Footer() {
  return (
    <footer className="hairline-t py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <Wordmark />
            <p className="text-xs text-muted mt-4 max-w-xs">Open-source uptime monitoring built for developers.</p>
          </div>
          <div>
            <h4 className="text-[10px] font-num uppercase tracking-[0.15em] text-muted mb-3">Product</h4>
            <div className="space-y-2">
              <a href="#features" className="block text-sm text-ink/70 hover:text-ink">Features</a>
              <a href="#how-it-works" className="block text-sm text-ink/70 hover:text-ink">How it works</a>
              <a href="#faq" className="block text-sm text-ink/70 hover:text-ink">FAQ</a>
            </div>
          </div>
          <div>
            <h4 className="text-[10px] font-num uppercase tracking-[0.15em] text-muted mb-3">Resources</h4>
            <div className="space-y-2 text-sm text-muted">
              <span className="block">Documentation</span>
              <span className="block">API reference</span>
              <span className="block">Status page</span>
            </div>
          </div>
          <div>
            <h4 className="text-[10px] font-num uppercase tracking-[0.15em] text-muted mb-3">Legal</h4>
            <div className="space-y-2 text-sm text-muted">
              <span className="block">Privacy</span>
              <span className="block">Terms</span>
              <span className="block">MIT license</span>
            </div>
          </div>
        </div>
        <div className="hairline-t pt-6 flex flex-col sm:flex-row justify-between gap-2 text-[10px] font-num uppercase tracking-[0.15em] text-muted">
          <span>© {new Date().getFullYear()} Uptime Monitor</span>
          <span>Built with care for developers</span>
        </div>
      </div>
    </footer>
  );
}

// ==============================================================
// Root
// ==============================================================
const Landing = () => (
  <div className="bg-paper text-ink min-h-screen">
    <Nav />
    <Hero />
    <Numbers />
    <Contrast />
    <Features />
    <HowItWorks />
    <FAQ />
    <FinalCTA />
    <Footer />
  </div>
);

export default Landing;
