import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Recycle, Zap, CreditCard, Landmark, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { supabase } from "../../../utils/supabase/client";
import { useAuth } from "../context/AuthContext";
import { payWithKorapay, newPaymentReference } from "../../../utils/korapay/checkout";
import { isProfileComplete, PROFILE_INCOMPLETE_MESSAGE } from "../../../utils/profile/isProfileComplete";

const formatNaira = (n: number) => "₦" + n.toLocaleString("en-NG");

type TabKey = "overview" | "payments" | "pickups" | "cleanouts";

export function PickupHistory() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<TabKey>("overview");
  const [sub, setSub] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [pickups, setPickups] = useState<any[]>([]);
  const [cleanouts, setCleanouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingCleanoutId, setPayingCleanoutId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("pickups").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("bulk_cleanouts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]).then(([{ data: s }, { data: pay }, { data: p }, { data: c }]) => {
      setSub(s?.[0] ?? null);
      setPayments(pay ?? []);
      setPickups(p ?? []);
      setCleanouts(c ?? []);
      setLoading(false);
    });
  }, [user]);

  const completedPickups = pickups.filter(p => p.status === "completed");
  const urgentPickups = pickups.filter(p => p.source === "urgent");
  const totalPaid = payments.filter(p => p.status === "success").reduce((s, p) => s + Number(p.amount), 0);

  const handlePayCleanout = async (c: any) => {
    if (!user) return;
    if (!isProfileComplete(profile)) {
      toast.error(PROFILE_INCOMPLETE_MESSAGE);
      navigate("/profile");
      return;
    }
    if (!c.quote_amount) return;
    setPayingCleanoutId(c.id);
    const reference = newPaymentReference("BLK");
    let handled = false;

    try {
      await payWithKorapay({
        amount: c.quote_amount,
        email: user.email!,
        name: profile?.full_name ?? undefined,
        reference,
        narration: "EcoWaste Bulk Clean-out payment",
        onSuccess: async (data) => {
          if (handled) return;
          handled = true;

          const { error: updateError } = await supabase
            .from("bulk_cleanouts")
            .update({ status: "paid" })
            .eq("id", c.id);
          if (updateError) {
            console.error("[cleanout payment] status update failed:", updateError);
            toast.error("Payment succeeded but we couldn't update the request. Reference: " + reference);
            setPayingCleanoutId(null);
            return;
          }

          const { error: paymentError } = await supabase.from("payments").insert({
            user_id: user.id,
            purpose: "bulk_cleanout",
            bulk_cleanout_id: c.id,
            amount: c.quote_amount,
            channel: "korapay",
            status: "success",
            korapay_reference: data?.reference ?? reference,
          });
          if (paymentError && !paymentError.message?.toLowerCase().includes("duplicate")) {
            console.error("[cleanout payment] payment record failed:", paymentError);
          }

          await supabase.from("notifications").insert({
            user_id: user.id,
            title: "Clean-out paid ✅",
            message: `Your bulk clean-out payment of ${formatNaira(c.quote_amount)} was received. The truck will be dispatched to ${c.address}.`,
            type: "success",
          });

          setCleanouts(prev => prev.map(item => item.id === c.id ? { ...item, status: "paid" } : item));
          toast.success("Payment received — truck will be dispatched.");
          setPayingCleanoutId(null);
        },
        onFailed: () => { if (!handled) { handled = true; toast.error("Payment failed. Please try again."); setPayingCleanoutId(null); } },
        onClose: () => { if (!handled) setPayingCleanoutId(null); },
      });
    } catch (err) {
      toast.error("Couldn't open Korapay checkout. Please try again.");
      setPayingCleanoutId(null);
    }
  };

  if (loading) return (
    <div className="min-h-svh flex items-center justify-center" style={{ background: "#f0ede8" }}>
      <div className="w-7 h-7 rounded-full border-2 border-[#008751] border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-svh" style={{ background: "#f0ede8", fontFamily: "var(--font-body)" }}>
      {/* Header */}
      <div style={{ background: "#0e1f0f" }}>
        <div className="max-w-2xl mx-auto px-5 pt-7 pb-5">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 mb-4 text-sm" style={{ color: "rgba(247,245,240,0.4)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <h1 style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 800, fontSize: "1.4rem" }}>History</h1>
          <p style={{ color: "rgba(247,245,240,0.4)", fontSize: "0.72rem", marginTop: "0.2rem" }}>Your payments, pickups &amp; subscription activity</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5">
        {/* Tabs */}
        <div className="flex gap-2 mt-5 mb-5 overflow-x-auto">
          {([
            { key: "overview", label: "Overview" },
            { key: "payments", label: `Payments (${payments.length})` },
            { key: "pickups", label: `Pickups (${pickups.length})` },
            { key: "cleanouts", label: `Clean-outs${cleanouts.length > 0 ? ` (${cleanouts.length})` : ""}${cleanouts.some(c => c.status === "quoted") ? " 💰" : ""}` },
          ] as { key: TabKey; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-shrink-0 py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors"
              style={{ background: tab === t.key ? "#0e1f0f" : "#fff", color: tab === t.key ? "#f7f5f0" : "#5a6e5c", border: "1px solid rgba(26,46,28,0.08)", cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === "overview" && (
          <div className="flex flex-col gap-4 pb-10">
            {/* Subscription status */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.07)" }}>
              <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(26,46,28,0.06)" }}>
                <p style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "0.9rem" }}>Subscription</p>
              </div>
              {sub ? (
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: sub.manifest_status === "green" ? "#008751" : "#c0392b" }} />
                      <span style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.85rem" }} className="capitalize">{sub.plan_type} Plan</span>
                    </div>
                    <span style={{ color: "#008751", fontWeight: 700, fontSize: "0.9rem" }}>{formatNaira(sub.price)}/mo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { l: "Status", v: sub.manifest_status === "green" ? "Active ✅" : "Overdue ⚠️" },
                      { l: "Pickups/week", v: `${sub.pickups_per_week}x` },
                      { l: "Last payment", v: sub.last_payment_date ?? "—" },
                      { l: "Next payment", v: sub.next_billing_date },
                    ].map(r => (
                      <div key={r.l} className="rounded-xl p-3" style={{ background: "#f7f5f0" }}>
                        <p style={{ color: "#5a6e5c", fontSize: "0.65rem" }}>{r.l}</p>
                        <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.82rem", marginTop: "0.2rem" }}>{r.v}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => navigate("/subscriptions")} className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#e8f0e4", color: "#1a2e1c" }}>
                    Manage subscription
                  </button>
                </div>
              ) : (
                <div className="px-5 py-6 text-center">
                  <p style={{ color: "#5a6e5c", fontSize: "0.82rem", marginBottom: "0.75rem" }}>No active subscription</p>
                  <button onClick={() => navigate("/subscriptions")} className="px-4 py-2 rounded-full text-xs font-medium" style={{ background: "#008751", color: "#fff" }}>
                    Subscribe now
                  </button>
                </div>
              )}
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total paid", value: formatNaira(totalPaid), color: "#008751" },
                { label: "Completed", value: completedPickups.length, color: "#1a2e1c" },
                { label: "Urgent jobs", value: urgentPickups.length, color: "#c0392b" },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 text-center" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.07)" }}>
                  <p style={{ fontFamily: "var(--font-display)", color: s.color, fontWeight: 800, fontSize: "1.2rem" }}>{s.value}</p>
                  <p style={{ color: "#5a6e5c", fontSize: "0.65rem", marginTop: "0.25rem" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Last 3 payments */}
            {payments.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.07)" }}>
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(26,46,28,0.06)" }}>
                  <p style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "0.88rem" }}>Recent payments</p>
                  <button onClick={() => setTab("payments")} style={{ color: "#008751", fontSize: "0.72rem", fontWeight: 600 }}>See all</button>
                </div>
                {payments.slice(0, 3).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: i < 2 ? "1px solid rgba(26,46,28,0.05)" : "none" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: p.channel === "korapay" ? "#d4e8d5" : "#f0ece4" }}>
                      {p.channel === "korapay" ? <CreditCard className="w-4 h-4" style={{ color: "#008751" }} /> : <Landmark className="w-4 h-4" style={{ color: "#5a6e5c" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: "#1a2e1c", fontWeight: 500, fontSize: "0.8rem" }} className="capitalize">{p.purpose.replace(/_/g, " ")}</p>
                      <p style={{ color: "#5a6e5c", fontSize: "0.68rem" }}>{new Date(p.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <div className="text-right">
                      <p style={{ color: "#1a2e1c", fontWeight: 700, fontSize: "0.8rem" }}>{formatNaira(p.amount)}</p>
                      <p style={{ fontSize: "0.62rem", fontWeight: 600, color: p.status === "success" ? "#008751" : p.status === "pending" ? "#856404" : "#c0392b" }}>
                        {p.status === "success" ? "Confirmed" : p.status === "pending" ? "Pending review" : "Rejected"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Payments tab */}
        {tab === "payments" && (
          <div className="pb-10">
            {payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "#e8f0e4" }}>
                  <CreditCard className="w-6 h-6" style={{ color: "#008751" }} />
                </div>
                <p style={{ color: "#1a2e1c", fontWeight: 600 }}>No payments yet</p>
                <p style={{ color: "#5a6e5c", fontSize: "0.78rem", marginTop: "0.3rem" }}>Your payment history will appear here.</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.07)" }}>
                {payments.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: i < payments.length - 1 ? "1px solid rgba(26,46,28,0.05)" : "none" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: p.channel === "korapay" ? "#d4e8d5" : "#f0ece4" }}>
                      {p.channel === "korapay" ? <CreditCard className="w-4 h-4" style={{ color: "#008751" }} /> : <Landmark className="w-4 h-4" style={{ color: "#5a6e5c" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.82rem" }} className="capitalize">{p.purpose.replace(/_/g, " ")}</p>
                      <p style={{ color: "#5a6e5c", fontSize: "0.68rem" }}>
                        {p.channel === "korapay" ? "Korapay" : "Bank transfer"} · {new Date(p.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {p.korapay_reference && <p style={{ color: "#9ba89a", fontSize: "0.62rem", fontFamily: "monospace" }}>Ref: {p.korapay_reference.slice(-8).toUpperCase()}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p style={{ color: "#1a2e1c", fontWeight: 700, fontSize: "0.85rem" }}>{formatNaira(p.amount)}</p>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        {p.status === "success" ? <CheckCircle className="w-3 h-3" style={{ color: "#008751" }} /> : p.status === "pending" ? <Clock className="w-3 h-3" style={{ color: "#856404" }} /> : <XCircle className="w-3 h-3" style={{ color: "#c0392b" }} />}
                        <span style={{ fontSize: "0.62rem", fontWeight: 600, color: p.status === "success" ? "#008751" : p.status === "pending" ? "#856404" : "#c0392b" }}>
                          {p.status === "success" ? "Confirmed" : p.status === "pending" ? "Pending review" : "Rejected"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pickups tab */}
        {tab === "pickups" && (
          <div className="pb-10">
            {pickups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "#e8f0e4" }}>
                  <Recycle className="w-6 h-6" style={{ color: "#008751" }} />
                </div>
                <p style={{ color: "#1a2e1c", fontWeight: 600 }}>No pickups yet</p>
                <p style={{ color: "#5a6e5c", fontSize: "0.78rem", marginTop: "0.3rem" }}>Scheduled and completed pickups appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pickups.map(p => {
                  const statusColor = p.status === "completed" ? "#008751" : p.status === "scheduled" ? "#856404" : p.status === "in_progress" ? "#e67e22" : "#c0392b";
                  const statusBg = p.status === "completed" ? "#d4e8d5" : p.status === "scheduled" ? "#fff3cd" : p.status === "in_progress" ? "#fde8d5" : "#fde8e8";
                  return (
                    <div key={p.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.07)" }}>
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(26,46,28,0.06)" }}>
                        <div className="flex items-center gap-2">
                          {p.source === "urgent"
                            ? <Zap className="w-4 h-4 flex-shrink-0" style={{ color: "#c0392b" }} />
                            : <Recycle className="w-4 h-4 flex-shrink-0" style={{ color: "#008751" }} />}
                          <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.82rem" }}>{p.waste_type}</p>
                          {p.source === "urgent" && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#fde8e8", color: "#c0392b" }}>URGENT</span>}
                        </div>
                        <span style={{ background: statusBg, color: statusColor, padding: "3px 10px", borderRadius: "9999px", fontSize: "0.69rem", fontWeight: 600, textTransform: "capitalize" as const }}>
                          {p.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="px-4 py-3 grid grid-cols-2 gap-y-2 text-xs">
                        <div><span style={{ color: "#5a6e5c" }}>Date: </span><span style={{ color: "#1a2e1c", fontWeight: 500 }}>{p.pickup_date}</span></div>
                        <div><span style={{ color: "#5a6e5c" }}>Time: </span><span style={{ color: "#1a2e1c", fontWeight: 500 }}>{p.pickup_time}</span></div>
                        {p.actual_weight && <div><span style={{ color: "#5a6e5c" }}>Collected: </span><span style={{ color: "#008751", fontWeight: 600 }}>{p.actual_weight}kg</span></div>}
                        {p.price && <div><span style={{ color: "#5a6e5c" }}>Amount: </span><span style={{ color: "#1a2e1c", fontWeight: 600 }}>{formatNaira(p.price)}</span></div>}
                        <div className="col-span-2 truncate"><span style={{ color: "#5a6e5c" }}>Address: </span><span style={{ color: "#1a2e1c", fontWeight: 500 }}>{p.address}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Clean-outs tab */}
        {tab === "cleanouts" && (
          <div className="pb-10">
            {cleanouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "#f0ece4" }}>
                  <span style={{ fontSize: "1.5rem" }}>📦</span>
                </div>
                <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.875rem" }}>No clean-out requests yet</p>
                <p style={{ color: "#9ba89a", fontSize: "0.78rem", marginTop: "0.3rem" }}>Request a one-time bulk clean-out from the Subscriptions page.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {cleanouts.map(c => {
                  const statusMap: Record<string, { bg: string; color: string; label: string }> = {
                    pending_quote: { bg: "#f0ece4", color: "#5a6e5c", label: "Awaiting quote" },
                    quoted:        { bg: "#fff8e6", color: "#92400e", label: "Quote received 💰" },
                    paid:          { bg: "#d4e8d5", color: "#1a2e1c", label: "Paid" },
                    dispatched:    { bg: "#dce8dd", color: "#2d5230", label: "Agent dispatched" },
                    completed:     { bg: "#d4e8d5", color: "#008751", label: "Completed ✓" },
                    declined:      { bg: "#fde8e8", color: "#c0392b", label: "Declined" },
                  };
                  const s = statusMap[c.status] ?? statusMap.pending_quote;
                  return (
                    <div key={c.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: c.status === "quoted" ? "1.5px solid rgba(245,158,11,0.4)" : "1px solid rgba(26,46,28,0.07)" }}>
                      <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid rgba(26,46,28,0.06)" }}>
                        <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.82rem" }}>Bulk Clean-out</p>
                        <span style={{ background: s.bg, color: s.color, padding: "2px 10px", borderRadius: "9999px", fontSize: "0.65rem", fontWeight: 700 }}>{s.label}</span>
                      </div>
                      <div className="px-4 py-3 flex flex-col gap-1.5 text-xs">
                        <div><span style={{ color: "#9ba89a" }}>Address: </span><span style={{ color: "#1a2e1c", fontWeight: 500 }}>{c.address}</span></div>
                        {c.description && <div><span style={{ color: "#9ba89a" }}>Description: </span><span style={{ color: "#1a2e1c" }}>{c.description}</span></div>}
                        <div><span style={{ color: "#9ba89a" }}>Requested: </span><span style={{ color: "#1a2e1c" }}>{new Date(c.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span></div>
                        {c.agent_name && (c.status === "dispatched" || c.status === "completed") && (
                          <div><span style={{ color: "#9ba89a" }}>Agent: </span><span style={{ color: "#008751", fontWeight: 600 }}>👷 {c.agent_name}</span></div>
                        )}
                        {c.status === "quoted" && c.quote_amount && (
                          <div className="mt-2 pt-2.5 rounded-xl px-3 py-2.5" style={{ background: "#fff8e6", border: "1px solid rgba(245,158,11,0.2)" }}>
                            <p style={{ color: "#92400e", fontSize: "0.7rem", fontWeight: 600 }}>YOUR QUOTE</p>
                            <p style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 800, fontSize: "1.3rem", marginTop: "0.1rem" }}>
                              {formatNaira(c.quote_amount)}
                            </p>
                            <button
                              onClick={() => handlePayCleanout(c)}
                              disabled={payingCleanoutId === c.id}
                              className="w-full mt-2.5 py-2.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                              style={{ background: "#1a2e1c", color: "#f7f5f0" }}
                            >
                              {payingCleanoutId === c.id ? (
                                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              ) : (
                                <>Pay {formatNaira(c.quote_amount)} now</>
                              )}
                            </button>
                            <p style={{ color: "#856404", fontSize: "0.68rem", marginTop: "0.45rem" }}>Truck is dispatched right after payment is confirmed.</p>
                          </div>
                        )}
                        {c.photo_url && (
                          <a href={c.photo_url} target="_blank" rel="noopener noreferrer">
                            <img src={c.photo_url} alt="Junk photo" className="w-full h-28 object-cover rounded-xl mt-1" />
                          </a>
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
    </div>
  );
}