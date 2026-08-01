import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import api from "../api/axios";
import toast from "react-hot-toast";
import { PageHeader } from "../components/ui/Section";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/Field";
import { Tabs } from "../components/ui/Tabs";
import { Loading, Empty } from "../components/ui/States";
import {
  Plus, Trash2, Webhook, MessageSquare, Mail, Send,
  CheckCircle2, XCircle, Clock, Power, PowerOff, Bell,
} from "lucide-react";

const typeConfig = {
  webhook: { icon: Webhook,        label: "Webhook" },
  slack:   { icon: MessageSquare,  label: "Slack" },
  discord: { icon: MessageSquare,  label: "Discord" },
  email:   { icon: Mail,           label: "Email" },
};

const Alerts = () => {
  const [channels, setChannels] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("channels");
  const [formData, setFormData] = useState({ name: "", type: "webhook", url: "", cooldownMinutes: 5 });
  const reduce = useReducedMotion();

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
  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const config = formData.type === "webhook" ? { url: formData.url } : { webhookUrl: formData.url };
      await api.post("/alerts/channels", { name: formData.name, type: formData.type, config, cooldownMinutes: formData.cooldownMinutes });
      toast.success("Channel created");
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
    } catch { toast.error("Failed to delete channel"); }
  };

  const handleTest = async (id) => {
    try {
      await api.post("/alerts/channels/" + id + "/test");
      toast.success("Test alert sent");
    } catch (error) { toast.error(error.response?.data?.error || "Test failed"); }
  };

  const toggleActive = async (channel) => {
    try {
      await api.put("/alerts/channels/" + channel.id, { isActive: !channel.isActive });
      toast.success(channel.isActive ? "Channel disabled" : "Channel enabled");
      fetchData();
    } catch { toast.error("Failed to update channel"); }
  };

  if (loading) return <Loading label="Loading alerts" />;

  return (
    <div>
      <PageHeader
        eyebrow="Notifications"
        title={<>Alert <em>channels</em></>}
        description="Where to send the signal when something starts firing."
        actions={
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="w-4 h-4" /> {showForm ? "Cancel" : "New channel"}
          </Button>
        }
      />

      <div className="mb-6">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "channels", label: "Channels", count: channels.length },
            { value: "logs", label: "Delivery log", count: logs.length },
          ]}
        />
      </div>

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
              <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">New channel</div>
              <h2 className="font-display text-lg mt-0.5">Where should we send it?</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 grid grid-cols-1 md:grid-cols-4 gap-5">
              <Field className="md:col-span-2" label="Name" htmlFor="al-name" required>
                <Input id="al-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Production alerts" />
              </Field>
              <Field className="md:col-span-1" label="Type" htmlFor="al-type">
                <Select id="al-type" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                  <option value="webhook">Webhook</option>
                  <option value="slack">Slack</option>
                  <option value="discord">Discord</option>
                </Select>
              </Field>
              <Field className="md:col-span-1" label="Cooldown" htmlFor="al-cool" help="Minutes between repeats">
                <Input id="al-cool" mono type="number" min={1} value={formData.cooldownMinutes} onChange={(e) => setFormData({ ...formData, cooldownMinutes: parseInt(e.target.value) })} />
              </Field>
              <Field className="md:col-span-4" label={formData.type === "webhook" ? "Webhook URL" : "Incoming webhook URL"} htmlFor="al-url" required>
                <Input id="al-url" mono type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} required placeholder="https://hooks.slack.com/services/…" />
              </Field>
              <div className="md:col-span-4 flex gap-3 pt-2 hairline-t -mx-6 px-6 -mb-6 pb-5 mt-2">
                <Button type="submit">Create channel</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === "channels" && (
        channels.length === 0 ? (
          <Empty
            icon={Bell}
            title="No channels wired up."
            description="Add a Slack, Discord, or generic webhook to receive incidents."
            action={<Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New channel</Button>}
          />
        ) : (
          <div className="hairline bg-paper">
            {channels.map((channel, i) => {
              const conf = typeConfig[channel.type] || typeConfig.webhook;
              const Icon = conf.icon;
              return (
                <div key={channel.id} className={"flex items-center justify-between px-5 py-4 " + (i > 0 ? "hairline-t" : "")}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 hairline flex items-center justify-center text-ink shrink-0">
                      <Icon className="w-4 h-4" strokeWidth={1.6} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{channel.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] font-num uppercase tracking-wider text-muted">
                        <span>{conf.label}</span>
                        <span className="text-bone-strong">·</span>
                        <span>cooldown {channel.cooldownMinutes}m</span>
                        <span className="text-bone-strong">·</span>
                        <span className={channel.isActive ? "text-st-up" : "text-muted"}>
                          {channel.isActive ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleTest(channel.id)} className="p-2 text-muted hover:text-ink transition-colors" aria-label="Send test">
                      <Send className="w-3.5 h-3.5" strokeWidth={1.8} />
                    </button>
                    <button onClick={() => toggleActive(channel)} className="p-2 text-muted hover:text-ink transition-colors" aria-label={channel.isActive ? "Disable" : "Enable"}>
                      {channel.isActive ? <Power className="w-3.5 h-3.5" strokeWidth={1.8} /> : <PowerOff className="w-3.5 h-3.5" strokeWidth={1.8} />}
                    </button>
                    <button onClick={() => handleDelete(channel.id)} className="p-2 text-muted hover:text-st-down transition-colors" aria-label="Delete">
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === "logs" && (
        logs.length === 0 ? (
          <Empty
            icon={Clock}
            title="No deliveries yet."
            description="Alert deliveries will appear here as they fire."
          />
        ) : (
          <div className="hairline bg-paper">
            {logs.map((log, i) => (
              <div key={log.id} className={"flex items-center justify-between px-5 py-3 " + (i > 0 ? "hairline-t" : "")}>
                <div className="flex items-center gap-3 min-w-0">
                  {log.status === "sent"
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-st-up shrink-0" strokeWidth={1.8} />
                    : <XCircle className="w-3.5 h-3.5 text-st-down shrink-0" strokeWidth={1.8} />}
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{log.Monitor?.name || "—"}</p>
                    <p className="text-[11px] font-num uppercase tracking-wider text-muted truncate">
                      {log.AlertChannel?.name} · {log.AlertChannel?.type} · {log.type}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] font-num text-muted shrink-0">
                  {new Date(log.sentAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default Alerts;
