import { Link } from "react-router-dom";
import { BackgroundPaths } from "../components/ui/BackgroundPaths";
import { Activity, Shield, Zap, Globe, BarChart3, Bell } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Zap,
    title: "30-Second Checks",
    description: "Monitor your APIs every 30 seconds with instant failure detection.",
  },
  {
    icon: Shield,
    title: "SSL Monitoring",
    description: "Get warned 14 days before your SSL certificates expire.",
  },
  {
    icon: Globe,
    title: "Public Status Page",
    description: "Share a branded status page with your users showing 90-day uptime.",
  },
  {
    icon: Bell,
    title: "Real-Time Alerts",
    description: "Instant notifications when your services go down or recover.",
  },
  {
    icon: BarChart3,
    title: "Response Analytics",
    description: "Track response times, uptime percentages, and incident history.",
  },
  {
    icon: Activity,
    title: "Incident Timeline",
    description: "Automatic incident creation and resolution with full audit trail.",
  },
];

const Landing = () => {
  return (
    <div className="bg-gray-950">
      <BackgroundPaths
        title="Uptime Monitor"
        subtitle="Monitor your APIs. Detect outages instantly. Share status with your users. Built for developers who care about reliability."
      >
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/25"
          >
            Get Started Free
            <span className="group-hover:translate-x-1 transition-transform">&#8594;</span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gray-800/50 hover:bg-gray-800 text-gray-300 font-semibold rounded-xl border border-gray-700 transition-all duration-300 hover:-translate-y-0.5"
          >
            Sign In
          </Link>
        </div>
      </BackgroundPaths>

      <div className="max-w-6xl mx-auto px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything you need to stay online
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            A complete monitoring solution with real-time alerts, public status pages, and detailed analytics.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-emerald-500/30 transition-colors duration-300"
              >
                <div className="p-3 bg-emerald-500/10 rounded-lg w-fit mb-4">
                  <Icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Start monitoring in seconds
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            No credit card required. Add your first monitor and start tracking uptime immediately.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-semibold rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/25"
          >
            Create Free Account
            <span>&#8594;</span>
          </Link>
        </motion.div>
      </div>

      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <span className="font-semibold text-white">UptimeMonitor</span>
          </div>
          <p className="text-sm text-gray-500">Built with care for developers</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;