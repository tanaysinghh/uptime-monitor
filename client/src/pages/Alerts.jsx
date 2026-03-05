import { useState, useEffect } from "react";
import api from "../api/axios";
import { GetStartedButton } from "../components/ui/GetStartedButton";
import toast from "react-hot-toast";
import {
  Plus,
  Trash2,
  Webhook,
  MessageSquare,
  Mail,
  Send,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

const typeConfig = {
  webhook: { icon: Webhook, label: "Webhook", color: "text-blue-400" },
  slack: { icon: MessageSquare, label: "Slack", color: "text-purple-400" },
  discord: { icon: MessageSquare, label: "Discord", color: "text-indigo-400" },
  email: { icon: Mail, label: "Email", color: "text-emerald-400" },
};

const Alerts = () => {
  const [channels, setChannels] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("channels");
  const [formData, setFormData] = useState({
    name: "",
    type: "webhook",
    url: "",
    cooldownMinutes: 5,
  });

  const fetchData = async () => {
    try {
      const [channelsRes, logsRes] = await Promise.all([
        api.get("/alerts/channels"),
        api.get("/alerts/logs"),
      ]);
      setChannels(channelsRes.data.channels);
      setLogs(logsRes.data.logs);
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const config =
        formData.type === "webhook"
          ? { url: formData.url }
          : { webhookUrl: formData.url };

      await api.post("/alerts/channels", {
        name: formData.name,
        type: formData.type,
        config,
        cooldownMinutes: formData.cooldownMinutes,
      });
      toast.success("Alert channel created");
      setShowForm(false);
      setFormData({ name: "", type: "webhook", url: "", cooldownMinutes: 5 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create channel");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this alert channel?")) return;
    try {
      await api.delete("/alerts/channels/" + id);
      toast.success("Channel deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete channel");
    }
  };

  const handleTest = async (id) => {
    try {
      await api.post("/alerts/channels/" + id + "/test");
      toast.success("Test alert sent!");
    } catch (error) {
      toast.error(error.response?.data?.error || "Test failed");
    }
  };

  const toggleActive = async (channel) => {
    try {
      await api.put("/alerts/channels/" + channel.id, {
        isActive: !channel.isActive,
      });
      toast.success(channel.isActive ? "Channel disabled" : "Channel enabled");
      fetchData();
    } catch (error) {
      toast.error("Failed to update channel");
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
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-gray-400 mt-1">Configure where notifications are sent</p>
        </div>
        <GetStartedButton onClick={() => setShowForm(!showForm)}>
          Add Channel
        </GetStartedButton>
      </div>

      <div className="flex gap-2">
        {["channels", "logs"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={
              "px-4 py-2 text-sm rounded-lg transition-colors capitalize " +
              (activeTab === tab
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white")
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">New Alert Channel</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Production Alerts"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="webhook">Webhook</option>
                <option value="slack">Slack</option>
                <option value="discord">Discord</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                {formData.type === "webhook" ? "Webhook URL" : "Incoming Webhook URL"}
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cooldown (minutes)</label>
              <input
                type="number"
                value={formData.cooldownMinutes}
                onChange={(e) => setFormData({ ...formData, cooldownMinutes: parseInt(e.target.value) })}
                min={1}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <GetStartedButton onClick={handleCreate}>Create Channel</GetStartedButton>
              <GetStartedButton onClick={() => setShowForm(false)} className="bg-gray-800 hover:bg-gray-800 border border-gray-700">Cancel</GetStartedButton>
            </div>
          </form>
        </div>
      )}

      {activeTab === "channels" && (
        <div className="space-y-3">
          {channels.map((channel) => {
            const config = typeConfig[channel.type] || typeConfig.webhook;
            const Icon = config.icon;
            return (
              <div
                key={channel.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <Icon className={"w-5 h-5 " + config.color} />
                  <div>
                    <p className="font-medium">{channel.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={"text-xs " + config.color}>{config.label}</span>
                      <span className="text-xs text-gray-600">Cooldown: {channel.cooldownMinutes}m</span>
                      <span className={"text-xs " + (channel.isActive ? "text-emerald-400" : "text-gray-500")}>
                        {channel.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(channel.id)}
                    className="p-2 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-colors"
                    title="Send test alert"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(channel)}
                    className={"p-2 hover:bg-gray-800 rounded-lg transition-colors " + (channel.isActive ? "text-emerald-400" : "text-gray-500")}
                    title={channel.isActive ? "Disable" : "Enable"}
                  >
                    {channel.isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(channel.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {channels.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">No alert channels configured</p>
              <p className="text-sm mt-1">Add a webhook, Slack, or Discord channel to receive alerts</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {log.status === "sent" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <div>
                  <p className="text-sm font-medium">{log.Monitor?.name || "Unknown"}</p>
                  <p className="text-xs text-gray-500">
                    {log.AlertChannel?.name} ({log.AlertChannel?.type}) - {log.type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                {new Date(log.sentAt).toLocaleString()}
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <p>No alert logs yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Alerts;
