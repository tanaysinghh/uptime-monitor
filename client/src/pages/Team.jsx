import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import api from "../api/axios";
import toast from "react-hot-toast";
import { PageHeader } from "../components/ui/Section";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/Field";
import { Tabs } from "../components/ui/Tabs";
import { Loading, Empty } from "../components/ui/States";
import { UserPlus, Trash2, Users, ScrollText } from "lucide-react";

const roleConf = {
  admin:  { label: "Admin",  hint: "Full access, billing, security" },
  editor: { label: "Editor", hint: "Create, edit, delete monitors" },
  viewer: { label: "Viewer", hint: "Read-only" },
};

const initialsOf = (name) => (name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

const Team = () => {
  const [members, setMembers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [activeTab, setActiveTab] = useState("members");
  const [inviteData, setInviteData] = useState({ name: "", email: "", password: "", role: "viewer" });
  const reduce = useReducedMotion();

  const fetchData = async () => {
    try {
      const [membersRes, logsRes] = await Promise.all([
        api.get("/team/members"),
        api.get("/team/audit-log"),
      ]);
      setMembers(membersRes.data.members);
      setAuditLogs(logsRes.data.logs);
    } catch (error) {
      console.error("Failed to fetch team data:", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchData(); }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      await api.post("/team/members", inviteData);
      toast.success("Member invited");
      setShowInvite(false);
      setInviteData({ name: "", email: "", password: "", role: "viewer" });
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || "Failed to invite"); }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await api.put("/team/members/" + memberId + "/role", { role: newRole });
      toast.success("Role updated");
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || "Failed"); }
  };

  const handleRemove = async (memberId) => {
    if (!window.confirm("Remove this team member?")) return;
    try {
      await api.delete("/team/members/" + memberId);
      toast.success("Member removed");
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || "Failed"); }
  };

  if (loading) return <Loading label="Loading team" />;

  return (
    <div>
      <PageHeader
        eyebrow={<span className="font-num">{members.length.toString().padStart(2, "0")} members</span>}
        title={<>Your <em>team</em></>}
        description="Members, roles, and every change ever made."
        actions={
          <Button onClick={() => setShowInvite((s) => !s)}>
            <UserPlus className="w-4 h-4" /> {showInvite ? "Cancel" : "Invite"}
          </Button>
        }
      />

      <div className="mb-6">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "members", label: "Members", count: members.length },
            { value: "audit", label: "Audit log", count: auditLogs.length },
          ]}
        />
      </div>

      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={reduce ? {} : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? {} : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="hairline bg-paper mb-6"
          >
            <div className="px-6 py-5 hairline-b">
              <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">Invite member</div>
              <h2 className="font-display text-lg mt-0.5">Add a new teammate</h2>
            </div>
            <form onSubmit={handleInvite} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Name" htmlFor="tm-name" required>
                <Input id="tm-name" value={inviteData.name} onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })} required placeholder="Jane Doe" />
              </Field>
              <Field label="Email" htmlFor="tm-email" required>
                <Input id="tm-email" type="email" value={inviteData.email} onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })} required placeholder="jane@example.com" />
              </Field>
              <Field label="Temporary password" htmlFor="tm-pw" required help="They can change it after signing in.">
                <Input id="tm-pw" value={inviteData.password} onChange={(e) => setInviteData({ ...inviteData, password: e.target.value })} required minLength={6} placeholder="temp123456" />
              </Field>
              <Field label="Role" htmlFor="tm-role" help={roleConf[inviteData.role]?.hint}>
                <Select id="tm-role" value={inviteData.role} onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}>
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
              <div className="md:col-span-2 flex gap-3 pt-2 hairline-t -mx-6 px-6 -mb-6 pb-5 mt-2">
                <Button type="submit">Send invite</Button>
                <Button type="button" variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === "members" && (
        members.length === 0 ? (
          <Empty icon={Users} title="Only you, for now." description="Invite teammates to share the workspace." />
        ) : (
          <div className="hairline bg-paper">
            {members.map((member, i) => (
              <div key={member.id} className={"flex items-center justify-between px-5 py-4 " + (i > 0 ? "hairline-t" : "")}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 bg-ink text-paper flex items-center justify-center text-xs font-num tracking-wider">
                    {initialsOf(member.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{member.name}</p>
                    <p className="text-[11px] font-num text-muted truncate">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    className="h-9 text-xs font-num uppercase tracking-wider w-32"
                    aria-label={`Role for ${member.name}`}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </Select>
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="p-2 text-muted hover:text-st-down transition-colors"
                    aria-label={`Remove ${member.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === "audit" && (
        auditLogs.length === 0 ? (
          <Empty icon={ScrollText} title="Nothing to audit yet." description="Every workspace action shows up here as it happens." />
        ) : (
          <div className="hairline bg-paper">
            {auditLogs.map((log, i) => (
              <div key={log.id} className={"flex items-start justify-between gap-4 px-5 py-3 " + (i > 0 ? "hairline-t" : "")}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    <span className="font-medium">{log.User?.name || "Unknown"}</span>
                    <span className="text-muted"> {log.action.replace(/_/g, " ")} </span>
                    <span className="font-num text-muted">{log.resource}</span>
                  </p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-[11px] font-num text-muted mt-1 truncate">
                      {JSON.stringify(log.details).slice(0, 120)}
                    </p>
                  )}
                </div>
                <div className="text-[11px] font-num text-muted shrink-0 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default Team;
