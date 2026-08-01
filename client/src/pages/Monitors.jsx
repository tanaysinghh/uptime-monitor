import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import api from "../api/axios";
import toast from "react-hot-toast";
import { PageHeader } from "../components/ui/Section";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/Field";
import { StatusDot, StatusLabel } from "../components/ui/StatusDot";
import { UptimeStrip } from "../components/ui/UptimeStrip";
import { Loading, Empty } from "../components/ui/States";
import { Plus, Pause, Play, Trash2, ChevronRight, Activity } from "lucide-react";

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
  const reduce = useReducedMotion();

  const fetchMonitors = async () => {
    try {
      const response = await api.get("/monitors");
      setMonitors(response.data.monitors);
    } catch {
      toast.error("Failed to fetch monitors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMonitors(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/monitors", formData);
      toast.success("Monitor created");
      setShowForm(false);
      setFormData({ name: "", url: "", method: "GET", intervalSeconds: 300, timeoutMs: 30000, expectedStatus: 200 });
      fetchMonitors();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create monitor");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this monitor?")) return;
    try {
      await api.delete("/monitors/" + id);
      toast.success("Monitor deleted");
      fetchMonitors();
    } catch {
      toast.error("Failed to delete monitor");
    }
  };

  const togglePause = async (monitor) => {
    try {
      const newStatus = monitor.status === "paused" ? "pending" : "paused";
      await api.put("/monitors/" + monitor.id, { status: newStatus });
      toast.success(newStatus === "paused" ? "Monitor paused" : "Monitor resumed");
      fetchMonitors();
    } catch {
      toast.error("Failed to update monitor");
    }
  };

  const intervalLabel = (s) =>
    s < 60 ? s + "s" : s < 3600 ? Math.round(s / 60) + "m" : Math.round(s / 3600) + "h";

  if (loading) return <Loading label="Loading monitors" />;

  return (
    <div>
      <PageHeader
        eyebrow={<span className="font-num">{monitors.length.toString().padStart(2, "0")} configured</span>}
        title={<>All your <em>monitors</em></>}
        description="Every endpoint, every check interval, every incident — one table."
        actions={
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="w-4 h-4" strokeWidth={2} /> {showForm ? "Cancel" : "New monitor"}
          </Button>
        }
      />

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={reduce ? {} : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? {} : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="hairline bg-paper mb-8"
          >
            <div className="px-6 py-5 hairline-b flex items-center justify-between">
              <div>
                <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">New monitor</div>
                <h2 className="font-display text-lg text-ink mt-0.5">Configure the endpoint</h2>
              </div>
            </div>
            <form onSubmit={handleCreate} className="p-6 grid grid-cols-1 md:grid-cols-6 gap-5">
              <Field className="md:col-span-2" label="Name" htmlFor="mn-name" required>
                <Input id="mn-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Production API" />
              </Field>
              <Field className="md:col-span-4" label="URL" htmlFor="mn-url" required>
                <Input id="mn-url" type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} required placeholder="https://api.example.com/health" />
              </Field>
              <Field className="md:col-span-2" label="Method" htmlFor="mn-method">
                <Select id="mn-method" value={formData.method} onChange={(e) => setFormData({ ...formData, method: e.target.value })}>
                  <option>GET</option><option>POST</option><option>HEAD</option><option>PUT</option>
                </Select>
              </Field>
              <Field className="md:col-span-2" label="Check interval" htmlFor="mn-interval">
                <Select id="mn-interval" value={formData.intervalSeconds} onChange={(e) => setFormData({ ...formData, intervalSeconds: parseInt(e.target.value) })}>
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={300}>5 minutes</option>
                  <option value={900}>15 minutes</option>
                </Select>
              </Field>
              <Field className="md:col-span-1" label="Timeout" htmlFor="mn-timeout">
                <Input id="mn-timeout" mono type="number" value={formData.timeoutMs} onChange={(e) => setFormData({ ...formData, timeoutMs: parseInt(e.target.value) })} />
              </Field>
              <Field className="md:col-span-1" label="Expected" htmlFor="mn-status">
                <Input id="mn-status" mono type="number" value={formData.expectedStatus} onChange={(e) => setFormData({ ...formData, expectedStatus: parseInt(e.target.value) })} />
              </Field>
              <div className="md:col-span-6 flex gap-3 pt-2 hairline-t -mx-6 px-6 -mb-6 pb-5 mt-2">
                <Button type="submit">Create monitor</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {monitors.length === 0 ? (
        <Empty
          icon={Activity}
          title="No monitors yet."
          description="Add your first endpoint. 30-second checks. p95/p99 latency. Alerts wherever your team works."
          action={<Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New monitor</Button>}
        />
      ) : (
        <div className="hairline bg-paper">
          {/* Header row */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 hairline-b text-[10px] font-num uppercase tracking-[0.15em] text-muted">
            <div className="col-span-4">Name</div>
            <div className="col-span-1">Method</div>
            <div className="col-span-1">Every</div>
            <div className="col-span-4">Last 90 days</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {monitors.map((monitor, idx) => (
            <div
              key={monitor.id}
              className={"group grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-5 py-4 hover:bg-bone/40 transition-colors " + (idx > 0 ? "hairline-t" : "")}
            >
              <div className="md:col-span-4 min-w-0">
                <Link to={`/monitors/${monitor.id}`} className="group/link inline-flex items-center gap-2 min-w-0">
                  <StatusDot status={monitor.status} />
                  <span className="text-sm text-ink truncate group-hover/link:text-pulse transition-colors">{monitor.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.8} />
                </Link>
                <p className="text-xs text-muted mt-0.5 truncate font-num pl-4">{monitor.url}</p>
              </div>
              <div className="md:col-span-1 text-xs font-num text-muted uppercase">{monitor.method}</div>
              <div className="md:col-span-1 text-xs font-num text-muted">{intervalLabel(monitor.intervalSeconds)}</div>
              <div className="md:col-span-4">
                <UptimeStrip uptimeDays={monitor.uptimeDays || []} size="sm" showLegend={false} days={90} />
              </div>
              <div className="md:col-span-2 flex items-center gap-1 md:justify-end">
                <StatusLabel status={monitor.status} />
                <button
                  onClick={() => togglePause(monitor)}
                  className="p-2 text-muted hover:text-ink transition-colors"
                  aria-label={monitor.status === "paused" ? "Resume" : "Pause"}
                >
                  {monitor.status === "paused"
                    ? <Play className="w-3.5 h-3.5" strokeWidth={1.8} />
                    : <Pause className="w-3.5 h-3.5" strokeWidth={1.8} />}
                </button>
                <button
                  onClick={() => handleDelete(monitor.id)}
                  className="p-2 text-muted hover:text-st-down transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Monitors;
