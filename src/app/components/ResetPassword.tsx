import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Leaf, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";
import { supabase } from "../../../utils/supabase/client";

const inputBase = {
  background: "#f0ece4", border: "1.5px solid transparent", borderRadius: "12px",
  color: "#1a2e1c", fontSize: "0.9rem", padding: "13px 16px", width: "100%",
  outline: "none", transition: "border-color 0.15s", fontFamily: "var(--font-body)",
} as React.CSSProperties;

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    // Supabase puts the token in the URL hash — getSession picks it up automatically
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValidSession(true);
      else {
        toast.error("Invalid or expired reset link. Please request a new one.");
        navigate("/login");
      }
    });
  }, [navigate]);

  const handleReset = async () => {
    if (!password) { toast.error("Please enter a new password."); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message || "Failed to update password."); return; }
    setDone(true);
    setTimeout(() => navigate("/login"), 3000);
  };

  if (!validSession) return (
    <div className="min-h-svh flex items-center justify-center" style={{ background: "#f7f5f0" }}>
      <div className="w-8 h-8 rounded-full border-2 border-[#008751] border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6" style={{ background: "#f7f5f0", fontFamily: "var(--font-body)" }}>
      {/* Nigerian flag strip */}
      <div className="fixed top-0 left-0 right-0 h-1 flex z-50">
        <div className="flex-1" style={{ background: "#008751" }} />
        <div className="flex-1" style={{ background: "#ffffff" }} />
        <div className="flex-1" style={{ background: "#008751" }} />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#1a2e1c" }}>
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "1.05rem" }}>
            EcoWaste Uyo
          </span>
        </div>

        {done ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "#e8f0e4" }}>
              <CheckCircle className="w-7 h-7" style={{ color: "#008751" }} />
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "1.3rem" }}>
              Password updated!
            </h2>
            <p style={{ color: "#5a6e5c", fontSize: "0.82rem", marginTop: "0.5rem", lineHeight: 1.6 }}>
              Your password has been changed. Redirecting you to sign in...
            </p>
          </div>
        ) : (
          <div className="rounded-2xl p-8" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
            <h1 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1.8rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>
              New password.
            </h1>
            <p style={{ color: "#5a6e5c", fontSize: "0.85rem", marginBottom: "1.75rem", lineHeight: 1.6 }}>
              Choose a strong password for your account.
            </p>

            <div className="flex flex-col gap-4">
              {/* Password field */}
              <div className="flex flex-col gap-1.5">
                <label style={{ color: "#1a2e1c", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em" }}>
                  NEW PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"} placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    style={inputBase}
                    onFocus={e => (e.target.style.borderColor = "#008751")}
                    onBlur={e => (e.target.style.borderColor = "transparent")}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity">
                    {showPw ? <EyeOff className="w-4 h-4" style={{ color: "#1a2e1c" }} /> : <Eye className="w-4 h-4" style={{ color: "#1a2e1c" }} />}
                  </button>
                </div>
              </div>

              {/* Confirm field */}
              <div className="flex flex-col gap-1.5">
                <label style={{ color: "#1a2e1c", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em" }}>
                  CONFIRM PASSWORD
                </label>
                <input
                  type={showPw ? "text" : "password"} placeholder="••••••••"
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  style={inputBase}
                  onFocus={e => (e.target.style.borderColor = "#008751")}
                  onBlur={e => (e.target.style.borderColor = "transparent")}
                />
              </div>

              <button onClick={handleReset} disabled={loading}
                className="mt-2 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium transition-colors hover:opacity-90 disabled:opacity-60"
                style={{ background: "#1a2e1c", color: "#f7f5f0", fontSize: "0.9rem" }}>
                {loading
                  ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : <>Update password <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
