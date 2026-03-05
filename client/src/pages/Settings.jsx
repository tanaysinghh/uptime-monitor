import { useState, useEffect } from "react";
import api from "../api/axios";
import { GetStartedButton } from "../components/ui/GetStartedButton";
import toast from "react-hot-toast";
import {
  Key,
  Copy,
  Trash2,
  Clock,
  Shield,
  Eye,
  AlertTriangle,
} from "lucide-react";

const Settings = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState(null);
  const [activeTab, setActiveTab] = useState("api-keys");
  const [formData, setFormData] = useState({
    name: "",
    permissions: ["read"],
  });

  const fetchData = async () => {
    try {
      const [keysRes, subsRes] = await Promise.all([
        api.get("/api-keys"),
        api.get("/public/subscribers"),
      ]);
      setApiKeys(keysRes.data.keys);
      setSubscribers(subsRes.data.subscribers);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/api-keys", formData);
      setNewKeyVisible(response.data.key);
      toast.success("API key created - copy it now, it won't be shown again!");
      setShowForm(false);
      setFormData({ name: "", permissions: ["read"] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create API key");
    }
  };

  const handleRevokeKey = async (id) => {
    if (!window.confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      await api.put("/api-keys/" + id + "/revoke");
      toast.success("API key revoked");
      fetchData();
    } catch (error) {
      toast.error("Failed to revoke key");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const togglePermission = (perm) => {
    const current = formData.permissions;
    if (current.includes(perm)) {
      setFormData({ ...formData, permissions: current.filter((p) => p !== perm) });
    } else {
      setFormData({ ...formData, permissions: [...current, perm] });
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
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-400 mt-1">API keys and subscriber management</p>
        </div>
      </div>

      <div className="flex gap-2">
        {["api-keys", "subscribers"].map((tab) => (
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
            {tab.replace("-", " ")}
          </button>
        ))}
      </div>

      {activeTab === "api-keys" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <GetStartedButton onClick={() => setShowForm(!showForm)}>
              Create API Key
            </GetStartedButton>
          </div>

          {newKeyVisible && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <p className="text-sm font-medium text-yellow-400">Copy your API key now - it won't be shown again</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-sm text-emerald-400 font-mono overflow-x-auto">
                  {newKeyVisible}
                </code>
                <button
                  onClick={() => copyToClipboard(newKeyVisible)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setNewKeyVisible(null)}
                className="text-xs text-gray-500 mt-2 hover:text-gray-400"
              >
                Dismiss
              </button>
            </div>
          )}

          {showForm && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">New API Key</h2>
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Key Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Production API Key"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Permissions</label>
                  <div className="flex gap-3">
                    {["read", "write", "admin"].map((perm) => (
                      <button
                        key={perm}
                        type="button"
                        onClick={() => togglePermission(perm)}
                        className={
                          "px-4 py-2 text-sm rounded-lg border transition-colors capitalize " +
                          (formData.permissions.includes(perm)
                            ? "bg-emerald-600 border-emerald-500 text-white"
                            : "bg-gray-800 border-gray-700 text-gray-400")
                        }
                      >
                        {perm}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <GetStartedButton onClick={handleCreateKey}>Create Key</GetStartedButton>
                  <GetStartedButton onClick={() => setShowForm(false)} className="bg-gray-800 hover:bg-gray-800 border border-gray-700">Cancel</GetStartedButton>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <Key className={"w-5 h-5 " + (key.isActive ? "text-emerald-400" : "text-gray-600")} />
                  <div>
                    <p className="font-medium">{key.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <code className="text-xs text-gray-500 font-mono">{key.keyPrefix}...</code>
                      <span className="text-xs text-gray-600">
                        {key.permissions.join(", ")}
                      </span>
                      {key.lastUsedAt && (
                        <span className="text-xs text-gray-600">
                          Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                      {!key.isActive && (
                        <span className="text-xs text-red-400">Revoked</span>
                      )}
                    </div>
                  </div>
                </div>
                {key.isActive && (
                  <button
                    onClick={() => handleRevokeKey(key.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                    title="Revoke"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {apiKeys.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg">No API keys</p>
                <p className="text-sm mt-1">Create an API key to manage monitors programmatically</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "subscribers" && (
        <div className="space-y-3">
          {subscribers.map((sub) => (
            <div
              key={sub.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Eye className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">{sub.email}</p>
                  <p className="text-xs text-gray-500">
                    {sub.confirmed ? "Confirmed" : "Pending"} - Subscribed {new Date(sub.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {subscribers.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">No subscribers yet</p>
              <p className="text-sm mt-1">Visitors can subscribe from your public status page</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Settings;
