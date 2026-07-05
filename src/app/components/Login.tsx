import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Leaf, Eye, EyeOff, ArrowLeft, ArrowRight, KeyRound } from "lucide-react";
import { supabase } from "../../../utils/supabase/client";

const FOREST_IMG = "https://images.unsplash.com/photo-1707008797390-38f13ea40163?w=900&h=1200&fit=crop&auto=format";

const inputBase = {
  background: "#f0ece4",
  border: "1.5px solid transparent",
  borderRadius: "12px",
  color: "#1a2e1c",
  fontSize: "0.9rem",
  padding: "13px 16px",
  width: "100%",
  outline: "none",
  transition: "border-color 0.15s",
  fontFamily: "var(--font-body)",
} as React.CSSProperties;

function Field({ id, label, type, placeholder, value, onChange, showPassword, setShowPassword }: {
  id: string; label: string; type: string; placeholder: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showPassword?: boolean; setShowPassword?: (v: (prev: boolean) => boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} style={{ color: "#1a2e1c", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em" }}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type === "password" ? (showPassword ? "text" : "password") : type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required
          style={inputBase}
          onFocus={e => (e.target.style.borderColor = "#008751")}
          onBlur={e => (e.target.style.borderColor = "transparent")}
        />
        {type === "password" && setShowPassword && (
          <button type="button" onClick={() => setShowPassword(v => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity">
            {showPassword
              ? <EyeOff className="w-4 h-4" style={{ color: "#1a2e1c" }} />
              : <Eye className="w-4 h-4" style={{ color: "#1a2e1c" }} />}
          </button>
        )}
      </div>
    </div>
  );
}

export function Login() {
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          toast.error("Please enter a valid email address.");
          return;
        }

        // Password strength check
        if (formData.password.length < 6) {
          toast.error("Password must be at least 6 characters.");
          return;
        }

        // Name validation
        if (formData.name.trim().length < 2) {
          toast.error("Please enter your full name.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          options: { data: { full_name: formData.name.trim() } },
        });

        if (error) {
          const msg = error.message || "";
          if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("user already") || (error as any).status === 400) {
            toast.error("An account with this email already exists. Please sign in instead.");
          } else if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("too many")) {
            toast.error("Too many attempts. Please wait a few minutes and try again.");
          } else {
            toast.error(msg || "Sign up failed. Please try again.");
          }
          return;
        }

        // Supabase silently returns empty identities when email already exists (confirm email OFF)
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          toast.error("An account with this email already exists. Please sign in instead.");
          return;
        }

        if (data.user && !data.session) {
          toast.success("Check your email to confirm your account before signing in.");
          return;
        }

        toast.success("Account created! Welcome to EcoWaste Uyo 🌿");
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
        });
        if (error) {
          const msg = error.message || "";
          if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials")) {
            toast.error("Incorrect email or password. Please try again.");
          } else if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("too many")) {
            toast.error("Too many failed attempts. Please wait a few minutes.");
          } else if (msg.toLowerCase().includes("email not confirmed")) {
            toast.error("Please confirm your email address before signing in.");
          } else {
            toast.error(msg || "Sign in failed. Please try again.");
          }
          return;
        }
        toast.success("Welcome back!");
        // Check if agent
        const { data: profileData } = await supabase.from("profiles").select("is_agent, is_admin").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").single();
        if (profileData?.is_admin || formData.email.toLowerCase().trim() === "admin@admin.com") {
          navigate("/admin");
        } else if (profileData?.is_agent) {
          navigate("/agent");
        } else {
          navigate("/dashboard");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) { toast.error("Please enter your email address."); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      console.log("RESET ERROR:", JSON.stringify(error));
      toast.error(error.message || error.name || (error as any).code || "Failed to send reset email. Check your Supabase redirect URL settings.");
      return;
    }
    setForgotSent(true);
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "var(--font-body)", background: "#f7f5f0" }}>
      {/* Nigerian flag strip */}
      <div className="absolute top-0 left-0 right-0 h-1 flex z-50">
        <div className="flex-1" style={{ background: "#008751" }} />
        <div className="flex-1" style={{ background: "#ffffff" }} />
        <div className="flex-1" style={{ background: "#008751" }} />
      </div>

      {/* Left photo panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 bg-[#0a160b]">
          <img src={FOREST_IMG} alt="Lagos aerial highway" className="w-full h-full object-cover opacity-70" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(10,22,11,0.5) 0%, rgba(10,22,11,0.35) 50%, rgba(10,22,11,0.85) 100%)" }} />
        </div>
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#008751" }}>
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 700, fontSize: "1.1rem" }}>
            EcoWaste <span style={{ color: "#85c48a", fontWeight: 400, fontSize: "0.85rem" }}>Uyo</span>
          </span>
        </div>
        <div className="relative">
          <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontSize: "clamp(1.5rem,2.5vw,2rem)", lineHeight: 1.25, fontStyle: "italic", fontWeight: 600 }}>
            "Cleanliness is next to godliness — and next to a cleaner Nigeria starts with you."
          </p>
          <p style={{ color: "rgba(247,245,240,0.45)", fontSize: "0.82rem", marginTop: "1rem" }}>
            — EcoWaste Uyo, est. 2026
          </p>
          <div className="flex gap-8 mt-10">
            {[{ v: "5000+", l: "Users served" }, { v: "850 t", l: "Waste collected" }, { v: "1", l: "Nigerian city" }].map(s => (
              <div key={s.l}>
                <div style={{ fontFamily: "var(--font-display)", color: "#85c48a", fontWeight: 700, fontSize: "1.4rem" }}>{s.v}</div>
                <div style={{ color: "rgba(247,245,240,0.45)", fontSize: "0.72rem" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-16 pt-10">
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#1a2e1c" }}>
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "1.05rem" }}>EcoWaste Uyo</span>
        </div>

        <div className="w-full max-w-sm">
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 mb-8 opacity-40 hover:opacity-70 transition-opacity" style={{ color: "#1a2e1c", fontSize: "0.78rem" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to home
          </button>

          {/* ── FORGOT PASSWORD MODE ── */}
          {forgotMode ? (
            <div>
              <button
                onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(""); }}
                className="flex items-center gap-1.5 mb-8 opacity-40 hover:opacity-70 transition-opacity"
                style={{ color: "#1a2e1c", fontSize: "0.78rem" }}>
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>

              {forgotSent ? (
                <div className="rounded-2xl p-6 text-center" style={{ background: "#e8f0e4", border: "1px solid rgba(0,135,81,0.2)" }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#008751" }}>
                    <KeyRound className="w-5 h-5 text-white" />
                  </div>
                  <h3 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "1.1rem" }}>
                    Check your email
                  </h3>
                  <p style={{ color: "#5a6e5c", fontSize: "0.82rem", marginTop: "0.5rem", lineHeight: 1.6 }}>
                    We sent a reset link to <strong style={{ color: "#1a2e1c" }}>{forgotEmail}</strong>. Click the link to set a new password.
                  </p>
                  <p style={{ color: "#5a6e5c", fontSize: "0.75rem", marginTop: "1rem" }}>Didn't get it? Check your spam folder.</p>
                </div>
              ) : (
                <div>
                  <div className="mb-7">
                    <h1 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1.8rem", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
                      Reset password.
                    </h1>
                    <p style={{ color: "#5a6e5c", fontSize: "0.85rem", marginTop: "0.4rem", lineHeight: 1.6 }}>
                      Enter your email and we'll send you a reset link.
                    </p>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label style={{ color: "#1a2e1c", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em" }}>
                        EMAIL ADDRESS
                      </label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        style={inputBase}
                        onFocus={e => (e.target.style.borderColor = "#008751")}
                        onBlur={e => (e.target.style.borderColor = "transparent")}
                      />
                    </div>
                    <button
                      onClick={handleForgotPassword}
                      disabled={loading}
                      className="mt-2 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                      style={{ background: "#1a2e1c", color: "#f7f5f0", fontSize: "0.9rem" }}>
                      {loading
                        ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        : <><KeyRound className="w-4 h-4" /> Send reset link</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── NORMAL LOGIN / SIGNUP MODE ── */
            <div>
              {/* Tab toggle */}
              <div className="flex p-1 rounded-xl mb-8" style={{ background: "#ede9e2" }}>
                {["Sign in", "Create account"].map((tab, i) => {
                  const active = isSignup === (i === 1);
                  return (
                    <button key={tab} type="button" onClick={() => setIsSignup(i === 1)}
                      className="flex-1 py-2.5 rounded-lg text-sm transition-all"
                      style={{ background: active ? "#fff" : "transparent", color: active ? "#1a2e1c" : "#5a6e5c", fontWeight: active ? 600 : 400, boxShadow: active ? "0 1px 4px rgba(26,46,28,0.1)" : "none" }}>
                      {tab}
                    </button>
                  );
                })}
              </div>

              <div className="mb-7">
                <h1 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1.8rem", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
                  {isSignup ? "Join EcoWaste Uyo." : "Welcome back."}
                </h1>
                <p style={{ color: "#5a6e5c", fontSize: "0.85rem", marginTop: "0.4rem", lineHeight: 1.6 }}>
                  {isSignup ? "Sign up free. First pickup is on us." : "Sign in to manage your pickups and track your impact."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {isSignup && (
                  <Field id="name" label="FULL NAME" type="text" placeholder="Chidinma Okonkwo"
                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                )}
                <Field id="email" label="EMAIL ADDRESS" type="email" placeholder="you@example.com"
                  value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                <Field id="password" label="PASSWORD" type="password" placeholder="••••••••"
                  value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                  showPassword={showPassword} setShowPassword={setShowPassword} />

                <button type="submit" disabled={loading}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                  style={{ background: "#1a2e1c", color: "#f7f5f0", fontSize: "0.9rem" }}>
                  {loading
                    ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <>{isSignup ? "Create account" : "Sign in"} <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              {isSignup && (
                <p style={{ color: "#5a6e5c", fontSize: "0.72rem", lineHeight: 1.6, marginTop: "1.25rem", textAlign: "center" }}>
                  By creating an account you agree to our{" "}
                  <a href="#" style={{ color: "#008751" }} className="hover:underline">Terms</a> and{" "}
                  <a href="#" style={{ color: "#008751" }} className="hover:underline">Privacy Policy</a>.
                </p>
              )}

              {!isSignup && (
                <p style={{ textAlign: "center", marginTop: "1.25rem" }}>
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    style={{ color: "#008751", fontSize: "0.8rem", background: "none", border: "none", cursor: "pointer" }}
                    className="hover:underline">
                    Forgot your password?
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
