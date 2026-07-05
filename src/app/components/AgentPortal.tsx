import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Leaf, LogOut, CheckCircle, MapPin, Phone, Package,
  RefreshCw, AlertCircle, Navigation2, ListChecks, History as HistoryIcon,
} from "lucide-react";
import { supabase } from "../../../utils/supabase/client";
import { useAuth } from "../context/AuthContext";

interface Pickup {
  id: string;
  user_id: string;
  waste_type: string;
  address: string;
  pickup_date: string;
  pickup_time: string;
  status: string;
  actual_weight?: number | null;
  price?: number | null;
  notes?: string | null;
  profiles?: { full_name: string | null; phone: string | null };
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string; dot: string }> = {
  scheduled:   { bg: "#e8f0e4", color: "#2d5230", label: "Scheduled",   dot: "#008751" },
  in_progress: { bg: "#fff3cd", color: "#856404", label: "In progress", dot: "#f59e0b" },
  completed:   { bg: "#d4e8d5", color: "#1a2e1c", label: "Completed",   dot: "#008751" },
  cancelled:   { bg: "#fde8e8", color: "#c0392b", label: "Cancelled",   dot: "#c0392b" },
};

const formatNaira = (n: number) => "₦" + n.toLocaleString("en-NG");

export function AgentPortal() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPickup, setSelectedPickup] = useState<Pickup | null>(null);
  const [weight, setWeight] = useState("");
  const [completing, setCompleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"today" | "manifest" | "history">("today");
  const [manifest, setManifest] = useState<any[]>([]);

  // Agent name from profile (set by admin) or fallback to metadata
  const agentName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Agent";

  const fetchManifest = useCallback(async () => {
    // Self-healing: flip any subscription whose billing date has passed
    // unpaid to past_due/red, in case the daily cron hasn't run yet.
    await supabase.rpc("flag_overdue_subscriptions");

    const { data: subsData } = await supabase.from("subscriptions").select("*").in("status", ["active", "past_due"]);
    const userIds = [...new Set((subsData ?? []).map((s: any) => s.user_id))];
    let profilesMap: Record<string, { full_name: string | null; phone: string | null; address: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase.from("profiles").select("id, full_name, phone, address").in("id", userIds);
      profilesMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, { full_name: p.full_name, phone: p.phone, address: p.address }]));
    }
    setManifest((subsData ?? []).map((s: any) => ({ ...s, profiles: profilesMap[s.user_id] ?? { full_name: null, phone: null, address: null } })));
  }, []);

  const skipHouse = async (sub: any) => {
    await supabase.from("notifications").insert({
      user_id: sub.user_id,
      title: "Pickup skipped",
      message: "Our driver couldn't collect your waste today — bins weren't out or gate was locked. Please have everything ready next time to avoid disputes.",
      type: "warning",
    });
    toast.success(`Logged skip for ${sub.profiles?.full_name ?? "customer"}.`);
  };

  // NOTE: this used to embed `profiles(full_name, phone)` directly in the
  // pickups query. PostgREST can only auto-embed across a direct foreign
  // key, and pickups.user_id and profiles.id both reference auth.users.id
  // independently — there's no FK *between* pickups and profiles, so that
  // embed always failed server-side and silently returned an empty list.
  // Fetching and merging profiles manually avoids that entirely.
  const fetchPickups = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("pickups")
      .select("*")
      .ilike("agent_name", agentName.trim())
      .order("pickup_date", { ascending: true });

    if (error) {
      console.error("Agent fetch error:", error);
      toast.error("Could not load your pickups: " + error.message);
    }

    const rows = data ?? [];
    const userIds = [...new Set(rows.map(r => r.user_id))];
    let profilesMap: Record<string, { full_name: string | null; phone: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase.from("profiles").select("id, full_name, phone").in("id", userIds);
      profilesMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, { full_name: p.full_name, phone: p.phone }]));
    }
    setPickups(rows.map(r => ({ ...r, profiles: profilesMap[r.user_id] ?? { full_name: null, phone: null } })));
    setLoading(false);
    setRefreshing(false);
  }, [agentName]);

  useEffect(() => {
    fetchPickups();
    fetchManifest();
    // Realtime — watch for new pickups assigned to this agent
    const channel = supabase
      .channel(`agent_${user?.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "pickups",
      }, () => fetchPickups())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPickups, fetchManifest, user?.id]);

  // ── Start a pickup ────────────────────────────────────────────
  const handleStart = async (pickup: Pickup) => {
    const { error } = await supabase
      .from("pickups")
      .update({ status: "in_progress" })
      .eq("id", pickup.id);

    if (error) { toast.error("Failed to start pickup."); return; }

    await supabase.from("notifications").insert({
      user_id: pickup.user_id,
      title: "Agent is on the way",
      message: `${agentName} has started your ${pickup.waste_type} pickup and is heading to you now. You can track them live in your Pickup History.`,
      type: "info",
    });

    setPickups(prev => prev.map(p => p.id === pickup.id ? { ...p, status: "in_progress" } : p));
    toast.success("Pickup started.");
  };

  // ── Complete a pickup ─────────────────────────────────────────
  const handleComplete = async () => {
    if (!selectedPickup || !weight) return;
    setCompleting(true);
    const w = parseFloat(weight);

    await supabase.from("pickups").update({ status: "completed", actual_weight: w }).eq("id", selectedPickup.id);
    await supabase.from("recycling_records").insert({
      user_id: selectedPickup.user_id,
      pickup_id: selectedPickup.id,
      material_type: selectedPickup.waste_type,
      weight_kg: w,
    });
    await supabase.from("notifications").insert({
      user_id: selectedPickup.user_id,
      title: "Pickup completed",
      message: `Your ${selectedPickup.waste_type} pickup has been completed by ${agentName}. ${w}kg collected — thank you.`,
      type: "success",
    });

    setPickups(prev => prev.map(p =>
      p.id === selectedPickup.id ? { ...p, status: "completed", actual_weight: w } : p
    ));
    setSelectedPickup(null);
    setWeight("");
    setCompleting(false);
    toast.success("Pickup marked complete.");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const active = pickups.filter(p => p.status === "scheduled" || p.status === "in_progress");
  const done = pickups.filter(p => p.status === "completed" || p.status === "cancelled");
  const collectedKg = done.filter(p => p.status === "completed").reduce((s, p) => s + (p.actual_weight ?? 0), 0);
  const redCount = manifest.filter(m => m.manifest_status === "red").length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f7f5f0" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#008751] border-t-transparent animate-spin" />
        <p style={{ color: "#5a6e5c", fontSize: "0.8rem" }}>Loading your route…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#f7f5f0", fontFamily: "var(--font-body)" }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:0.35} }
        .agent-card { animation: fadeIn 0.25s ease; }
      `}</style>

      {/* Top bar */}
      <div className="sticky top-0 z-40" style={{ background: "#1a2e1c" }}>
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#008751" }}>
              <Leaf className="w-4 h-4" style={{ color: "#f7f5f0" }} />
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 700, fontSize: "0.85rem", lineHeight: 1.1 }}>EcoWaste</p>
              <p style={{ color: "rgba(247,245,240,0.45)", fontSize: "0.62rem", letterSpacing: "0.04em" }}>COLLECTION CREW</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setRefreshing(true); fetchPickups(); fetchManifest(); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "rgba(247,245,240,0.08)" }}>
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} style={{ color: "#f7f5f0" }} />
            </button>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(133,196,138,0.18)" }}>
              <span style={{ color: "#85c48a", fontWeight: 700, fontSize: "0.78rem" }}>{agentName.charAt(0).toUpperCase()}</span>
            </div>
            <button onClick={handleSignOut}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "rgba(247,245,240,0.08)" }}>
              <LogOut className="w-3.5 h-3.5" style={{ color: "#f7f5f0" }} />
            </button>
          </div>
        </div>
        {/* Route strip — reads like an actual dispatch ticket, not a card */}
        <div className="px-4 sm:px-6 py-2 flex items-center justify-between" style={{ borderTop: "1px solid rgba(247,245,240,0.08)" }}>
          <p style={{ color: "rgba(247,245,240,0.55)", fontSize: "0.7rem" }}>
            {new Date().toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}
          </p>
          <p style={{ color: "rgba(247,245,240,0.55)", fontSize: "0.7rem" }}>
            {active.length} {active.length === 1 ? "stop" : "stops"} left
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 pb-28">

        {/* Greeting + route progress — a progress bar reads as an operational
            tool; three identical boxed tiles read as generic dashboard filler. */}
        <div className="mb-6">
          <h1 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 800, fontSize: "1.4rem", letterSpacing: "-0.01em" }}>
            {agentName.split(" ")[0]}'s route
          </h1>
          <div className="flex items-center justify-between mt-3 mb-1.5">
            <span style={{ color: "#5a6e5c", fontSize: "0.75rem" }}>
              {done.filter(p => p.status === "completed").length} of {pickups.length || done.filter(p => p.status === "completed").length} stops done
            </span>
            <span style={{ color: "#008751", fontSize: "0.75rem", fontWeight: 700 }}>{collectedKg.toFixed(0)}kg collected</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(26,46,28,0.08)" }}>
            <div className="h-full rounded-full transition-all" style={{
              width: pickups.length ? `${(done.filter(p => p.status === "completed").length / pickups.length) * 100}%` : "0%",
              background: "#008751",
            }} />
          </div>
        </div>

        {/* Today */}
        {activeTab === "today" && (
          <div>
            {active.length === 0 ? (
              <div className="rounded-2xl py-14 flex flex-col items-center text-center px-6"
                style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                <Package className="w-9 h-9 mb-3" style={{ color: "#85c48a", opacity: 0.5 }} />
                <p style={{ color: "#1a2e1c", fontWeight: 700, fontSize: "1rem" }}>No stops assigned</p>
                <p style={{ color: "#5a6e5c", fontSize: "0.82rem", marginTop: "0.3rem", lineHeight: 1.6 }}>
                  Pickups assigned to you will show up here automatically.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {active.map((pickup, idx) => {
                  const s = STATUS_STYLES[pickup.status];
                  const inProgress = pickup.status === "in_progress";
                  return (
                    <div key={pickup.id} className="rounded-xl overflow-hidden agent-card flex"
                      style={{ background: "#fff", boxShadow: inProgress ? "0 4px 18px rgba(0,135,81,0.15)" : "0 1px 3px rgba(10,22,11,0.05)" }}>

                      {/* Stop number + accent bar instead of a full colored header block */}
                      <div className="flex flex-col items-center justify-start pt-4 pb-2 flex-shrink-0" style={{ width: "44px", background: inProgress ? "#1a2e1c" : "#f7f5f0" }}>
                        <span style={{ fontFamily: "var(--font-display)", color: inProgress ? "#85c48a" : "#5a6e5c", fontWeight: 800, fontSize: "0.95rem" }}>
                          {idx + 1}
                        </span>
                      </div>

                      <div className="flex-1 px-4 py-4 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "0.92rem" }}>
                              {pickup.waste_type}
                            </p>
                            <p style={{ color: "#5a6e5c", fontSize: "0.7rem", marginTop: "0.1rem" }}>
                              {pickup.pickup_date} · {pickup.pickup_time}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                        </div>

                        <div className="flex items-center gap-2.5 mt-3 pt-3" style={{ borderTop: "1px solid rgba(26,46,28,0.06)" }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#e8f0e4" }}>
                            <span style={{ color: "#008751", fontWeight: 700, fontSize: "0.78rem" }}>
                              {(pickup.profiles?.full_name ?? "U").charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.84rem" }}>
                              {pickup.profiles?.full_name ?? "Customer"}
                            </p>
                            {pickup.profiles?.phone && (
                              <a href={`tel:${pickup.profiles.phone}`} className="flex items-center gap-1" style={{ color: "#008751", fontSize: "0.72rem" }}>
                                <Phone className="w-2.5 h-2.5" /> {pickup.profiles.phone}
                              </a>
                            )}
                          </div>
                          {pickup.price && (
                            <p style={{ fontFamily: "var(--font-display)", color: "#008751", fontWeight: 800, fontSize: "0.95rem", flexShrink: 0 }}>
                              {formatNaira(pickup.price)}
                            </p>
                          )}
                        </div>

                        <div className="flex items-start gap-1.5 mt-3">
                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "#9ba89a" }} />
                          <p style={{ color: "#5a6e5c", fontSize: "0.78rem", lineHeight: 1.5 }}>{pickup.address}</p>
                        </div>

                        {pickup.notes && (
                          <div className="flex items-start gap-1.5 mt-2 py-1.5">
                            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "#b9851f" }} />
                            <p style={{ color: "#856404", fontSize: "0.76rem", lineHeight: 1.5 }}>{pickup.notes}</p>
                          </div>
                        )}

                        <div className="flex gap-2 mt-3.5">
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup.address + ", Nigeria")}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 flex-shrink-0"
                            style={{ background: "#f0ece4", color: "#1a2e1c" }}>
                            <Navigation2 className="w-3.5 h-3.5" style={{ color: "#008751" }} /> Directions
                          </a>

                          {pickup.status === "scheduled" && (
                            <button onClick={() => handleStart(pickup)}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
                              style={{ background: "#008751", color: "#fff" }}>
                              <CheckCircle className="w-4 h-4" /> Start
                            </button>
                          )}
                          {inProgress && (
                            <button onClick={() => setSelectedPickup(pickup)}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
                              style={{ background: "#1a2e1c", color: "#f7f5f0" }}>
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#85c48a", animation: "pulseDot 1.2s infinite" }} />
                              Mark complete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Manifest */}
        {activeTab === "manifest" && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(26,46,28,0.07)" }}>
              <p style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "0.92rem" }}>Subscriber manifest</p>
              <p style={{ color: "#5a6e5c", fontSize: "0.72rem", marginTop: "0.1rem" }}>
                {manifest.length} on file · {redCount} flagged for bypass — no payment, no stop
              </p>
            </div>
            {manifest.length === 0 ? (
              <p className="px-5 py-10 text-center" style={{ color: "#5a6e5c", fontSize: "0.85rem" }}>No subscribers on file yet.</p>
            ) : (
              manifest.map((sub, i) => (
                <div key={sub.id} className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: i < manifest.length - 1 ? "1px solid rgba(26,46,28,0.06)" : "none" }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sub.manifest_status === "green" ? "#008751" : "#c0392b" }} />
                  <div className="flex-1 min-w-0">
                    <p style={{ color: "#1a2e1c", fontWeight: 500, fontSize: "0.82rem" }}>{sub.profiles?.full_name ?? "Customer"}</p>
                    <p style={{ color: "#5a6e5c", fontSize: "0.7rem" }} className="truncate">{sub.profiles?.address ?? "No address on file"}</p>
                  </div>
                  {sub.trash_ready && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0" style={{ background: "#e8f0e4", color: "#2d5230" }}>READY</span>
                  )}
                  {sub.manifest_status === "green" ? (
                    <button onClick={() => skipHouse(sub)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium flex-shrink-0" style={{ background: "#fff3cd", color: "#856404" }}>
                      Skip
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0" style={{ background: "#fde8e8", color: "#c0392b" }}>BYPASS</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* History */}
        {activeTab === "history" && (
          <div>
            {done.length === 0 ? (
              <div className="rounded-2xl py-12 flex flex-col items-center text-center px-6"
                style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                <HistoryIcon className="w-9 h-9 mb-3" style={{ color: "#85c48a", opacity: 0.5 }} />
                <p style={{ color: "#1a2e1c", fontWeight: 700 }}>No completed pickups yet</p>
                <p style={{ color: "#5a6e5c", fontSize: "0.82rem", marginTop: "0.3rem" }}>Completed and cancelled pickups appear here.</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                {done.map((pickup, i) => {
                  const s = STATUS_STYLES[pickup.status];
                  return (
                    <div key={pickup.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[#f7f5f0] transition-colors"
                      style={{ borderBottom: i < done.length - 1 ? "1px solid rgba(26,46,28,0.06)" : "none" }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                        <CheckCircle className="w-4 h-4" style={{ color: s.dot }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.82rem" }}>{pickup.waste_type}</p>
                        <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }} className="truncate">{pickup.address}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                        <p style={{ color: "#5a6e5c", fontSize: "0.68rem", marginTop: "0.2rem" }}>{pickup.pickup_date}</p>
                        {pickup.actual_weight && (
                          <p style={{ color: "#008751", fontSize: "0.68rem", fontWeight: 600 }}>{pickup.actual_weight}kg</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-2 flex items-center justify-around"
        style={{ background: "#fff", borderTop: "1px solid rgba(26,46,28,0.08)", boxShadow: "0 -4px 16px rgba(10,22,11,0.06)" }}>
        {[
          { key: "today", label: "Today", icon: ListChecks, count: active.length },
          { key: "manifest", label: "Manifest", icon: MapPin, count: redCount },
          { key: "history", label: "History", icon: HistoryIcon, count: 0 },
        ].map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className="flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl relative transition-all">
              <div className="relative">
                <tab.icon className="w-5 h-5" style={{ color: isActive ? "#008751" : "#9ba89a" }} />
                {tab.count > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: tab.key === "manifest" ? "#c0392b" : "#008751", color: "#fff" }}>
                    {tab.count}
                  </span>
                )}
              </div>
              <span style={{ color: isActive ? "#1a2e1c" : "#9ba89a", fontSize: "0.65rem", fontWeight: isActive ? 700 : 500 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Complete pickup modal */}
      {selectedPickup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          style={{ background: "rgba(10,22,11,0.65)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "#fff", boxShadow: "0 24px 60px rgba(10,22,11,0.3)" }}>
            <div className="px-6 py-5" style={{ background: "#1a2e1c" }}>
              <p style={{ color: "rgba(247,245,240,0.45)", fontSize: "0.65rem", letterSpacing: "0.08em" }}>CONFIRM COLLECTION</p>
              <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 700, fontSize: "1rem", marginTop: "0.2rem" }}>
                {selectedPickup.waste_type}
              </p>
              <p style={{ color: "rgba(247,245,240,0.45)", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                {selectedPickup.profiles?.full_name ?? "Customer"} · {selectedPickup.address}
              </p>
            </div>
            <div className="p-6">
              <div className="flex flex-col gap-1.5 mb-5">
                <label style={{ color: "#1a2e1c", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em" }}>
                  ACTUAL WEIGHT COLLECTED (kg)
                </label>
                <input type="number" min="0" step="0.1" placeholder="e.g. 12.5"
                  value={weight} onChange={e => setWeight(e.target.value)}
                  style={{ background: "#f0ece4", border: "1.5px solid transparent", borderRadius: "12px",
                    color: "#1a2e1c", fontSize: "0.9rem", padding: "12px 16px", outline: "none", width: "100%" }}
                  onFocus={e => (e.target.style.borderColor = "#008751")}
                  onBlur={e => (e.target.style.borderColor = "transparent")} />
              </div>
              {selectedPickup.price && (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-4" style={{ background: "#e8f0e4" }}>
                  <p style={{ color: "#5a6e5c", fontSize: "0.78rem" }}>Collect from customer</p>
                  <p style={{ fontFamily: "var(--font-display)", color: "#008751", fontWeight: 800, fontSize: "1.1rem" }}>
                    {formatNaira(selectedPickup.price)}
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setSelectedPickup(null); setWeight(""); }}
                  className="flex-1 py-3 rounded-xl text-sm font-medium" style={{ background: "#f0ece4", color: "#5a6e5c" }}>Cancel</button>
                <button onClick={handleComplete} disabled={completing || !weight}
                  className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#008751", color: "#fff" }}>
                  {completing
                    ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <><CheckCircle className="w-4 h-4" /> Complete</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}