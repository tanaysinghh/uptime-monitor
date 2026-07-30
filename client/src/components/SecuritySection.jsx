import { useState, useEffect } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Shield, ShieldCheck, ShieldOff, Monitor, Trash2, Copy, LogOut, Activity } from "lucide-react";

const SectionCard = ({ title, description, children }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
    <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
    {description && <p className="text-sm text-gray-400 mb-4">{description}</p>}
    {children}
  </div>
);

const copyToClipboard = (text) => {
  if (navigator.clipboard) navigator.clipboard.writeText(text);
  toast.success("Copied");
};

const MfaCard = ({ mfaEnabled, onChange }) => {
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState(null);
  const [disablePw, setDisablePw] = useState("");
  const [busy, setBusy] = useState(false);

  const startSetup = async () => {
    setBusy(true);
    try {
      const res = await api.post("/auth/mfa/setup");
      setSetupData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.error || "Setup failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    setBusy(true);
    try {
      const res = await api.post("/auth/mfa/verify", { code });
      setBackupCodes(res.data.backupCodes);
      setSetupData(null);
      setCode("");
      onChange?.();
      toast.success("MFA enabled");
    } catch (e) {
      toast.error(e.response?.data?.error || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await api.post("/auth/mfa/disable", { password: disablePw, code });
      onChange?.();
      setDisablePw("");
      setCode("");
      toast.success("MFA disabled");
    } catch (e) {
      toast.error(e.response?.data?.error || "Disable failed");
    } finally {
      setBusy(false);
    }
  };

  const regen = async () => {
    setBusy(true);
    try {
      const res = await api.post("/auth/mfa/backup-codes/regenerate", { code });
      setBackupCodes(res.data.backupCodes);
      setCode("");
      toast.success("Backup codes regenerated");
    } catch (e) {
      toast.error(e.response?.data?.error || "Regenerate failed");
    } finally {
      setBusy(false);
    }
  };

  if (backupCodes) {
    return (
      <SectionCard
        title="Save your backup codes"
        description="Store these somewhere safe. Each code works exactly once and won't be shown again."
      >
        <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-950 p-4 rounded-lg mb-4">
          {backupCodes.map((c) => (
            <div key={c} className="text-emerald-300 tracking-wider">{c}</div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => copyToClipboard(backupCodes.join("\n"))}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 flex items-center gap-2"
          >
            <Copy className="w-4 h-4" /> Copy all
          </button>
          <button
            onClick={() => setBackupCodes(null)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white"
          >
            I've saved them
          </button>
        </div>
      </SectionCard>
    );
  }

  if (setupData) {
    return (
      <SectionCard
        title="Scan the QR code"
        description="Open your authenticator app (1Password, Authy, Google Authenticator) and scan this code, then enter the 6-digit code it shows."
      >
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <img
            src={setupData.qrDataUrl}
            alt="MFA QR"
            className="w-40 h-40 rounded-lg bg-white p-2"
          />
          <div className="flex-1 space-y-3 w-full">
            <div>
              <p className="text-xs text-gray-500 mb-1">Or enter this secret manually:</p>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-950 rounded text-emerald-300 text-xs break-all">
                  {setupData.secret}
                </code>
                <button
                  onClick={() => copyToClipboard(setupData.secret)}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded"
                  aria-label="Copy secret"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-center tracking-widest"
            />
            <div className="flex gap-2">
              <button
                disabled={busy || code.length < 6}
                onClick={confirmSetup}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white disabled:opacity-50"
              >
                Confirm and enable MFA
              </button>
              <button
                onClick={() => { setSetupData(null); setCode(""); }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </SectionCard>
    );
  }

  if (mfaEnabled) {
    return (
      <SectionCard title="Two-factor authentication" description="MFA is currently enabled on your account.">
        <div className="flex items-center gap-2 mb-4 text-emerald-400">
          <ShieldCheck className="w-5 h-5" />
          <span className="text-sm font-medium">Enabled</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg bg-gray-950 border border-gray-800">
            <p className="text-sm text-gray-300 mb-2 font-medium">Regenerate backup codes</p>
            <p className="text-xs text-gray-500 mb-2">Invalidates old codes. Enter a current TOTP code.</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="123456"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-center mb-2"
            />
            <button
              disabled={busy || code.length < 6}
              onClick={regen}
              className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-200 disabled:opacity-50"
            >
              Regenerate
            </button>
          </div>
          <div className="p-4 rounded-lg bg-gray-950 border border-red-900/40">
            <p className="text-sm text-red-300 mb-2 font-medium flex items-center gap-2">
              <ShieldOff className="w-4 h-4" /> Disable MFA
            </p>
            <p className="text-xs text-gray-500 mb-2">Requires current password + a TOTP code.</p>
            <input
              type="password"
              value={disablePw}
              onChange={(e) => setDisablePw(e.target.value)}
              placeholder="Current password"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white mb-2"
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-center mb-2"
            />
            <button
              disabled={busy || !disablePw || code.length < 6}
              onClick={disable}
              className="w-full px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-sm text-white disabled:opacity-50"
            >
              Disable
            </button>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Two-factor authentication"
      description="Add a second step to sign in, using an authenticator app (TOTP)."
    >
      <div className="flex items-center gap-2 mb-4 text-gray-400">
        <Shield className="w-5 h-5" />
        <span className="text-sm">Not enabled</span>
      </div>
      <button
        onClick={startSetup}
        disabled={busy}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white disabled:opacity-50"
      >
        Enable MFA
      </button>
    </SectionCard>
  );
};

const SessionsCard = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/auth/sessions");
      setSessions(res.data.sessions);
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id) => {
    try {
      await api.delete(`/auth/sessions/${id}`);
      toast.success("Session revoked");
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Revoke failed");
    }
  };

  const revokeAll = async () => {
    if (!confirm("Sign out of every other device? Your current session stays active.")) return;
    try {
      await api.post("/auth/logout-all-devices");
      toast.success("All other sessions revoked");
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed");
    }
  };

  return (
    <SectionCard title="Active sessions" description="Sessions that can currently issue new access tokens.">
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-500">No active sessions.</p>
      ) : (
        <>
          <ul className="space-y-2 mb-4">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between p-3 bg-gray-950 rounded-lg border border-gray-800"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <Monitor className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">{s.userAgent || "Unknown device"}</span>
                    {s.current && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-500/20 text-emerald-300">
                        this device
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {s.ipAddress || "unknown ip"} · last used {new Date(s.lastUsedAt).toLocaleString()}
                  </p>
                </div>
                {!s.current && (
                  <button
                    onClick={() => revoke(s.id)}
                    className="p-2 text-gray-400 hover:text-red-400"
                    aria-label="Revoke session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={revokeAll}
            className="text-sm text-red-300 hover:text-red-200 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign out of all other devices
          </button>
        </>
      )}
    </SectionCard>
  );
};

const EventsCard = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/security/events")
      .then((res) => setEvents(res.data.events))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <SectionCard title="Security activity" description="Recent security-relevant events on your account.">
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500">No events yet.</p>
      ) : (
        <ul className="divide-y divide-gray-800">
          {events.map((e) => (
            <li key={e.id} className="py-2 flex items-start gap-3 text-sm">
              <Activity className="w-4 h-4 text-gray-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-gray-200">{e.eventType.replace(/_/g, " ")}</div>
                <div className="text-xs text-gray-500 truncate">
                  {e.ipAddress || "unknown ip"} · {new Date(e.createdAt).toLocaleString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
};

const SecuritySection = () => {
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const refresh = () => {
    api.get("/auth/me").then((r) => setMfaEnabled(!!r.data.user?.mfaEnabled)).catch(() => {});
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-6">
      <MfaCard mfaEnabled={mfaEnabled} onChange={refresh} />
      <SessionsCard />
      <EventsCard />
    </div>
  );
};

export default SecuritySection;
