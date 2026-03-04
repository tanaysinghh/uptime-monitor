import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MonitorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState(null);
  const [checks, setChecks] = useState([]);
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [period, setPeriod] = useState("24h");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [monitorRes, checksRes, statsRes, incidentsRes] = await Promise.all([
        api.get(`/monitors/${id}`),
        api.get(`/monitors/${id}/checks?period=${period}`),
        api.get(`/stats/monitors/${id}?period=${period}`),
        api.get(`/monitors/${id}/incidents`),
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
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [id, period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!monitor) return null;

  const chartData = checks.map((check) => ({
    time: new Date(check.checkedAt).toLocaleTimeString(),
    responseTime: check.responseTimeMs,
    success: check.isSuccess ? 1 : 0,
  }));

  const statusColor = monitor.status === "up" ? "text-emerald-400" : monitor.status === "down" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/monitors")}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{monitor.name}</h1>
          <p className="text-gray-400">{monitor.url}</p>
        </div>
        <span className={`ml-auto text-lg font-semibold ${statusColor} uppercase`}>
          {monitor.status}
        </span>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-400">Uptime</p>
            <p className="text-xl font-bold text-emerald-400">{stats.uptimePercentage}%</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-400">Avg Response</p>
            <p className="text-xl font-bold">{stats.avgResponseTime}ms</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-400">Total Checks</p>
            <p className="text-xl font-bold">{stats.totalChecks}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-400">Incidents</p>
            <p className="text-xl font-bold text-red-400">{stats.totalIncidents}</p>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Response Time</h2>
          <div className="flex gap-2">
            {["24h", "7d", "30d", "90d"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  period === p
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="time"
                stroke="#6b7280"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="responseTime"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No data available for this period
          </div>
        )}
      </div>

      {incidents.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Incidents</h2>
          <div className="space-y-3">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {incident.status === "resolved" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium capitalize">{incident.status}</p>
                    <p className="text-xs text-gray-500">
                      Started {new Date(incident.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {incident.durationSeconds
                    ? `${Math.floor(incident.durationSeconds / 60)}m ${incident.durationSeconds % 60}s`
                    : "Ongoing"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitorDetail;