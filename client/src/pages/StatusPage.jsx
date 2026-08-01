import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { motion, useReducedMotion } from "framer-motion";
import { UptimeStrip } from "../components/ui/UptimeStrip";
import { StatusDot } from "../components/ui/StatusDot";
import { LivePulse } from "../components/ui/LivePulse";
import { Button } from "../components/ui/button";
import { Field, Input } from "../components/ui/Field";
import { Loading, ErrorState, Empty } from "../components/ui/States";
import { Brandmark } from "../components/ui/Brand";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Mail, Activity,
} from "lucide-react";

const overallConf = {
  operational:    { label: "All systems operational",  Icon: CheckCircle2,  wash: "bg-st-up-wash",        color: "text-st-up",       accent: "border-st-up" },
  partial_outage: { label: "Partial system outage",    Icon: AlertTriangle, wash: "bg-st-degraded-wash",  color: "text-st-degraded", accent: "border-st-degraded" },
  major_outage:   { label: "Major system outage",      Icon: XCircle,       wash: "bg-st-down-wash",      color: "text-st-down",     accent: "border-st-down" },
};

const StatusPage = () => {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subEmail, setSubEmail] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [pulseTrigger, setPulseTrigger] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get("/api/public/status/" + slug);
        setData(response.data);
        setPulseTrigger((n) => n + 1);
      } catch (err) {
        setError(err.response?.status === 404 ? "Status page not found" : "Failed to load status");
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [slug]);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setSubLoading(true);
    try {
      await axios.post("/api/public/status/" + slug + "/subscribe", { email: subEmail });
      toast.success("Subscribed — you'll receive incident notifications");
      setSubEmail("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to subscribe");
    } finally {
      setSubLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loading label="Loading status" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <ErrorState title={error} description="This status page may have been renamed or moved." />
        </div>
      </div>
    );
  }

  const overall = overallConf[data.overallStatus] || overallConf.operational;
  const { Icon: OverallIcon } = overall;

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Top bar */}
      <header className="hairline-b sticky top-0 bg-paper/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.organization.logoUrl ? (
              <img src={data.organization.logoUrl} alt={data.organization.name} className="h-6" />
            ) : (
              <Brandmark size={20} />
            )}
            <span className="font-display text-lg leading-none">{data.organization.name}</span>
          </div>
          <LivePulse trigger={pulseTrigger} label="LIVE" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        {/* Hero — enormous overall status */}
        <motion.section
          initial={reduce ? {} : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
          className="mb-16"
        >
          <div className="text-[10px] font-num uppercase tracking-[0.2em] text-muted mb-4">
            Status · {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </div>
          <div className={"flex items-start gap-5 " + overall.color}>
            <OverallIcon className="w-10 h-10 shrink-0 mt-1" strokeWidth={1.5} />
            <h1 className={"font-display text-3xl md:text-[64px] leading-none " + overall.color}>
              {overall.label}.
            </h1>
          </div>
          <p className="text-sm font-num uppercase tracking-wider text-muted mt-6">
            Last checked · {new Date().toLocaleTimeString()}
          </p>
        </motion.section>

        {/* Active incidents */}
        {data.activeIncidents.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-xl italic text-ink mb-4 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-st-down" strokeWidth={1.8} />
              Active incidents
            </h2>
            <div className="hairline bg-st-down-wash">
              {data.activeIncidents.map((incident, i) => (
                <div key={incident.id} className={"px-5 py-4 " + (i > 0 ? "hairline-t" : "")}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-ink font-medium">{incident.Monitor?.name}</p>
                    <span className="text-[10px] font-num uppercase tracking-wider text-st-down capitalize">
                      {incident.status}
                    </span>
                  </div>
                  <p className="text-xs font-num text-muted mt-1 inline-flex items-center gap-1.5">
                    <Clock className="w-3 h-3" strokeWidth={2} />
                    Started {new Date(incident.startedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Services */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl italic text-ink">Services</h2>
            <span className="text-[10px] font-num uppercase tracking-wider text-muted">
              90-day uptime
            </span>
          </div>
          {data.monitors.length === 0 ? (
            <Empty icon={Activity} title="No services configured yet." />
          ) : (
            <div className="space-y-8">
              {data.monitors.map((monitor, i) => (
                <motion.div
                  key={monitor.id}
                  initial={reduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: reduce ? 0 : i * 0.03, ease: [0.25, 1, 0.5, 1] }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <StatusDot status={monitor.status} size="md" />
                      <span className="text-base text-ink">{monitor.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-num text-sm text-ink">{monitor.overallUptime}%</div>
                      <div className="text-[10px] font-num uppercase tracking-wider text-muted">
                        {monitor.status === "up" ? "Operational" : monitor.status === "down" ? "Down" : "Pending"}
                      </div>
                    </div>
                  </div>
                  <UptimeStrip uptimeDays={monitor.uptimeDays || []} size="md" days={90} />
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Past incidents */}
        {data.recentIncidents.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-xl italic text-ink mb-4">Past incidents</h2>
            <div className="hairline bg-paper">
              {data.recentIncidents.map((incident, i) => (
                <div key={incident.id} className={"flex items-center justify-between px-5 py-3 " + (i > 0 ? "hairline-t" : "")}>
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{incident.Monitor?.name}</p>
                    <p className="text-[11px] font-num uppercase tracking-wider text-muted">
                      {new Date(incident.startedAt).toLocaleDateString()} · resolved in{" "}
                      {incident.durationSeconds
                        ? Math.floor(incident.durationSeconds / 60) + "m " + (incident.durationSeconds % 60) + "s"
                        : "n/a"}
                    </p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-st-up shrink-0" strokeWidth={1.8} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Subscribe */}
        <section className="hairline bg-paper p-6 md:p-8 mb-12">
          <div className="flex items-center gap-2 mb-2 text-muted">
            <Mail className="w-4 h-4" strokeWidth={1.8} />
            <span className="text-[10px] font-num uppercase tracking-[0.15em]">Notifications</span>
          </div>
          <h3 className="font-display text-2xl text-ink mb-2">Get notified.</h3>
          <p className="text-sm text-muted mb-5 max-w-md">
            One email when a service goes down. One when it recovers. Nothing else.
          </p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
            <Field className="flex-1" htmlFor="sub-email">
              <Input
                id="sub-email"
                type="email"
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </Field>
            <Button type="submit" disabled={subLoading}>{subLoading ? "…" : "Subscribe"}</Button>
          </form>
        </section>

        <footer className="text-[10px] font-num uppercase tracking-[0.15em] text-muted text-center">
          Powered by <span className="text-ink">Uptime Monitor</span>
        </footer>
      </main>
    </div>
  );
};

export default StatusPage;
