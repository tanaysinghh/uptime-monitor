import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import api from "../api/axios";
import SecuritySection from "../components/SecuritySection";
import toast from "react-hot-toast";
import { PageHeader } from "../components/ui/Section";
import { Button } from "../components/ui/button";
import { Field, Input } from "../components/ui/Field";
import { Tabs } from "../components/ui/Tabs";
import { Loading, Empty } from "../components/ui/States";
import { Key, Copy, Trash2, AlertTriangle, Eye, Plus, Mail } from "lucide-react";

const ALL_PERMS = ["read", "write", "admin"];

const Settings = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState(null);
  const [activeTab, setActiveTab] = useState("api-keys");
  const [formData, setFormData] = useState({ name: "", permissions: ["read"] });
  const reduce = useReducedMotion();

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
  useEffect(() => { fetchData(); }, []);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/api-keys", formData);
      setNewKeyVisible(response.data.key);
      toast.success("API key created — copy it now, it won't be shown again");
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
      toast.success("Key revoked");
      fetchData();
    } catch { toast.error("Failed to revoke"); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const togglePermission = (perm) => {
    const current = formData.permissions;
    setFormData({
      ...formData,
      permissions: current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm],
    });
  };

  if (loading) return <Loading label="Loading settings" />;

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="API access, subscribers, and account security."
      />

      <div className="mb-6">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "api-keys",    label: "API keys",    count: apiKeys.length },
            { value: "subscribers", label: "Subscribers", count: subscribers.length },
            { value: "security",    label: "Security" },
          ]}
        />
      </div>

      {activeTab === "api-keys" && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowForm((s) => !s)}>
              <Plus className="w-4 h-4" /> {showForm ? "Cancel" : "New key"}
            </Button>
          </div>

          {newKeyVisible && (
            <div className="hairline bg-st-degraded-wash p-5 mb-6">
              <div className="flex items-center gap-2 mb-3 text-st-degraded">
                <AlertTriangle className="w-4 h-4" strokeWidth={1.8} />
                <span className="text-xs font-num uppercase tracking-wider">Copy your key now — it won't be shown again</span>
              </div>
              <div className="flex items-stretch gap-0 hairline bg-paper">
                <code className="flex-1 px-3 py-3 text-xs font-num text-ink overflow-x-auto whitespace-nowrap">
                  {newKeyVisible}
                </code>
                <button
                  onClick={() => copyToClipboard(newKeyVisible)}
                  className="px-4 hairline-l text-muted hover:text-ink transition-colors"
                  aria-label="Copy key"
                >
                  <Copy className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>
              <button
                onClick={() => setNewKeyVisible(null)}
                className="text-[11px] font-num uppercase tracking-wider text-muted hover:text-ink mt-3"
              >
                Dismiss
              </button>
            </div>
          )}

          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={reduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? {} : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="hairline bg-paper mb-6"
              >
                <div className="px-6 py-5 hairline-b">
                  <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">New API key</div>
                  <h2 className="font-display text-lg mt-0.5">Give it a name and scope</h2>
                </div>
                <form onSubmit={handleCreateKey} className="p-6 space-y-5">
                  <Field label="Key name" htmlFor="ak-name" required>
                    <Input id="ak-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Production API key" />
                  </Field>
                  <div>
                    <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Permissions</div>
                    <div className="flex gap-0 hairline">
                      {ALL_PERMS.map((perm, i) => {
                        const active = formData.permissions.includes(perm);
                        return (
                          <button
                            key={perm}
                            type="button"
                            onClick={() => togglePermission(perm)}
                            className={
                              "px-5 h-10 text-xs font-num uppercase tracking-wider transition-colors flex-1 " +
                              (i > 0 ? "hairline-l " : "") +
                              (active ? "bg-ink text-paper" : "text-muted hover:text-ink")
                            }
                          >
                            {perm}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2 hairline-t -mx-6 px-6 -mb-6 pb-5 mt-2">
                    <Button type="submit">Create key</Button>
                    <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {apiKeys.length === 0 ? (
            <Empty
              icon={Key}
              title="No API keys."
              description="Create one to manage monitors programmatically. Keys are SHA-256 hashed at rest."
              action={<Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New key</Button>}
            />
          ) : (
            <div className="hairline bg-paper">
              {apiKeys.map((key, i) => (
                <div key={key.id} className={"flex items-center justify-between px-5 py-4 " + (i > 0 ? "hairline-t" : "")}>
                  <div className="flex items-center gap-4 min-w-0">
                    <Key className={"w-4 h-4 shrink-0 " + (key.isActive ? "text-ink" : "text-muted")} strokeWidth={1.6} />
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{key.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] font-num text-muted">
                        <code className="text-muted">{key.keyPrefix}…</code>
                        <span className="uppercase tracking-wider">{key.permissions.join(" · ")}</span>
                        {key.lastUsedAt && (
                          <span className="uppercase tracking-wider">used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                        )}
                        {!key.isActive && <span className="uppercase tracking-wider text-st-down">Revoked</span>}
                      </div>
                    </div>
                  </div>
                  {key.isActive && (
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      className="p-2 text-muted hover:text-st-down transition-colors"
                      aria-label="Revoke"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "subscribers" && (
        subscribers.length === 0 ? (
          <Empty
            icon={Mail}
            title="No subscribers yet."
            description="Visitors to your public status page can subscribe for incident email updates."
          />
        ) : (
          <div className="hairline bg-paper">
            {subscribers.map((sub, i) => (
              <div key={sub.id} className={"flex items-center justify-between px-5 py-3 " + (i > 0 ? "hairline-t" : "")}>
                <div className="flex items-center gap-3 min-w-0">
                  <Eye className="w-3.5 h-3.5 text-muted shrink-0" strokeWidth={1.8} />
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{sub.email}</p>
                    <p className="text-[11px] font-num uppercase tracking-wider text-muted">
                      {sub.confirmed ? "Confirmed" : "Pending"} · {new Date(sub.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === "security" && <SecuritySection />}
    </div>
  );
};

export default Settings;
