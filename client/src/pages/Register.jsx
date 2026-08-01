import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/ui/button";
import { Field, Input } from "../components/ui/Field";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import toast from "react-hot-toast";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, password, orgName);
      toast.success("Account created");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Create account"
      title={<>Set up in <em>under two</em> minutes.</>}
      description="No credit card. 5 monitors free forever."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-ink underline underline-offset-4 hover:text-pulse">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Your name" htmlFor="name" required>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Jane Doe"
            />
          </Field>
          <Field label="Organization" htmlFor="org" required>
            <Input
              id="org"
              autoComplete="organization"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              placeholder="Acme Inc"
            />
          </Field>
        </div>
        <Field label="Work email" htmlFor="email" required>
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
        <Field label="Password" htmlFor="password" required help="At least 8 characters. Mix classes for a stronger score.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
          />
          <PasswordStrengthMeter password={password} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default Register;
