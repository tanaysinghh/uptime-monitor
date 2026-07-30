import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Activity, ShieldCheck } from "lucide-react";
import { GetStartedButton } from "../components/ui/GetStartedButton";
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
        toast("Enter your authenticator code", { icon: "🔐" });
      } else {
        toast.success("Logged in successfully");
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
      toast.success("Logged in successfully");
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4">
            <Activity className="w-10 h-10 text-emerald-500" />
          </Link>
          <h1 className="text-3xl font-bold text-white">
            {mfaChallengeToken ? "Two-factor required" : "Welcome back"}
          </h1>
          <p className="text-gray-400 mt-2">
            {mfaChallengeToken
              ? "Enter the 6-digit code from your authenticator app, or a backup code."
              : "Sign in to your account"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          {!mfaChallengeToken ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex justify-center">
                <GetStartedButton onClick={handleSubmit} className="w-full justify-center">
                  {loading ? "Signing in..." : "Sign in"}
                </GetStartedButton>
              </div>
            </form>
          ) : (
            <form onSubmit={submitMfa} className="space-y-5">
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-200">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span>Password accepted. One more step.</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Authenticator code or backup code
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="text"
                  placeholder="123456 or xxxx-xxxx"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center tracking-widest"
                />
              </div>
              <div className="flex justify-center">
                <GetStartedButton onClick={submitMfa} className="w-full justify-center">
                  {loading ? "Verifying..." : "Verify"}
                </GetStartedButton>
              </div>
              <button
                type="button"
                onClick={cancelMfa}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-200"
              >
                Back to sign in
              </button>
            </form>
          )}
          <p className="text-center text-gray-400 text-sm mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-emerald-400 hover:text-emerald-300">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
