import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { GetStartedButton } from "../components/ui/GetStartedButton";
import toast from "react-hot-toast";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Pause,
  Clock,
  Trash2,
} from "lucide-react";

const statusConfig = {
  up: { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: ArrowUp, label: "Up" },
  down: { color: "text-red-400", bg: "bg-red-500/10", icon: ArrowDown, label: "Down" },
  paused: { color: "text-yellow-400", bg: "bg-yellow-500/10", icon: Pause, label: "Paused" },
  pending: { color: "text-gray-400", bg: "bg-gray-500/10", icon: Clock, label: "Pending" },
};

const Monitors = () => {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    method: "GET",
    intervalSeconds: 300,
    timeoutMs: 30000,
    expectedStatus: 200,
  });

  const fetchMonitors = async () => {
    try {
      const response = await api.get("/monitors");
      setMonitors(response.data.monitors);
    } catch (error) {
      toast.error("Failed to fetch monitors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/monitors", formData);
      toast.success("Monitor created");
      setShowForm(false);
      setFormData({
        name: "",
        url: "",
        method: "GET",
        intervalSeconds: 300,
        timeoutMs: 30000,
        expectedStatus: 200,
      });
      fetchMonitors();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create monitor");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this monitor?")) return;
    try {
      await api.delete("/monitors/" + id);
      toast.success("Monitor deleted");
      fetchMonitors();
    } catch (error) {
      toast.error("Failed to delete monitor");
    }
  };

  const togglePause = async (monitor) => {
    try {
      const newStatus = monitor.status === "paused" ? "pending" : "paused";
      await api.put("/monitors/" + monitor.id, { status: newStatus });
      toast.success(newStatus === "paused" ? "Monitor paused" : "Monitor resumed");
      fetchMonitors();
    } catch (error) {
      toast.error("Failed to update monitor");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitors</h1>
          <p className="text-gray-400 mt-1">{monitors.length} monitors configured</p>
        </div>
        <GetStartedButton onClick={() => setShowForm(!showForm)}>
          Add Monitor
        </GetStartedButton>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">New Monitor</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="My API"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="https://api.example.com/health"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Method</label>
              <select
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Check Interval</label>
              <select
                value={formData.intervalSeconds}
                onChange={(e) => setFormData({ ...formData, intervalSeconds: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={300}>5 minutes</option>
                <option value={900}>15 minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Timeout (ms)</label>
              <input
                type="number"
                value={formData.timeoutMs}
                onChange={(e) => setFormData({ ...formData, timeoutMs: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Expected Status</label>
              <input
                type="number"
                value={formData.expectedStatus}
                onChange={(e) => setFormData({ ...formData, expectedStatus: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <GetStartedButton onClick={handleCreate}>
                Create Monitor
              </GetStartedButton>
              <GetStartedButton
                onClick={() => setShowForm(false)}
                className="bg-gray-800 hover:bg-gray-800 border border-gray-700"
              >
                Cancel
              </GetStartedButton>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {monitors.map((monitor) => {
          const config = statusConfig[monitor.status] || statusConfig.pending;
          const StatusIcon = config.icon;
          return (
            <div
              key={monitor.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={"p-2 rounded-lg " + config.bg}>
                  <StatusIcon className={"w-5 h-5 " + config.color} />
                </div>
                <div>
                  <Link
                    to={"/monitors/" + monitor.id}
                    className="font-medium hover:text-emerald-400 transition-colors"
                  >
                    {monitor.name}
                  </Link>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-500">{monitor.url}</span>
                    <span className="text-xs text-gray-600">{monitor.method}</span>
                    <span className="text-xs text-gray-600">
                      every {monitor.intervalSeconds < 60
                        ? monitor.intervalSeconds + "s"
                        : monitor.intervalSeconds / 60 + "m"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={"text-sm font-medium " + config.color}>
                  {config.label}
                </span>
                <button
                  onClick={() => togglePause(monitor)}
                  className="p-2 text-gray-500 hover:text-yellow-400 hover:bg-gray-800 rounded-lg transition-colors"
                  title={monitor.status === "paused" ? "Resume" : "Pause"}
                >
                  <Pause className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(monitor.id)}
                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {monitors.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No monitors yet</p>
            <p className="text-sm mt-1">Click "Add Monitor" to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Monitors;