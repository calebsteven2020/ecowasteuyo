import { useNavigate } from "react-router";
import { Leaf, ArrowLeft } from "lucide-react";

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#f7f5f0", fontFamily: "var(--font-body)" }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: "#e8f0e4" }}>
        <Leaf className="w-7 h-7" style={{ color: "#008751" }} />
      </div>
      <p style={{ color: "#008751", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>404</p>
      <h1 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, textAlign: "center" }}>
        Page not found.
      </h1>
      <p style={{ color: "#5a6e5c", fontSize: "0.9rem", marginTop: "0.75rem", marginBottom: "2rem", textAlign: "center", maxWidth: "340px", lineHeight: 1.65 }}>
        This page doesn't exist — but your clean home does. Head back and keep going.
      </p>
      <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all hover:opacity-90" style={{ background: "#1a2e1c", color: "#f7f5f0", fontSize: "0.875rem" }}>
        <ArrowLeft className="w-4 h-4" /> Go to dashboard
      </button>
    </div>
  );
}
