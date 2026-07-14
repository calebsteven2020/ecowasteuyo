import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Zap, Recycle, Clock, ChevronRight, Leaf, LogOut, X } from "lucide-react";
import { supabase } from "../../../utils/supabase/client";
import { useAuth } from "../context/AuthContext";

interface Pickup {
  id: string; waste_type: string; address: string;
  pickup_date: string; pickup_time: string; status: string;
  created_at: string; source?: string;
}

const formatNaira = (n: number) => "₦" + n.toLocaleString("en-NG");

export function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [profileDismissed, setProfileDismissed] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  })();

  const todayName = new Date().toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
  const isDisposalDayToday = !!sub && (sub.plan_type === "basic" ? todayName === "Sat" : todayName === "Wed" || todayName === "Fri");

  // Re-check profile on every mount in case user just updated it
  useEffect(() => {
    if (user) refreshProfile();
  }, [user]);

  // Profile banner: show only when phone or address is missing AND not dismissed
  // The `profile` value is live from AuthContext — the moment the user saves
  // phone+address, refreshProfile() is called and this recalculates automatically.
  const profileIncomplete = !!(profile && (!profile.phone || !profile.address));
  const showProfileBanner = profileIncomplete && !profileDismissed;

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("pickups").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("subscriptions").select("*").eq("user_id", user.id).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1),
      supabase.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    ]).then(([{ data: p }, { data: s }, { data: pay }]) => {
      setPickups(p ?? []);
      const fetchedSub = s?.[0] ?? null;
      setSub(fetchedSub);
      setPayments(pay ?? []);
      setLoading(false);

      // If trash_ready is still true from a previous disposal day, clear it —
      // otherwise the "already marked ready" state would incorrectly persist
      // into next week's pickup day.
      if (fetchedSub?.trash_ready) {
        const todayShort = new Date().toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
        const stillDisposalDay = fetchedSub.plan_type === "basic" ? todayShort === "Sat" : todayShort === "Wed" || todayShort === "Fri";
        if (!stillDisposalDay) {
          supabase.from("subscriptions").update({ trash_ready: false }).eq("id", fetchedSub.id).then(() => {
            setSub((prev: any) => prev ? { ...prev, trash_ready: false } : prev);
          });
        }
      }
    });
  }, [user]);

  const handleMarkReady = async () => {
    if (!sub) return;
    setMarkingReady(true);
    const { error } = await supabase.from("subscriptions").update({ trash_ready: true }).eq("id", sub.id);
    setMarkingReady(false);
    if (error) return;
    setSub((prev: any) => prev ? { ...prev, trash_ready: true } : prev);
  };

  const name = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const upcoming = pickups.filter(p => p.status === "scheduled");
  const totalCollections = pickups.filter(p => p.status === "completed").length;
  const urgentCount = pickups.filter(p => p.source === "urgent").length;

  const handleSignOut = async () => { await signOut(); navigate("/login"); };

  if (loading) return (
    <div className="min-h-svh flex items-center justify-center" style={{ background: "#f0ede8" }}>
      <div className="w-7 h-7 rounded-full border-2 border-[#008751] border-t-transparent animate-spin" />
    </div>
  );

  const HERO_IMG = "https://xhsqygawsgsnpfwemczi.supabase.co/storage/v1/object/public/assets/disposal.jpg";

  return (
    <div className="min-h-svh" style={{ background: "#f0ede8", fontFamily: "var(--font-body)" }}>

      {/* ── Header with hero image ─────────────────────── */}
      {/*
        NOTE on the image below: it is rendered at FULL opacity with a solid
        dark overlay on top of it, rather than as a single low-opacity image.
        Putting a large image on its own low-opacity compositor layer is what
        was causing the torn/striped rendering and ghosted/duplicated cards
        on Chrome for Android — Chrome promotes opacity+object-cover images to
        their own GPU layer, and that layer's tiles were getting corrupted on
        scroll. A full-opacity image + separate flat overlay avoids that
        layer entirely. `contain: "paint"` on this wrapper (instead of relying
        on overflow-hidden's implicit layer promotion) keeps the clipping
        cheap and stable instead of spinning up another compositor layer.
      */}
      <div className="relative" style={{ background: "#0e1f0f", contain: "paint" }}>
        <img
          data-hero
          src={HERO_IMG}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          aria-hidden
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "#0e1f0f", opacity: 0.9 }} />
        <div className="relative z-10 max-w-4xl mx-auto px-5 pt-7 pb-0">

          {/* Brand row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#008751" }}>
                <Leaf className="w-3.5 h-3.5 text-white" />
              </div>
              <span style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 700, fontSize: "0.9rem" }}>EcoWaste</span>
            </div>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs" style={{ color: "rgba(247,245,240,0.65)", background: "rgba(247,245,240,0.06)" }}>
              <LogOut className="w-3 h-3" /> Sign out
            </button>
          </div>

          {/* Greeting + activity inline */}
          <div className="mb-5">
            <p style={{ color: "rgba(247,245,240,0.6)", fontSize: "0.68rem", letterSpacing: "0.06em" }}>GOOD {greeting.toUpperCase()}</p>
            <h1 style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 800, fontSize: "1.65rem", marginTop: "0.15rem", lineHeight: 1.1 }}>{name}</h1>
          </div>

          {/* Activity stats — right below greeting, part of the header */}
          <div className="grid grid-cols-3 mb-6" style={{ borderTop: "1px solid rgba(247,245,240,0.08)", paddingTop: "1.1rem" }}>
            {[
              { label: "Payments", value: payments.filter(p => p.status === "success").length, color: "#4ade80" },
              { label: "Completed", value: totalCollections, color: "#85c48a" },
              { label: "Urgent jobs", value: urgentCount, color: "#fca5a5" },
            ].map((s, i) => (
              <div key={s.label} className="text-center" style={{ borderRight: i < 2 ? "1px solid rgba(247,245,240,0.08)" : "none" }}>
                <p style={{ fontFamily: "var(--font-display)", color: s.color, fontWeight: 800, fontSize: "1.55rem", lineHeight: 1 }}>{s.value}</p>
                <p style={{ color: "rgba(247,245,240,0.55)", fontSize: "0.6rem", marginTop: "0.3rem", letterSpacing: "0.04em" }}>{s.label.toUpperCase()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Current Plan card — prominent, just plan name, no price */}
        {sub ? (
          <button onClick={() => navigate("/subscriptions")} className="relative z-10 w-full text-left" style={{ borderTop: "1px solid rgba(247,245,240,0.08)" }}>
            <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: sub.manifest_status === "green" ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: sub.manifest_status === "green" ? "#4ade80" : "#f87171" }} />
                </div>
                <div>
                  <p style={{ color: "rgba(247,245,240,0.7)", fontSize: "0.6rem", letterSpacing: "0.07em" }}>CURRENT PLAN</p>
                  <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 800, fontSize: "1rem", marginTop: "0.05rem", textTransform: "capitalize" }}>
                    {sub.plan_type === "basic" ? "Basic" : "Commercial"} Plan
                  </p>
                </div>
              </div>
              <div className="text-right">
                {sub.manifest_status === "green" ? (
                  <p style={{ color: "rgba(247,245,240,0.6)", fontSize: "0.68rem" }}>Next billing · {sub.next_billing_date}</p>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: "rgba(248,113,113,0.15)" }}>
                    <p style={{ color: "#f87171", fontSize: "0.7rem", fontWeight: 600 }}>Payment overdue</p>
                  </div>
                )}
              </div>
            </div>
          </button>
        ) : (
          <button onClick={() => navigate("/subscriptions")} className="relative z-10 w-full text-left" style={{ borderTop: "1px solid rgba(247,245,240,0.08)" }}>
            <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
              <div>
                <p style={{ color: "rgba(247,245,240,0.6)", fontSize: "0.6rem", letterSpacing: "0.07em" }}>CURRENT PLAN</p>
                <p style={{ fontFamily: "var(--font-display)", color: "rgba(247,245,240,0.7)", fontWeight: 600, fontSize: "0.95rem", marginTop: "0.05rem" }}>No active plan</p>
              </div>
              <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "#008751", color: "#fff" }}>
                Subscribe <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </button>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-5 py-5 flex flex-col gap-4 pb-12">

        {/* Profile completion — auto-disappears when profile is complete, dismissible */}
        {showProfileBanner && (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={{ background: "#fff8e6", border: "1px solid rgba(245,158,11,0.25)" }}>
            <span className="text-base flex-shrink-0">⚠️</span>
            <button onClick={() => navigate("/profile")} className="flex-1 text-left">
              <p style={{ color: "#92400e", fontWeight: 600, fontSize: "0.78rem" }}>Complete your profile</p>
              <p style={{ color: "rgba(146,64,14,0.65)", fontSize: "0.68rem", marginTop: "0.1rem" }}>
                {!profile?.phone && !profile?.address ? "Add phone & address to enable pickups" : !profile?.phone ? "Phone number missing" : "Address missing"}
              </p>
            </button>
            <button onClick={() => setProfileDismissed(true)} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-amber-100">
              <X className="w-3.5 h-3.5" style={{ color: "#92400e" }} />
            </button>
          </div>
        )}

        {/* Overdue warning */}
        {sub && sub.manifest_status !== "green" && (
          <button onClick={() => navigate("/subscriptions")} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left" style={{ background: "#fde8e8", border: "1px solid rgba(192,57,43,0.15)" }}>
            <span className="text-base flex-shrink-0">🔴</span>
            <div className="flex-1">
              <p style={{ color: "#c0392b", fontWeight: 600, fontSize: "0.78rem" }}>Truck will bypass your house</p>
              <p style={{ color: "rgba(192,57,43,0.7)", fontSize: "0.68rem", marginTop: "0.1rem" }}>Payment overdue — tap to renew now</p>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#c0392b" }} />
          </button>
        )}

        {/* Disposal-day reminder — only shows on the subscriber's actual pickup day */}
        {sub && sub.status === "active" && sub.manifest_status === "green" && isDisposalDayToday && (
          sub.trash_ready ? (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={{ background: "#e8f0e4", border: "1px solid rgba(0,135,81,0.2)" }}>
              <span className="text-base flex-shrink-0">✅</span>
              <div className="flex-1">
                <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.78rem" }}>You're all set for today</p>
                <p style={{ color: "#5a6e5c", fontSize: "0.68rem", marginTop: "0.1rem" }}>The truck knows your bins are out — sit tight.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={{ background: "#fff8e6", border: "1px solid rgba(245,158,11,0.25)" }}>
              <span className="text-base flex-shrink-0">🗑️</span>
              <div className="flex-1">
                <p style={{ color: "#92400e", fontWeight: 600, fontSize: "0.78rem" }}>Today is pickup day</p>
                <p style={{ color: "rgba(146,64,14,0.65)", fontSize: "0.68rem", marginTop: "0.1rem" }}>Place your bins outside by 7 AM</p>
              </div>
              <button
                onClick={handleMarkReady}
                disabled={markingReady}
                className="px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5"
                style={{ background: "#92400e", color: "#fff8e6" }}
              >
                {markingReady ? (
                  <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  "Bins are out"
                )}
              </button>
            </div>
          )
        )}

        {/* Primary actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate("/subscriptions")} className="flex flex-col gap-2 p-4 rounded-2xl text-left transition-colors" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.07)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#e8f0e4" }}>
              <Recycle className="w-5 h-5" style={{ color: "#008751" }} />
            </div>
            <div>
              <p style={{ color: "#1a2e1c", fontWeight: 700, fontSize: "0.82rem" }}>Subscription</p>
              <p style={{ color: "#5a6e5c", fontSize: "0.67rem", marginTop: "0.15rem" }}>Manage plan & billing</p>
            </div>
          </button>

          <button onClick={() => navigate("/book-pickup")} className="flex flex-col gap-2 p-4 rounded-2xl text-left transition-colors" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.07)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#fde8e8" }}>
              <Zap className="w-5 h-5" style={{ color: "#c0392b" }} />
            </div>
            <div>
              <p style={{ color: "#1a2e1c", fontWeight: 700, fontSize: "0.82rem" }}>Urgent Pickup</p>
              <p style={{ color: "#5a6e5c", fontSize: "0.67rem", marginTop: "0.15rem" }}>₦8,000 flat · pay now</p>
            </div>
          </button>
        </div>

        {/* Secondary links */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.07)", contain: "paint" }}>
          {[
            { label: "History", sub: "Payments, pickups & activity", icon: Clock, path: "/history" },
            { label: "Bulk Clean-out", sub: "Moving? One-time truck dispatch", icon: Leaf, path: "/subscriptions" },
          ].map((item, i) => (
            <button key={item.label} onClick={() => navigate(item.path)} className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#f7f5f0]" style={{ borderBottom: i === 0 ? "1px solid rgba(26,46,28,0.06)" : "none" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#f0ece4" }}>
                <item.icon className="w-4 h-4" style={{ color: "#5a6e5c" }} />
              </div>
              <div className="flex-1 text-left">
                <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.8rem" }}>{item.label}</p>
                <p style={{ color: "#5a6e5c", fontSize: "0.67rem" }}>{item.sub}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "#9ba89a" }} />
            </button>
          ))}
        </div>

        {/* Recent payments */}
        {payments.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.07)", contain: "paint" }}>
            <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid rgba(26,46,28,0.06)" }}>
              <p style={{ color: "#1a2e1c", fontWeight: 700, fontSize: "0.82rem" }}>Recent payments</p>
              <button onClick={() => navigate("/history")} style={{ color: "#008751", fontSize: "0.7rem", fontWeight: 600 }}>See all</button>
            </div>
            {payments.slice(0, 3).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < 2 ? "1px solid rgba(26,46,28,0.05)" : "none" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: p.status === "success" ? "#d4e8d5" : p.status === "pending" ? "#fff3cd" : "#fde8e8" }}>
                  <span style={{ fontSize: "0.8rem" }}>{p.channel === "korapay" ? "💳" : "🏦"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ color: "#1a2e1c", fontWeight: 500, fontSize: "0.78rem" }}>{p.purpose.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                  <p style={{ color: "#9ba89a", fontSize: "0.66rem" }}>{new Date(p.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <div className="text-right">
                  <p style={{ color: "#1a2e1c", fontWeight: 700, fontSize: "0.78rem" }}>{formatNaira(p.amount)}</p>
                  <p style={{ fontSize: "0.6rem", fontWeight: 600, color: p.status === "success" ? "#008751" : p.status === "pending" ? "#856404" : "#c0392b" }}>
                    {p.status === "success" ? "Confirmed" : p.status === "pending" ? "Under review" : "Rejected"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Subscription schedule card — replaces the empty upcoming pickups box */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.07)", contain: "paint" }}>
          <div className="px-4 py-3.5" style={{ borderBottom: "1px solid rgba(26,46,28,0.06)" }}>
            <p style={{ color: "#1a2e1c", fontWeight: 700, fontSize: "0.82rem" }}>Your pickup schedule</p>
          </div>
          {sub && sub.status === "active" ? (
            <div className="px-4 py-4 flex flex-col gap-3">
              {/* Weekly pickup days */}
              <div className="flex gap-2">
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day => {
                  const isPickupDay = sub.plan_type === "basic"
                    ? day === "Sat"
                    : day === "Wed" || day === "Fri";
                  const todayName = new Date().toLocaleDateString("en-US", { weekday: "short" }).slice(0,3);
                  const isToday = todayName === day;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center py-2 rounded-xl"
                      style={{ background: isPickupDay ? "#0e1f0f" : isToday ? "#f0ece4" : "#f7f5f0" }}>
                      <p style={{ fontSize: "0.6rem", fontWeight: 600, color: isPickupDay ? "rgba(247,245,240,0.5)" : "#9ba89a", letterSpacing: "0.04em" }}>{day.toUpperCase()}</p>
                      {isPickupDay && <span style={{ fontSize: "0.7rem", marginTop: "2px" }}>🗑️</span>}
                      {isToday && !isPickupDay && <span className="w-1 h-1 rounded-full mt-1" style={{ background: "#008751" }} />}
                    </div>
                  );
                })}
              </div>
              <p style={{ color: "#5a6e5c", fontSize: "0.72rem", lineHeight: 1.5 }}>
                {sub.plan_type === "basic"
                  ? "Collection every Saturday · Place bins outside by 7 AM"
                  : "Collection every Wednesday & Friday · Place bins outside by 7 AM"}
              </p>
              <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(26,46,28,0.06)" }}>
                <span style={{ color: "#9ba89a", fontSize: "0.7rem" }}>Next billing</span>
                <span style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.78rem" }}>{sub.next_billing_date}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2.5" style={{ background: "#e8f0e4" }}>
                <Leaf className="w-5 h-5" style={{ color: "#008751" }} />
              </div>
              <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.82rem" }}>
                {sub && sub.status === "pending" ? "Awaiting payment confirmation" : "No active subscription"}
              </p>
              <p style={{ color: "#9ba89a", fontSize: "0.72rem", marginTop: "0.25rem", lineHeight: 1.5 }}>
                {sub && sub.status === "pending"
                  ? "Your schedule will appear here once your transfer is verified."
                  : "Subscribe to see your weekly collection schedule here."}
              </p>
              {!sub && (
                <button onClick={() => navigate("/subscriptions")} className="mt-3 px-4 py-2 rounded-full text-xs font-medium" style={{ background: "#008751", color: "#fff", cursor: "pointer" }}>
                  Subscribe now
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}