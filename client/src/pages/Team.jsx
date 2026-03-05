import { useState, useEffect } from "react";
import api from "../api/axios";
import { GetStartedButton } from "../components/ui/GetStartedButton";
import toast from "react-hot-toast";
import {
  Users,
  UserPlus,
  Shield,
  Eye,
  Edit3,
  Trash2,
  Clock,
  FileText,
} from "lucide-react";

const roleConfig = {
  admin: { color: "text-red-400", bg: "bg-red-500/10", icon: Shield },
  editor: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Edit3 },
  viewer: { color: "text-gray-400", bg: "bg-gray-500/10", icon: Eye },
};

const Team = () => {
  const [members, setMembers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [activeTab, setActiveTab] = useState("members");
  const [inviteData, setInviteData] = useState({
    name: "",
    email: "",
    password: "",
    role: "viewer",
  });

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

  useEffect(() => {
    fetchData();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      await api.post("/team/members", inviteData);
      toast.success("Member invited");
      setShowInvite(false);
      setInviteData({ name: "", email: "", password: "", role: "viewer" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to invite member");
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await api.put("/team/members/" + memberId + "/role", { role: newRole });
      toast.success("Role updated");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update role");
    }
  };

  const handleRemove = async (memberId) => {
    if (!window.confirm("Remove this team member?")) return;
    try {
      await api.delete("/team/members/" + memberId);
      toast.success("Member removed");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to remove member");
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
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-gray-400 mt-1">{members.length} members</p>
        </div>
        <GetStartedButton onClick={() => setShowInvite(!showInvite)}>
          Invite Member
        </GetStartedButton>
      </div>

      <div className="flex gap-2">
        {["members", "audit log"].map((tab) => (
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

      {showInvite && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Invite New Member</h2>
          <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={inviteData.name}
                onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Temporary Password</label>
              <input
                type="text"
                value={inviteData.password}
                onChange={(e) => setInviteData({ ...inviteData, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="temp123456"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Role</label>
              <select
                value={inviteData.role}
                onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <GetStartedButton onClick={handleInvite}>Send Invite</GetStartedButton>
              <GetStartedButton onClick={() => setShowInvite(false)} className="bg-gray-800 hover:bg-gray-800 border border-gray-700">Cancel</GetStartedButton>
            </div>
          </form>
        </div>
      )}

      {activeTab === "members" && (
        <div className="space-y-3">
          {members.map((member) => {
            const config = roleConfig[member.role] || roleConfig.viewer;
            const RoleIcon = config.icon;
            return (
              <div
                key={member.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={"p-2 rounded-lg " + config.bg}>
                    <RoleIcon className={"w-5 h-5 " + config.color} />
                  </div>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "audit log" && (
        <div className="space-y-3">
          {auditLogs.map((log) => (
            <div
              key={log.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm">
                    <span className="font-medium text-white">{log.User?.name || "Unknown"}</span>
                    <span className="text-gray-400"> {log.action.replace(/_/g, " ")} </span>
                    <span className="text-gray-500">{log.resource}</span>
                  </p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-xs text-gray-600 mt-1">
                      {JSON.stringify(log.details).substring(0, 100)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                {new Date(log.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <p>No audit log entries yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Team;
