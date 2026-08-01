import { useState, useEffect } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/Field";
import { Loading } from "./ui/States";
import {
  Shield, ShieldCheck, ShieldOff, Monitor, Trash2, Copy, LogOut, Activity,
} from "lucide-react";

// ==============================================================
// Section wrapper — hairline card with editorial header
// ==============================================================
const Section = ({ eyebrow, title, description, children, className = "" }) => (
  <section className={"hairline bg-paper " + className}>
    <header className="px-6 py-5 hairline-b">
      {eyebrow && <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted">{eyebrow}</div>}
      <h3 className="font-display text-lg text-ink mt-0.5">{title}</h3>
      {description && <p className="text-sm text-muted mt-1">{description}</p>}
    </header>
    <div className="p-6">{children}</div>
  </section>
);

const copyToClipboard = (text) => {
  if (navigator.clipboard) navigator.clipboard.writeText(text);
  toast.success("Copied");
};

// ==============================================================
// MFA
// ==============================================================
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
    } catch (e) { toast.error(e.response?.data?.error || "Setup failed"); }
    finally { setBusy(false); }
  };

  const confirmSetup = async () => {
    setBusy(true);
    try {
      const res = await api.post("/auth/mfa/verify", { code });
      setBackupCodes(res.data.backupCodes);
      setSetupData(null); setCode("");
      onChange?.();
      toast.success("MFA enabled");
    } catch (e) { toast.error(e.response?.data?.error || "Verification failed"); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await api.post("/auth/mfa/disable", { password: disablePw, code });
      onChange?.();
      setDisablePw(""); setCode("");
      toast.success("MFA disabled");
    } catch (e) { toast.error(e.response?.data?.error || "Disable failed"); }
    finally { setBusy(false); }
  };

  const regen = async () => {
    setBusy(true);
    try {
      const res = await api.post("/auth/mfa/backup-codes/regenerate", { code });
      setBackupCodes(res.data.backupCodes);
      setCode("");
      toast.success("Backup codes regenerated");
    } catch (e) { toast.error(e.response?.data?.error || "Regenerate failed"); }
    finally { setBusy(false); }
  };

  if (backupCodes) {
    return (
      <Section
        eyebrow="Backup codes"
        title="Save these somewhere safe"
        description="Each code works exactly once and won't be shown again."
      >
        <div className="grid grid-cols-2 gap-2 mb-5">
          {backupCodes.map((c) => (
            <div key={c} className="hairline bg-paper px-3 py-2 font-num text-sm text-ink tracking-widest text-center">
              {c}
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => copyToClipboard(backupCodes.join("\n"))}>
            <Copy className="w-4 h-4" /> Copy all
          </Button>
          <Button onClick={() => setBackupCodes(null)}>I've saved them</Button>
        </div>
      </Section>
    );
  }

  if (setupData) {
    return (
      <Section
        eyebrow="Two-factor · Setup"
        title="Scan the QR code"
        description="Open your authenticator app (1Password, Authy, Google Authenticator) and scan, then enter the code it shows."
      >
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="hairline bg-paper p-3">
            <img src={setupData.qrDataUrl} alt="MFA QR" className="w-40 h-40 bg-white" />
          </div>
          <div className="flex-1 space-y-4 w-full">
            <div>
              <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted mb-2">
                Or enter this secret manually
              </div>
              <div className="flex items-stretch hairline bg-paper">
                <code className="flex-1 px-3 py-2.5 text-xs font-num text-ink break-all">{setupData.secret}</code>
                <button
                  onClick={() => copyToClipboard(setupData.secret)}
                  className="px-3 hairline-l text-muted hover:text-ink transition-colors"
                  aria-label="Copy secret"
                >
                  <Copy className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>
            <Field label="Verification code" htmlFor="mfa-setup-code">
              <Input
                id="mfa-setup-code"
                mono
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123 456"
                className="text-center tracking-[0.4em]"
              />
            </Field>
            <div className="flex gap-3">
              <Button disabled={busy || code.length < 6} onClick={confirmSetup}>
                Confirm and enable MFA
              </Button>
              <Button variant="ghost" onClick={() => { setSetupData(null); setCode(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </Section>
    );
  }

  if (mfaEnabled) {
    return (
      <Section
        eyebrow="Two-factor authentication"
        title="Enabled"
        description="MFA is currently active on your account."
      >
        <div className="flex items-center gap-2 mb-6 text-st-up">
          <ShieldCheck className="w-4 h-4" strokeWidth={1.8} />
          <span className="text-[10px] font-num uppercase tracking-[0.15em]">Active</span>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="hairline bg-paper p-5">
            <div className="text-[10px] font-num uppercase tracking-[0.15em] text-muted mb-1">Backup codes</div>
            <p className="text-sm text-ink mb-1">Regenerate</p>
            <p className="text-xs text-muted mb-4">Invalidates old codes. Enter a current TOTP.</p>
            <Input mono value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123 456" className="text-center tracking-[0.4em] mb-3" />
            <Button variant="ghost" disabled={busy || code.length < 6} onClick={regen} className="w-full">Regenerate</Button>
          </div>
          <div className="hairline bg-st-down-wash p-5">
            <div className="text-[10px] font-num uppercase tracking-[0.15em] text-st-down mb-1 inline-flex items-center gap-2">
              <ShieldOff className="w-3 h-3" strokeWidth={2} /> Destructive
            </div>
            <p className="text-sm text-ink mb-1">Disable MFA</p>
            <p className="text-xs text-muted mb-4">Requires current password + a TOTP code.</p>
            <Input type="password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} placeholder="Current password" className="mb-2" />
            <Input mono value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" inputMode="numeric" className="text-center tracking-[0.4em] mb-3" />
            <Button variant="danger" disabled={busy || !disablePw || code.length < 6} onClick={disable} className="w-full">Disable</Button>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section
      eyebrow="Two-factor authentication"
      title="Not enabled"
      description="Add a second step to sign in, using an authenticator app (TOTP)."
    >
      <div className="flex items-center gap-2 mb-6 text-muted">
        <Shield className="w-4 h-4" strokeWidth={1.8} />
        <span className="text-[10px] font-num uppercase tracking-[0.15em]">Off</span>
      </div>
      <Button onClick={startSetup} disabled={busy}>Enable MFA</Button>
    </Section>
  );
};

// ==============================================================
// Sessions
// ==============================================================
const SessionsCard = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/auth/sessions");
      setSessions(res.data.sessions);
    } catch (e) { toast.error(e.response?.data?.error || "Failed to load sessions"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id) => {
    try { await api.delete(`/auth/sessions/${id}`); toast.success("Session revoked"); load(); }
    catch (e) { toast.error(e.response?.data?.error || "Revoke failed"); }
  };

  const revokeAll = async () => {
    if (!confirm("Sign out of every other device? Your current session stays active.")) return;
    try { await api.post("/auth/logout-all-devices"); toast.success("All other sessions revoked"); load(); }
    catch (e) { toast.error(e.response?.data?.error || "Failed"); }
  };

  return (
    <Section
      eyebrow="Sessions"
      title="Active sessions"
      description="Sessions that can currently issue new access tokens."
    >
      {loading ? (
        <Loading label="Loading sessions" />
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted">No active sessions.</p>
      ) : (
        <>
          <div className="hairline bg-paper mb-4">
            {sessions.map((s, i) => (
              <div key={s.id} className={"flex items-center justify-between px-4 py-3 " + (i > 0 ? "hairline-t" : "")}>
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2 text-sm text-ink">
                    <Monitor className="w-3.5 h-3.5 text-muted shrink-0" strokeWidth={1.8} />
                    <span className="truncate">{s.userAgent || "Unknown device"}</span>
                    {s.current && (
                      <span className="text-[10px] font-num uppercase tracking-wider px-2 py-0.5 bg-ink text-paper">
                        this device
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-num text-muted mt-1 truncate">
                    {s.ipAddress || "unknown ip"} · last used {new Date(s.lastUsedAt).toLocaleString()}
                  </p>
                </div>
                {!s.current && (
                  <button
                    onClick={() => revoke(s.id)}
                    className="p-2 text-muted hover:text-st-down transition-colors"
                    aria-label="Revoke session"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <Button variant="danger" onClick={revokeAll}>
            <LogOut className="w-4 h-4" /> Sign out of all other devices
          </Button>
        </>
      )}
    </Section>
  );
};

// ==============================================================
// Security events
// ==============================================================
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
    <Section
      eyebrow="Activity"
      title="Recent security events"
      description="Auth-related events on your account."
    >
      {loading ? (
        <Loading label="Loading activity" />
      ) : events.length === 0 ? (
        <p className="text-sm text-muted">No events yet.</p>
      ) : (
        <div className="hairline bg-paper">
          {events.map((e, i) => (
            <div key={e.id} className={"flex items-start gap-3 px-4 py-3 text-sm " + (i > 0 ? "hairline-t" : "")}>
              <Activity className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" strokeWidth={1.8} />
              <div className="flex-1 min-w-0">
                <div className="text-ink capitalize">{e.eventType.replace(/_/g, " ")}</div>
                <div className="text-[11px] font-num text-muted truncate">
                  {e.ipAddress || "unknown ip"} · {new Date(e.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
};

// ==============================================================
// Root
// ==============================================================
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
