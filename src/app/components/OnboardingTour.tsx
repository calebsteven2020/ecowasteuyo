import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Leaf, Calendar, BarChart3, ArrowRight, X, CheckCircle } from "lucide-react";

const STEPS = [
  {
    icon: Leaf,
    emoji: "🌿",
    title: "Welcome to EcoWaste Uyo!",
    description: "You're now part of a movement building a cleaner Uyo. Here's a quick tour to get you started.",
    bg: "#1a2e1c",
    ic: "#85c48a",
  },
  {
    icon: Calendar,
    emoji: "📅",
    title: "Book a pickup",
    description: "Go to Book a Pickup, choose your waste type, address, date, and time slot. Our verified agents arrive within your window.",
    bg: "#e8f0e4",
    ic: "#008751",
  },
  {
    icon: CheckCircle,
    emoji: "🚛",
    title: "Track your collection",
    description: "Head to Pickup History to track your scheduled collections in real time — from Scheduled → In Progress → Completed.",
    bg: "#e8f0e4",
    ic: "#008751",
  },
  {
    icon: BarChart3,
    emoji: "📊",
    title: "See your impact",
    description: "Every completed pickup generates an impact certificate showing your CO₂ saved, trees protected, and water conserved. Check your Dashboard.",
    bg: "#e8f0e4",
    ic: "#008751",
  },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    const key = `onboarding_done_${user.id}`;
    if (!localStorage.getItem(key)) {
      // Small delay so it doesn't flash immediately on mount
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [user]);

  const dismiss = () => {
    if (user) localStorage.setItem(`onboarding_done_${user.id}`, "1");
    setVisible(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else dismiss();
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(10,22,11,0.75)", animation: "fadeInOverlay 0.2s ease" }}>
      <style>{`@keyframes fadeInOverlay { from { opacity:0; } to { opacity:1; } } @keyframes fadeInCard { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }`}</style>

      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "#fff", boxShadow: "0 32px 80px rgba(10,22,11,0.35)", animation: "fadeInCard 0.25s ease" }}>

        {/* Progress bar */}
        <div className="h-1 flex" style={{ background: "#e8f0e4" }}>
          {STEPS.map((_, i) => (
            <div key={i} className="flex-1 transition-all" style={{ background: i <= step ? "#008751" : "transparent", borderRight: i < STEPS.length - 1 ? "1px solid #e8f0e4" : "none" }} />
          ))}
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className="rounded-full transition-all"
                style={{ width: i === step ? 20 : 6, height: 6, background: i === step ? "#008751" : i < step ? "#85c48a" : "#e8f0e4" }} />
            ))}
          </div>
          <button onClick={dismiss} className="p-1.5 rounded-full hover:bg-[#f0ece4] transition-colors">
            <X className="w-4 h-4" style={{ color: "#5a6e5c" }} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-2xl"
            style={{ background: current.bg }}>
            {current.emoji}
          </div>

          <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.6rem" }}>
            {current.title}
          </h2>
          <p style={{ color: "#5a6e5c", fontSize: "0.875rem", lineHeight: 1.7, marginBottom: "1.75rem" }}>
            {current.description}
          </p>

          <div className="flex gap-3">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                style={{ background: "#f0ece4", color: "#1a2e1c" }}>
                Back
              </button>
            )}
            <button onClick={next}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
              style={{ background: "#1a2e1c", color: "#f7f5f0" }}>
              {step === STEPS.length - 1 ? <>Let's go! 🚀</> : <>Next <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </div>

          {step === 0 && (
            <button onClick={dismiss} className="w-full mt-3 py-2 text-xs text-center hover:underline" style={{ color: "#5a6e5c" }}>
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
