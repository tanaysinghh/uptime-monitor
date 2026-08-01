import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import api from "../api/axios";
import useSocket from "../hooks/useSocket";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { UptimeStrip } from "../components/ui/UptimeStrip";
import { StatusDot, StatusLabel } from "../components/ui/StatusDot";
import { LivePulse } from "../components/ui/LivePulse";
import { Loading } from "../components/ui/States";
import { colors } from "../lib/tokens";
import { ArrowLeft, Clock, ExternalLink, CheckCircle2, XCircle } from "lucide-react";

const PERIODS = ["24h", "7d", "30d", "90d"];

const MonitorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [monitor, setMonitor] = useState(null);
  const [checks, setChecks] = useState([]);
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [period, setPeriod] = useState("24h");
  const [loading, setLoading] = useState(true);
  const [pulseTrigger, setPulseTrigger] = useState(0);
  const reduce = useReducedMotion();

  const fetchData = useCallback(async () => {
    try {
      const [monitorRes, checksRes, statsRes, incidentsRes] = await Promise.all([
        api.get("/monitors/" + id),
        api.get("/monitors/" + id + "/checks?period=" + period),
        api.get("/stats/monitors/" + id + "?period=" + period),
        api.get("/monitors/" + id + "/incidents"),
      ]);
      setMonitor(monitorRes.data.monitor);
      setChecks(checksRes.data.checks);
      setStats(statsRes.data);
      setIncidents(incidentsRes.data.incidents);
    } catch (error) {
      console.error("Failed to fetch monitor details:", error);
    } finally {
      setLoading(false);
    }
  }, [id, period]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useSocket("join:dashboard", user?.organizationId, {
    "monitor:update": (data) => {
      if (String(data.id) === String(id) || data.monitorId === id) {
        setPulseTrigger((n) => n + 1);
        fetchData();
      }
    },
  });

  if (loading) return <Loading label="Loading monitor" />;
  if (!monitor) return null;

  const chartData = checks
    .slice()
    .reverse()
    .map((check) => ({
      time: new Date(check.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      responseTime: check.responseTimeMs,
      isSuccess: check.isSuccess,
    }));

  const p95 = stats?.p95ResponseTime;
  const avg = stats?.avgResponseTime;

  return (
    <div>
      {/* Breadcrumb + title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/monitors")}
          className="p-1.5 hover:bg-bone transition-colors"
          aria-label="Back to monitors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />
        </button>
        <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">
          Monitors / <span className="text-ink">{monitor.name}</span>
        </div>
      </div>

      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 hairline-b mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <StatusDot status={monitor.status} size="lg" />
            <h1 className="font-display text-2xl leading-none text-ink truncate">{monitor.name}</h1>
          </div>
          <a
            href={monitor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-xs font-num text-muted hover:text-ink transition-colors"
          >
            <span className="uppercase tracking-wider">{monitor.method}</span>
            <span className="text-bone-strong">·</span>
            <span className="truncate">{monitor.url}</span>
            <ExternalLink className="w-3 h-3" strokeWidth={1.8} />
          </a>
        </div>
        <div className="flex items-center gap-6">
          <LivePulse trigger={pulseTrigger} />
          <div className="text-right">
            <StatusLabel status={monitor.status} />
            <div className="text-[10px] font-num uppercase tracking-wider text-muted mt-1">
              every {monitor.intervalSeconds < 60 ? monitor.intervalSeconds + "s" : Math.round(monitor.intervalSeconds / 60) + "m"}
            </div>
          </div>
        </div>
      </header>

      {/* Hero: giant 90-day uptime strip */}
      <motion.section
        initial={reduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
        className="hairline bg-paper p-6 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">Uptime · 90 days</div>
            <div className="font-display text-2xl text-ink mt-1">
              {stats?.uptimePercentage ?? "—"}<span className="text-lg text-muted">%</span>
            </div>
          </div>
          <div className="text-right text-xs font-num text-muted">
            <div>{stats?.totalChecks?.toLocaleString() ?? "0"} checks</div>
            <div>{stats?.totalIncidents ?? 0} incidents</div>
          </div>
        </div>
        <UptimeStrip
          uptimeDays={monitor.uptimeDays || []}
          size="lg"
          days={90}
        />
      </motion.section>

      {/* Stat row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="hairline bg-paper px-5 py-5">
            <div className="text-[10px] font-num uppercase tracking-wider text-muted">Avg response</div>
            <div className="mt-2 font-num text-lg text-ink">{stats.avgResponseTime ?? "—"}<span className="text-xs text-muted ml-0.5">ms</span></div>
          </div>
          <div className="hairline bg-paper px-5 py-5">
            <div className="text-[10px] font-num uppercase tracking-wider text-muted">p95 latency</div>
            <div className="mt-2 font-num text-lg text-st-degraded">{stats.p95ResponseTime ?? "—"}<span className="text-xs text-muted ml-0.5">ms</span></div>
          </div>
          <div className="hairline bg-paper px-5 py-5">
            <div className="text-[10px] font-num uppercase tracking-wider text-muted">p99 latency</div>
            <div className="mt-2 font-num text-lg text-st-down">{stats.p99ResponseTime ?? "—"}<span className="text-xs text-muted ml-0.5">ms</span></div>
          </div>
          <div className="hairline bg-paper px-5 py-5">
            <div className="text-[10px] font-num uppercase tracking-wider text-muted">Checks</div>
            <div className="mt-2 font-num text-lg text-ink">{stats.totalChecks?.toLocaleString() ?? "—"}</div>
          </div>
        </div>
      )}

      {/* Latency chart */}
      <section className="hairline bg-paper mb-8">
        <div className="flex items-center justify-between px-6 py-4 hairline-b">
          <div>
            <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">Response time</div>
            <h2 className="font-display text-lg text-ink mt-0.5">Latency over time</h2>
          </div>
          <div className="flex hairline" role="tablist" aria-label="Time period">
            {PERIODS.map((p, i) => (
              <button
                key={p}
                role="tab"
                aria-selected={period === p}
                onClick={() => setPeriod(p)}
                className={
                  "px-3 h-8 text-xs font-num uppercase tracking-wider transition-colors " +
                  (i > 0 ? "hairline-l " : "") +
                  (period === p ? "bg-ink text-paper" : "text-muted hover:text-ink")
                }
              >{p}</button>
            ))}
          </div>
        </div>
        <div className="p-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={colors.bone} strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke={colors.muted}
                  tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: colors.muted }}
                  interval="preserveStartEnd"
                  axisLine={{ stroke: colors.bone }}
                  tickLine={false}
                />
                <YAxis
                  stroke={colors.muted}
                  tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: colors.muted }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                {p95 && <ReferenceLine y={p95} stroke={colors.status.degraded} strokeDasharray="2 4" label={{ value: `p95 · ${p95}ms`, position: "right", fill: colors.status.degraded, fontSize: 10, fontFamily: "IBM Plex Mono" }} />}
                {avg && <ReferenceLine y={avg} stroke={colors.muted} strokeDasharray="2 4" />}
                <Tooltip
                  cursor={{ stroke: colors.ink, strokeWidth: 1, strokeDasharray: "0" }}
                  contentStyle={{
                    background: colors.paper,
                    border: `1px solid ${colors.bone}`,
                    borderRadius: 0,
                    fontFamily: "IBM Plex Mono",
                    fontSize: 12,
                    padding: "8px 10px",
                  }}
                  labelStyle={{ color: colors.muted, textTransform: "uppercase", fontSize: 10, letterSpacing: 1 }}
                  itemStyle={{ color: colors.ink }}
                  formatter={(v) => [`${v} ms`, "response"]}
                />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke={colors.ink}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={!reduce}
                  animationDuration={reduce ? 0 : 400}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-sm text-muted">
              No checks in this period yet.
            </div>
          )}
        </div>
      </section>

      {/* Incidents */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl italic text-ink">Recent incidents</h2>
          {incidents.length > 0 && (
            <span className="text-[10px] font-num uppercase tracking-wider text-muted">
              {incidents.length} total
            </span>
          )}
        </div>
        {incidents.length === 0 ? (
          <div className="hairline bg-paper py-10 text-center">
            <CheckCircle2 className="w-6 h-6 text-st-up mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-muted">No incidents recorded for this monitor.</p>
          </div>
        ) : (
          <div className="hairline bg-paper">
            {incidents.map((incident, i) => (
              <div
                key={incident.id}
                className={"flex items-center justify-between px-5 py-4 " + (i > 0 ? "hairline-t" : "")}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {incident.status === "resolved" ? (
                    <CheckCircle2 className="w-4 h-4 text-st-up shrink-0" strokeWidth={1.8} />
                  ) : (
                    <XCircle className="w-4 h-4 text-st-down shrink-0" strokeWidth={1.8} />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-ink capitalize">{incident.status}</p>
                    <p className="text-xs font-num text-muted">
                      Started {new Date(incident.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-xs font-num text-muted shrink-0 inline-flex items-center gap-2">
                  <Clock className="w-3 h-3" strokeWidth={2} />
                  {incident.durationSeconds
                    ? Math.floor(incident.durationSeconds / 60) + "m " + (incident.durationSeconds % 60) + "s"
                    : "ongoing"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default MonitorDetail;
