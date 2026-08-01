import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/ui/button";
import { Field, Input } from "../components/ui/Field";
import { ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaChallengeToken, setMfaChallengeToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login, completeMfa } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.requiresMfa) {
        setMfaChallengeToken(result.mfaChallengeToken);
        toast("Enter your authenticator code");
      } else {
        toast.success("Signed in");
        navigate("/dashboard");
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await completeMfa(mfaChallengeToken, code);
      toast.success("Signed in");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.error || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const cancelMfa = () => {
    setMfaChallengeToken(null);
    setCode("");
    setPassword("");
  };

  return (
    <AuthShell
      eyebrow={mfaChallengeToken ? "Step 2 of 2" : "Sign in"}
      title={mfaChallengeToken ? <><em>Two factors</em>, one you.</> : <>Welcome <em>back</em>.</>}
      description={
        mfaChallengeToken
          ? "Enter the 6-digit code from your authenticator app, or a single-use backup code."
          : "Continue to your monitoring workspace."
      }
      footer={
        !mfaChallengeToken && (
          <>
            No account yet?{" "}
            <Link to="/register" className="text-ink underline underline-offset-4 hover:text-pulse">
              Create one
            </Link>
          </>
        )
      }
    >
      {!mfaChallengeToken ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitMfa} className="space-y-6">
          <div className="hairline bg-st-up-wash px-4 py-3 flex items-center gap-3 text-sm text-st-up">
            <ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={1.8} />
            <span>Password accepted. One more step.</span>
          </div>
          <Field label="Authenticator or backup code" htmlFor="mfa" required>
            <Input
              id="mfa"
              mono
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode="text"
              placeholder="123 456"
              className="text-center tracking-[0.4em] text-base"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Verifying…" : "Verify and continue"}
          </Button>
          <Button type="button" variant="text" onClick={cancelMfa} className="text-xs">
            ← Back to sign in
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export default Login;
