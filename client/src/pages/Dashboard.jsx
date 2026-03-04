import { useState, useEffect, useMemo } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import useSocket from "../hooks/useSocket";
import {
  Activity,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Clock,
  CheckCircle,
  Link as LinkIcon,
} from "lucide-react";
import toast from "react-hot-toast";

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchStats = async () => {
    try {
      const response = await api.get("/stats/dashboard");
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const socketHandlers = useMemo(
    () => ({
      "monitor:update": (data) => {
        toast(`${data.name}: ${data.previousStatus} -> ${data.currentStatus}`, {
          icon: data.currentStatus === "up" ? "✅" : "🔴",
        });
        fetchStats();
      },
      "incident:update": (data) => {
        if (data.type === "new") {
          toast.error(`New incident: ${data.monitorName} is down`);
        } else {
          toast.success(`Resolved: ${data.monitorName} is back up`);
        }
        fetchStats();
      },
    }),
    []
  );

  useSocket("join:dashboard", user?.organizationId, socketHandlers);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  const statusPageUrl =
    user?.organization?.slug
      ? window.location.origin + "/status/" + user.organization.slug
      : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 mt-1">Overview of all your monitors</p>
        </div>
        {statusPageUrl && (
          <a
            href={statusPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 rounded-lg transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
            Public Status Page
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Monitors"
          value={stats.totalMonitors}
          icon={Activity}
          color="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          label="Monitors Up"
          value={stats.monitorsUp}
          icon={ArrowUp}
          color="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          label="Monitors Down"
          value={stats.monitorsDown}
          icon={ArrowDown}
          color="bg-red-500/10 text-red-400"
        />
        <StatCard
          label="Uptime (24h)"
          value={stats.uptimePercentage + "%"}
          icon={CheckCircle}
          color="bg-emerald-500/10 text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-1">Avg Response Time</h2>
          <p className="text-3xl font-bold text-emerald-400">
            {stats.avgResponseTime}ms
          </p>
          <p className="text-sm text-gray-400 mt-1">Last 24 hours</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-1">Total Checks</h2>
          <p className="text-3xl font-bold text-blue-400">
            {stats.totalChecks}
          </p>
          <p className="text-sm text-gray-400 mt-1">Last 24 hours</p>
        </div>
      </div>

      {stats.activeIncidents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Active Incidents
          </h2>
          <div className="space-y-3">
            {stats.activeIncidents.map((incident) => (
              <div
                key={incident.id}
                className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">
                    {incident.Monitor?.name}
                  </p>
                  <p className="text-sm text-gray-400">
                    {incident.Monitor?.url}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <Clock className="w-4 h-4" />
                  {new Date(incident.startedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;