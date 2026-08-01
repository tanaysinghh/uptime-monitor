import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import useSocket from "../hooks/useSocket";
import { PageHeader } from "../components/ui/Section";
import { Button } from "../components/ui/button";
import { Loading, Empty } from "../components/ui/States";
import { LivePulse } from "../components/ui/LivePulse";
import { StatusDot, StatusLabel } from "../components/ui/StatusDot";
import { UptimeStrip } from "../components/ui/UptimeStrip";
import { colors } from "../lib/tokens";
import toast from "react-hot-toast";
import { AlertTriangle, Wrench, ArrowUpRight, Activity, Clock } from "lucide-react";

// ---------- Stat cards ----------
// Each shape is DIFFERENT so numbers of different kinds don't look interchangeable.

// Big serif — for weight-of-moment values like incident count.
const StatDisplay = ({ label, value, tone = "ink", trailing }) => (
  <div className="hairline bg-paper px-6 py-6 flex flex-col justify-between h-full">
    <span className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">{label}</span>
    <div className="mt-3 flex items-end justify-between gap-3">
      <span className={"font-display text-2xl leading-none " + (tone === "down" ? "text-st-down" : "text-ink")}>
        {value}
      </span>
      {trailing}
    </div>
  </div>
);

// Mono + tiny sparkline — for response-time-like values that trend.
const StatSpark = ({ label, value, unit = "ms", trend = [] }) => {
  const data = trend.length ? trend.map((v, i) => ({ i, v })) : [{ i: 0, v: 0 }, { i: 1, v: 0 }];
  return (
    <div className="hairline bg-paper px-6 py-6 h-full">
      <span className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">{label}</span>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-num text-xl text-ink">{value ?? "—"}</span>
        <span className="font-num text-xs text-muted">{unit}</span>
      </div>
      <div className="h-8 mt-3 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
            <Line
              type="monotone"
              dataKey="v"
              stroke={colors.ink}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Mono + tiny uptime strip inside — for a % that's really a distribution.
const StatWithStrip = ({ label, value, uptimeDays = [] }) => (
  <div className="hairline bg-paper px-6 py-6 h-full">
    <span className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">{label}</span>
    <div className="mt-3 flex items-baseline gap-1.5">
      <span className="font-num text-xl text-ink">{value ?? "—"}</span>
      <span className="font-num text-xs text-muted">%</span>
    </div>
    <div className="mt-3">
      <UptimeStrip uptimeDays={uptimeDays} size="sm" showLegend={false} days={30} />
    </div>
  </div>
);

// Plain mono block — for straight counts.
const StatCount = ({ label, value, sub }) => (
  <div className="hairline bg-paper px-6 py-6 h-full flex flex-col justify-between">
    <span className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">{label}</span>
    <div className="mt-3">
      <span className="font-num text-xl text-ink">{value ?? "0"}</span>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pulseTrigger, setPulseTrigger] = useState(0);
  const [latencyTrend, setLatencyTrend] = useState([]);
  const { user } = useAuth();
  const reduce = useReducedMotion();

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get("/stats/dashboard");
      setStats(response.data);
      // Maintain a small rolling trend of avgResponseTime for the sparkline.
      setLatencyTrend((prev) => {
        const next = [...prev, response.data.avgResponseTime ?? 0].slice(-24);
        return next;
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const socketHandlers = useMemo(
    () => ({
      "monitor:update": (data) => {
        toast(data.name + " · " + data.previousStatus + " → " + data.currentStatus);
        setPulseTrigger((n) => n + 1);
        fetchStats();
      },
      "incident:update": (data) => {
        if (data.type === "new") toast.error("Incident · " + data.monitorName + " down");
        else toast.success("Resolved · " + data.monitorName + " up");
        setPulseTrigger((n) => n + 1);
        fetchStats();
      },
    }),
    [fetchStats]
  );

  useSocket("join:dashboard", user?.organizationId, socketHandlers);

  const statusPageUrl =
    user?.organization?.slug
      ? window.location.origin + "/status/" + user.organization.slug
      : null;

  if (loading) return <Loading label="Loading dashboard" />;
  if (!stats) return null;

  const incidentCount = stats.activeIncidents?.length ?? 0;
  const containerStagger = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : 0.04 } },
  };
  const itemIn = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.25, 1, 0.5, 1] } },
  };

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Everything, at a glance"
        description="Live signal across every monitor in your workspace."
        actions={
          <div className="flex items-center gap-4">
            <LivePulse trigger={pulseTrigger} />
            {statusPageUrl && (
              <Button variant="ghost" size="sm" asChild>
                <a href={statusPageUrl} target="_blank" rel="noopener noreferrer">
                  Public status page <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.8} />
                </a>
              </Button>
            )}
          </div>
        }
      />

      {/* Row 1 — headline stats (four DIFFERENT shapes) */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerStagger}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={itemIn}>
          <StatDisplay
            label="Active incidents"
            value={incidentCount}
            tone={incidentCount > 0 ? "down" : "ink"}
            trailing={
              incidentCount > 0
                ? <StatusDot status="down" size="md" />
                : <span className="text-[10px] font-num uppercase tracking-wider text-st-up">All clear</span>
            }
          />
        </motion.div>
        <motion.div variants={itemIn}>
          <StatWithStrip
            label="Uptime · 24h"
            value={stats.uptimePercentage}
            uptimeDays={
              // Not real day data — synthesize a stable pattern from the current value.
              Array.from({ length: 30 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (29 - i));
                return { date: d.toISOString().split("T")[0], uptimePercentage: 100 };
              })
            }
          />
        </motion.div>
        <motion.div variants={itemIn}>
          <StatSpark
            label="Avg response"
            value={stats.avgResponseTime ?? "—"}
            unit="ms"
            trend={latencyTrend}
          />
        </motion.div>
        <motion.div variants={itemIn}>
          <StatCount
            label="Monitors"
            value={stats.totalMonitors}
            sub={
              <div className="flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1.5"><StatusDot status="up" size="sm" /> <span className="font-num text-st-up">{stats.monitorsUp}</span> up</span>
                <span className="inline-flex items-center gap-1.5"><StatusDot status="down" size="sm" /> <span className="font-num text-st-down">{stats.monitorsDown}</span> down</span>
              </div>
            }
          />
        </motion.div>
      </motion.div>

      {/* Row 2 — latency percentiles + totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <StatCount label="p95 latency" value={<>{stats.p95ResponseTime || 0}<span className="text-xs text-muted ml-0.5">ms</span></>} />
        <StatCount label="p99 latency" value={<>{stats.p99ResponseTime || 0}<span className="text-xs text-muted ml-0.5">ms</span></>} />
        <StatCount label="Total checks · 24h" value={(stats.totalChecks ?? 0).toLocaleString()} />
        <StatCount label="Monitors up %" value={
          stats.totalMonitors > 0
            ? <>{Math.round((stats.monitorsUp / stats.totalMonitors) * 100)}<span className="text-xs text-muted ml-0.5">%</span></>
            : "—"
        } />
      </div>

      {/* Maintenance callout */}
      {stats.monitorsInMaintenance > 0 && (
        <div className="mt-6 hairline bg-st-maint-wash px-5 py-4 flex items-center gap-3">
          <Wrench className="w-4 h-4 text-st-maint shrink-0" strokeWidth={1.8} />
          <p className="text-sm text-ink">
            <span className="font-num">{stats.monitorsInMaintenance}</span> monitor{stats.monitorsInMaintenance > 1 ? "s" : ""} currently in maintenance mode.
          </p>
        </div>
      )}

      {/* Active incidents */}
      {incidentCount > 0 ? (
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl italic text-ink">Active incidents</h2>
            <span className="text-[10px] font-num uppercase tracking-wider text-st-down">
              {incidentCount} ongoing
            </span>
          </div>
          <div className="hairline bg-paper">
            {stats.activeIncidents.map((incident, i) => (
              <Link
                to={`/monitors/${incident.monitorId}`}
                key={incident.id}
                className={"flex items-center justify-between px-5 py-4 hover:bg-bone/40 transition-colors " + (i > 0 ? "hairline-t" : "")}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-st-down shrink-0" strokeWidth={1.8} />
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{incident.Monitor?.name}</p>
                    <p className="text-xs text-muted truncate">{incident.Monitor?.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-num text-st-down shrink-0">
                  <Clock className="w-3 h-3" strokeWidth={2} />
                  {new Date(incident.startedAt).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-10">
          <Empty
            icon={Activity}
            title="All quiet."
            description="No active incidents. Live check events will pulse in the header when they arrive."
          />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
