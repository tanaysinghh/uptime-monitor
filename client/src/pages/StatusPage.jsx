import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
} from "lucide-react";

const statusLabels = {
  operational: { label: "All Systems Operational", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle },
  partial_outage: { label: "Partial System Outage", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: AlertTriangle },
  major_outage: { label: "Major System Outage", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: XCircle },
};

const UptimeBar = ({ uptimeDays, overallUptime }) => {
  const last90Days = [];
  for (let i = 89; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const dayData = uptimeDays.find((d) => d.date === dateStr);
    last90Days.push({
      date: dateStr,
      uptime: dayData ? dayData.uptimePercentage : -1,
    });
  }

  const getBarColor = (uptime) => {
    if (uptime === -1) return "bg-gray-700";
    if (uptime >= 99) return "bg-emerald-500";
    if (uptime >= 95) return "bg-yellow-500";
    if (uptime >= 90) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div>
      <div className="flex gap-[2px]">
        {last90Days.map((day, i) => (
          <div key={i} className="group relative flex-1">
            <div
              className={`h-8 rounded-[2px] ${getBarColor(day.uptime)} transition-opacity hover:opacity-80`}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-lg">
                <p className="font-medium">{day.date}</p>
                <p className="text-gray-400">
                  {day.uptime === -1 ? "No data" : `${day.uptime}% uptime`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>90 days ago</span>
        <span>{overallUptime}% uptime</span>
        <span>Today</span>
      </div>
    </div>
  );
};

const StatusPage = () => {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get(`/api/public/status/${slug}`);
        setData(response.data);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-xl">{error}</p>
        </div>
      </div>
    );
  }

  const statusConfig = statusLabels[data.overallStatus] || statusLabels.operational;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          {data.organization.logoUrl ? (
            <img
              src={data.organization.logoUrl}
              alt={data.organization.name}
              className="h-10 mx-auto mb-4"
            />
          ) : (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Activity className="w-8 h-8" style={{ color: data.organization.brandColor }} />
              <span className="text-2xl font-bold">{data.organization.name}</span>
            </div>
          )}
        </div>

        <div className={`${statusConfig.bg} border ${statusConfig.border} rounded-xl p-6 mb-8 flex items-center gap-4`}>
          <StatusIcon className={`w-8 h-8 ${statusConfig.color}`} />
          <div>
            <p className={`text-xl font-semibold ${statusConfig.color}`}>
              {statusConfig.label}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Last updated: {new Date().toLocaleString()}
            </p>
          </div>
        </div>

        {data.activeIncidents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Active Incidents
            </h2>
            <div className="space-y-3">
              {data.activeIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="bg-red-500/5 border border-red-500/20 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{incident.Monitor?.name}</p>
                    <span className="text-xs text-red-400 capitalize px-2 py-1 bg-red-500/10 rounded-full">
                      {incident.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Started {new Date(incident.startedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {data.monitors.map((monitor) => (
            <div
              key={monitor.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{monitor.name}</span>
                </div>
                <span
                  className={`text-sm font-medium ${
                    monitor.status === "up"
                      ? "text-emerald-400"
                      : monitor.status === "down"
                      ? "text-red-400"
                      : "text-gray-400"
                  }`}
                >
                  {monitor.status === "up" ? "Operational" : monitor.status === "down" ? "Down" : "Pending"}
                </span>
              </div>
              <UptimeBar
                uptimeDays={monitor.uptimeDays}
                overallUptime={monitor.overallUptime}
              />
            </div>
          ))}

          {data.monitors.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No monitors configured
            </div>
          )}
        </div>

        {data.recentIncidents.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold mb-4">Past Incidents</h2>
            <div className="space-y-3">
              {data.recentIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{incident.Monitor?.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(incident.startedAt).toLocaleDateString()} — resolved in{" "}
                      {incident.durationSeconds
                        ? `${Math.floor(incident.durationSeconds / 60)}m ${incident.durationSeconds % 60}s`
                        : "N/A"}
                    </p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-12 text-sm text-gray-600">
          Powered by{" "}
          <span className="text-gray-400 font-medium">UptimeMonitor</span>
        </div>
      </div>
    </div>
  );
};

export default StatusPage;