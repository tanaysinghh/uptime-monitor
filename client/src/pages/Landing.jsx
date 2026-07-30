import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { GetStartedButton } from "../components/ui/GetStartedButton";
import {
  Activity,
  Zap,
  Shield,
  Globe,
  BarChart3,
  Bell,
  Clock,
  Users,
  Key,
  Wrench,
  CheckCircle,
  XCircle,
  ChevronDown,
  ArrowRight,
  Star,
  Sparkles,
  Layers,
  Terminal,
  HeartPulse,
  Menu,
  X,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <nav
      className={
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 " +
        (scrolled
          ? "bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50 shadow-lg shadow-black/20"
          : "bg-transparent")
      }
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link to="/" className="flex items-center gap-2">
            <Activity className="w-7 h-7 text-emerald-500" />
            <span className="text-lg font-bold text-white">UptimeMonitor</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors"
            >
              Sign In
            </Link>
            <Link to="/register">
              <GetStartedButton>Get Started Free</GetStartedButton>
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="md:hidden pb-6 space-y-4"
          >
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-gray-400 hover:text-white py-2"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
              <Link to="/login" className="text-sm text-gray-400 hover:text-white py-2">
                Sign In
              </Link>
              <Link to="/register">
                <GetStartedButton className="w-full justify-center">Get Started Free</GetStartedButton>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-gray-950" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm text-emerald-400 mb-6"
            >
              <Sparkles className="w-4 h-4" />
              Trusted by developers worldwide
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight"
            >
              Never Miss a
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400"> Downtime </span>
              Again
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-gray-400 mt-6 max-w-lg leading-relaxed"
            >
              Monitor your APIs, websites, and cron jobs every 30 seconds. Get instant alerts on Slack, Discord, or webhooks. Share beautiful status pages with your users.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-4 mt-8"
            >
              <Link to="/register">
                <GetStartedButton>Start Monitoring Free</GetStartedButton>
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-all duration-300 hover:-translate-y-0.5"
              >
                See How It Works
                <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex items-center gap-6 mt-10 text-sm text-gray-500"
            >
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-emerald-500" /> No credit card</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-emerald-500" /> 30-second checks</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-emerald-500" /> Unlimited monitors</span>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-2xl blur-xl" />
              <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-gray-500 ml-2">UptimeMonitor Dashboard</span>
                </div>
                <div className="space-y-3">
                  {[
                    { name: "Production API", status: "up", time: "45ms", uptime: "99.99%" },
                    { name: "Payment Service", status: "up", time: "120ms", uptime: "99.95%" },
                    { name: "Auth Server", status: "up", time: "38ms", uptime: "100%" },
                    { name: "CDN Endpoint", status: "down", time: "—", uptime: "98.2%" },
                    { name: "Database Backup", status: "up", time: "210ms", uptime: "99.8%" },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.1 }}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={"w-2 h-2 rounded-full " + (item.status === "up" ? "bg-emerald-500" : "bg-red-500")} />
                        <span className="text-sm text-gray-300">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{item.time}</span>
                        <span className={item.status === "up" ? "text-emerald-400" : "text-red-400"}>{item.uptime}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  const stats = [
    { value: "10M+", label: "Health checks performed" },
    { value: "99.9%", label: "Platform uptime" },
    { value: "30s", label: "Check intervals" },
    { value: "500+", label: "Monitors tracked" },
  ];

  return (
    <section className="relative py-16 border-y border-gray-800/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProblemSolution() {
  const oldWay = [
    { icon: XCircle, text: "Manually checking if services are running" },
    { icon: XCircle, text: "Finding out about outages from angry users" },
    { icon: XCircle, text: "No visibility into response time degradation" },
    { icon: XCircle, text: "Scattered monitoring across multiple tools" },
  ];

  const newWay = [
    { icon: CheckCircle, text: "Automated checks every 30 seconds" },
    { icon: CheckCircle, text: "Instant alerts before users notice" },
    { icon: CheckCircle, text: "p95/p99 latency tracking in real-time" },
    { icon: CheckCircle, text: "One dashboard for all your services" },
  ];

  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white">There's a Better Way</h2>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto">Stop firefighting outages. Start preventing them.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-sm text-red-400 mb-6">
              <XCircle className="w-4 h-4" />
              The Old Way
            </div>
            <div className="space-y-4">
              {oldWay.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <item.icon className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  <span className="text-gray-400">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/20 rounded-2xl p-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm text-emerald-400 mb-6">
              <CheckCircle className="w-4 h-4" />
              The UptimeMonitor Way
            </div>
            <div className="space-y-4">
              {newWay.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <item.icon className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-gray-300">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    { icon: Zap, title: "30-Second Health Checks", description: "Monitor every endpoint at blazing speed. Know about issues before your users do." },
    { icon: HeartPulse, title: "Heartbeat Monitoring", description: "Dead man's switch for cron jobs. If your job doesn't ping in, we alert you instantly." },
    { icon: Shield, title: "SSL Certificate Tracking", description: "Automatic SSL expiry detection. Get warned 14 days before certificates expire." },
    { icon: Globe, title: "Public Status Pages", description: "Branded, shareable status pages with 90-day uptime bars and incident history." },
    { icon: Bell, title: "Multi-Channel Alerts", description: "Slack, Discord, webhooks, and email. Get notified wherever your team works." },
    { icon: BarChart3, title: "p95/p99 Latency Metrics", description: "Go beyond averages. Track percentile latencies that reveal real user experience." },
    { icon: Terminal, title: "Response Assertions", description: "Validate response bodies with JSON path checks, string matching, and status codes." },
    { icon: Wrench, title: "Maintenance Windows", description: "Schedule downtime without false alerts. Status page shows maintenance, not outages." },
    { icon: Users, title: "Team Management", description: "Invite members with role-based access. Full audit log of every action taken." },
    { icon: Key, title: "API Key Access", description: "Manage monitors programmatically. SHA-256 hashed keys with granular permissions." },
    { icon: Layers, title: "Incident Timeline", description: "Auto-created incidents after consecutive failures. Auto-resolved on recovery." },
    { icon: Clock, title: "Data Retention", description: "90 days of check history with automatic cleanup. No manual maintenance needed." },
  ];

  return (
    <section id="features" className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Everything You Need to Stay Online
          </h2>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
            A complete monitoring platform with real-time alerts, analytics, and team collaboration built in.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={i}
                variants={fadeInUp}
                transition={{ duration: 0.5 }}
                className="group bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-emerald-500/30 hover:bg-gray-900/80 transition-all duration-300"
              >
                <div className="p-3 bg-emerald-500/10 rounded-lg w-fit mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Add Your Endpoints",
      description: "Enter the URLs you want to monitor. Configure check intervals, expected status codes, and response assertions.",
      icon: Terminal,
    },
    {
      number: "02",
      title: "We Monitor 24/7",
      description: "Our engine pings your services every 30 seconds. SSL certs are checked, response bodies are validated, latency is tracked.",
      icon: Activity,
    },
    {
      number: "03",
      title: "Stay Informed Instantly",
      description: "Get alerts on Slack, Discord, or webhooks the moment something goes wrong. Share a public status page with your users.",
      icon: Bell,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-gray-900/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white">How It Works</h2>
          <p className="text-gray-400 mt-4">Three simple steps to complete monitoring coverage</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.2, duration: 0.6 }}
                viewport={{ once: true }}
                className="relative text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-6">
                  <Icon className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="text-xs font-bold text-emerald-500 mb-2">STEP {step.number}</div>
                <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] border-t border-dashed border-gray-800" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const plans = [
    {
      name: "Starter",
      price: "Free",
      period: "",
      description: "Perfect for side projects",
      features: ["5 monitors", "5-minute checks", "1 alert channel", "Public status page", "7-day data retention"],
      cta: "Get Started",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "$19",
      period: "/month",
      description: "For growing teams",
      features: ["50 monitors", "30-second checks", "Unlimited alert channels", "Public status page", "90-day data retention", "Team management (5 seats)", "API access", "Heartbeat monitoring"],
      cta: "Start Free Trial",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations",
      features: ["Unlimited monitors", "30-second checks", "Unlimited alert channels", "Custom branded status page", "1-year data retention", "Unlimited team seats", "Full API access", "Priority support", "SLA guarantees"],
      cta: "Contact Sales",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Simple, Transparent Pricing</h2>
          <p className="text-gray-400 mt-4">Start free. Upgrade when you need more.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              viewport={{ once: true }}
              className={
                "relative rounded-2xl p-8 " +
                (plan.highlighted
                  ? "bg-gradient-to-b from-emerald-500/10 to-gray-900 border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/5"
                  : "bg-gray-900/50 border border-gray-800")
              }
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-black text-xs font-bold rounded-full">
                  MOST POPULAR
                </div>
              )}
              <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
              <div className="mt-6 mb-8">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-gray-500">{plan.period}</span>
              </div>
              <div className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
              <Link to="/register" className="block">
                <GetStartedButton
                  className={
                    "w-full justify-center " +
                    (plan.highlighted ? "" : "bg-gray-800 hover:bg-gray-800 border border-gray-700")
                  }
                >
                  {plan.cta}
                </GetStartedButton>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      q: "Is UptimeMonitor right for my use case?",
      a: "If you run any APIs, websites, or scheduled jobs that need to stay online, yes. UptimeMonitor works for solo developers, startups, and enterprise teams alike.",
    },
    {
      q: "How fast will I know about an outage?",
      a: "With 30-second check intervals and instant alerting to Slack, Discord, or webhooks, you'll typically know within 90 seconds of a service going down (after 3 consecutive failures to avoid false alarms).",
    },
    {
      q: "Do I need technical experience to set it up?",
      a: "Not at all. Add a URL, pick a check interval, and you're monitoring. For advanced use cases like response body assertions or heartbeat monitoring, we provide clear docs.",
    },
    {
      q: "What happens if UptimeMonitor itself goes down?",
      a: "We monitor our own infrastructure with redundant systems. Our platform maintains 99.99% uptime with automated failover.",
    },
    {
      q: "Can I share status with my customers?",
      a: "Yes. Every organization gets a public status page with a unique URL showing 90-day uptime bars, current status, and incident history. Visitors can subscribe to updates.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Absolutely. No contracts, no hidden fees. You can downgrade or cancel at any time from your account settings.",
    },
  ];

  return (
    <section id="faq" className="py-24 bg-gray-900/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Frequently Asked Questions</h2>
          <p className="text-gray-400 mt-4">Got questions? We've got answers.</p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              viewport={{ once: true }}
              className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-medium text-white pr-4">{faq.q}</span>
                <ChevronDown
                  className={
                    "w-5 h-5 text-gray-500 shrink-0 transition-transform duration-300 " +
                    (openIndex === i ? "rotate-180" : "")
                  }
                />
              </button>
              {openIndex === i && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3 }}
                  className="px-5 pb-5"
                >
                  <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-gray-900 to-cyan-500/10 border border-emerald-500/20 rounded-3xl p-12 sm:p-16 text-center"
        >
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Stop Worrying About Downtime?
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
              Join developers who sleep better knowing their services are monitored 24/7.
            </p>
            <Link to="/register">
              <GetStartedButton>Start Monitoring for Free</GetStartedButton>
            </Link>
            <p className="text-xs text-gray-500 mt-4">No credit card required. Set up in under 2 minutes.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-800 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-emerald-500" />
              <span className="font-bold text-white">UptimeMonitor</span>
            </div>
            <p className="text-sm text-gray-500">Open-source API monitoring built for developers.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-3">Product</h4>
            <div className="space-y-2">
              <a href="#features" className="block text-sm text-gray-500 hover:text-gray-300">Features</a>
              <a href="#pricing" className="block text-sm text-gray-500 hover:text-gray-300">Pricing</a>
              <a href="#how-it-works" className="block text-sm text-gray-500 hover:text-gray-300">How It Works</a>
              <a href="#faq" className="block text-sm text-gray-500 hover:text-gray-300">FAQ</a>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-3">Resources</h4>
            <div className="space-y-2">
              <span className="block text-sm text-gray-500">Documentation</span>
              <span className="block text-sm text-gray-500">API Reference</span>
              <span className="block text-sm text-gray-500">Status Page</span>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-3">Legal</h4>
            <div className="space-y-2">
              <span className="block text-sm text-gray-500">Privacy Policy</span>
              <span className="block text-sm text-gray-500">Terms of Service</span>
              <span className="block text-sm text-gray-500">MIT License</span>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">2026 UptimeMonitor. All rights reserved.</p>
          <p className="text-sm text-gray-600">Built with care for developers</p>
        </div>
      </div>
    </footer>
  );
}

const Landing = () => {
  return (
    <div className="bg-gray-950 text-gray-100">
      <Navbar />
      <HeroSection />
      <SocialProof />
      <ProblemSolution />
      <FeaturesSection />
      <HowItWorks />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default Landing;