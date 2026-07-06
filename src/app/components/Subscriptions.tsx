import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  CheckCircle2, Home, Building2, Truck, CreditCard,
  Landmark, AlertTriangle, ArrowLeft, Upload, X, Copy, Clock,
} from "lucide-react";
import { supabase } from "../../../utils/supabase/client";
import { useAuth } from "../context/AuthContext";
import { payWithKorapay, newPaymentReference } from "../../../utils/korapay/checkout";import { BANK_TRANSFER_DETAILS } from "../../../utils/korapay/info";

const formatNaira = (n: number) => "₦" + n.toLocaleString("en-NG");

// 1. THE CORE ENGINE — tiered subscriptions
const PLANS = {
  basic: {
    label: "Basic Plan",
    sub: "Residential",
    icon: Home,
    price: 8000, // ₦3,000 – ₦5,000 / month
    priceRange: "₦8,000",
    pickupsPerWeek: 1,
    perks: ["1 fixed pickup every week (4x a month)", "Automatic monthly billing", "WhatsApp/SMS pickup reminders"],
  },
  commercial: {
    label: "Commercial Plan",
    sub: "Shops / Offices",
    icon: Building2,
    price: 15000, // ₦10,000 – ₦20,000 / month
    priceRange: "₦15,000",
    pickupsPerWeek: 2,
    perks: ["2 fixed pickups every week", "Priority truck routing", "Daily commercial pickup available"],
  },
} as const;

type PlanKey = keyof typeof PLANS;
type PayMethod = "korapay" | "bank_transfer";

const PAYMENT_METHODS: { key: PayMethod; label: string; icon: any; desc: string }[] = [
  { key: "korapay", label: "Pay with Korapay", icon: CreditCard, desc: "Card, bank, or USSD — instant confirmation, auto-charged monthly" },
  { key: "bank_transfer", label: "Bank Transfer", icon: Landmark, desc: "Transfer manually and upload your receipt for verification" },
];

interface Subscription {
  id: string;
  user_id: string;
  plan_type: PlanKey;
  price: number;
  pickups_per_week: number;
  status: "active" | "past_due" | "pending" | "cancelled";
  manifest_status: "green" | "red";
  payment_method: string;
  next_billing_date: string;
  last_payment_date: string | null;
}

export function Subscriptions() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("basic");
  const [selectedMethod, setSelectedMethod] = useState<PayMethod>("korapay");
  const [subscribing, setSubscribing] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [pendingUpgrade, setPendingUpgrade] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);

  // Run the upgrade payment AFTER the ChangePlanModal has been closed and
  // fully unmounted. Calling payWithKorapay while a modal with z-50 + backdrop
  // blur is still mounted causes Korapay's widget to open behind the overlay
  // and immediately get dismissed. useEffect guarantees the DOM has updated
  // (modal gone) before we touch Korapay.
  useEffect(() => {
    if (!pendingUpgrade || !user || !sub) return;
    setPendingUpgrade(false);

    const plan = PLANS.commercial;
    const reference = newPaymentReference("UPG");
    let handled = false;
    setSubscribing(true);

    payWithKorapay({
      amount: plan.price,
      email: user.email!,
      reference,
      narration: "EcoWaste upgrade to Commercial Plan",
      onSuccess: async (data) => {
        if (handled) return;
        handled = true;
        const todayDate = new Date();
        const today = todayDate.toISOString().split("T")[0];
        const nextBillingDate = new Date(todayDate);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        const nextBilling = nextBillingDate.toISOString().split("T")[0];
        const updates = {
          plan_type: "commercial" as PlanKey,
          price: plan.price,
          pickups_per_week: plan.pickupsPerWeek,
          last_payment_date: today,
          next_billing_date: nextBilling,
          status: "active" as const,
          manifest_status: "green" as const,
        };
        const { error } = await supabase.from("subscriptions").update(updates).eq("id", sub.id);
        if (error) { toast.error("Payment succeeded but plan update failed: " + error.message); setSubscribing(false); return; }
        await supabase.from("payments").insert({
          user_id: user.id, purpose: "subscription", subscription_id: sub.id,
          amount: plan.price, channel: "korapay", status: "success",
          korapay_reference: data?.reference ?? reference,
        });
        await supabase.from("notifications").insert({
          user_id: user.id,
          title: "Plan upgraded ✅",
          message: `You're now on the Commercial Plan (${formatNaira(plan.price)}/month). Next payment on ${nextBilling}.`,
          type: "success",
        });
        setSub({ ...sub, ...updates });
        fetchPayments();
        toast.success("Upgraded to Commercial Plan.");
        setSubscribing(false);
      },
      onFailed: () => { if (!handled) { handled = true; toast.error("Payment failed. Please try again."); setSubscribing(false); } },
      onClose: () => { if (!handled) setSubscribing(false); },
    }).catch(() => { toast.error("Couldn't open Korapay. Please try again."); setSubscribing(false); });
  }, [pendingUpgrade]);

  const fetchSub = async () => {
    if (!user) return;
    try {
      const { error: rpcErr } = await supabase.rpc("flag_overdue_subscriptions");
      if (rpcErr) console.warn("[fetchSub] flag_overdue_subscriptions:", rpcErr.message);
    } catch (e) {
      console.warn("[fetchSub] flag_overdue_subscriptions not available:", e);
    }
    const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).neq("status", "cancelled")
      .order("created_at", { ascending: false }).limit(1);
    setSub(data?.[0] ?? null);
    setLoading(false);
  };

  const fetchPayments = async () => {
    if (!user) return;
    const { data } = await supabase.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setPayments(data ?? []);
  };

  useEffect(() => { fetchSub(); fetchPayments(); }, [user]);

  // ── Create (or reactivate) the subscription row ──
  // NOTE: we deliberately avoid supabase's .upsert(onConflict: "user_id") here.
  // The DB only has a *partial* unique index on user_id (excluding cancelled
  // subscriptions), and Postgres' ON CONFLICT target must match an index
  // exactly — a plain "user_id" target doesn't match a partial index, so the
  // upsert was failing every time with "no unique or exclusion constraint
  // matching the ON CONFLICT specification". Checking-then-write avoids that.
  //
  // We also use .limit(1) instead of .maybeSingle() for the existence check:
  // maybeSingle() THROWS if more than one row matches, and if you've been
  // testing repeatedly, stale duplicate rows can exist for the same user —
  // that silent throw was the real cause of "could not save subscription".
  const upsertSubscription = async (status: "active" | "past_due" | "pending", manifestStatus: "green" | "red", method: PayMethod) => {
    const plan = PLANS[selectedPlan];
    const today = new Date();
    // Billing date = exactly 1 month from today (e.g. subscribe June 18 → next payment July 18)
    const nextBilling = new Date(today);
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    const payload = {
      user_id: user!.id,
      plan_type: selectedPlan,
      price: plan.price,
      pickups_per_week: plan.pickupsPerWeek,
      status,
      manifest_status: manifestStatus,
      payment_method: method,
      last_payment_date: status === "active" ? today.toISOString().split("T")[0] : null,
      next_billing_date: nextBilling.toISOString().split("T")[0],
    };

    const { data: existingRows, error: lookupError } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user!.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(5);

    if (lookupError) console.error("[subscriptions] lookup failed:", lookupError);
    const existing = existingRows?.[0] ?? null;

    // Clean up any stale duplicate rows beyond the most recent one — leftover
    // from earlier failed attempts — so they stop colliding with the unique index.
    if (existingRows && existingRows.length > 1) {
      const staleIds = existingRows.slice(1).map(r => r.id);
      await supabase.from("subscriptions").update({ status: "cancelled" }).in("id", staleIds);
    }

    if (existing) {
      const { data, error } = await supabase
        .from("subscriptions")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .maybeSingle();
      if (error) console.error("[subscriptions] update failed:", error);
      return { data, error };
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .insert(payload)
      .select()
      .maybeSingle();
    if (error) console.error("[subscriptions] insert failed:", error);
    return { data, error };
  };

  // ── Option A: pay instantly with Korapay ──
  const handleKorapaySubscribe = async () => {
    if (!user) return;
    setSubscribing(true);
    const plan = PLANS[selectedPlan];
    const reference = newPaymentReference("SUB");
    // Korapay's inline widget can call onSuccess more than once for a single
    // checkout (it fires both an iframe postMessage event and its own
    // completion event in some flows) — without a guard, that double-inserts
    // the payments row. This flag makes the handler a no-op after the first run.
    let handled = false;

    try {
      await payWithKorapay({
        amount: plan.price,
        email: user.email!,
        name: profile?.full_name ?? undefined,
        reference,
        narration: `EcoWaste ${plan.label} subscription`,
        onSuccess: async (data) => {
          if (handled) return;
          handled = true;

          const { data: subData, error } = await upsertSubscription("active", "green", "korapay");
          if (error || !subData) {
            console.error("[korapay subscribe] save failed:", error);
            toast.error(`Payment succeeded but we couldn't save your subscription (${error?.message ?? "unknown error"}). Reference: ${reference}`);
            setSubscribing(false);
            return;
          }

          // Record on the admin board — guarded against duplicates at the DB
          // level too (unique index on korapay_reference), in case this
          // handler somehow still runs twice (e.g. a fast double-click before
          // `handled` is set, or a future refactor that drops the ref guard).
          const { error: paymentError } = await supabase.from("payments").insert({
            user_id: user.id,
            purpose: "subscription",
            subscription_id: subData.id,
            amount: plan.price,
            channel: "korapay",
            status: "success",
            korapay_reference: data?.reference ?? reference,
          });
          if (paymentError && !paymentError.message?.toLowerCase().includes("duplicate")) {
            console.error("[korapay subscribe] payment record failed:", paymentError);
          }

          await supabase.from("notifications").insert({
            user_id: user.id,
            title: "Subscription active ✅",
            message: `Your ${plan.label} (${formatNaira(plan.price)}/month) is now active — payment confirmed via Korapay.`,
            type: "success",
          });

          setSub(subData as Subscription);
          fetchPayments();
          toast.success(`${plan.label} activated — your house is now GREEN on the driver's manifest.`);
          setSubscribing(false);
        },
        onFailed: () => { if (!handled) { handled = true; toast.error("Payment failed. Please try again."); setSubscribing(false); } },
        onClose: () => { if (!handled) setSubscribing(false); },
      });
    } catch (err) {
      toast.error("Couldn't open Korapay checkout. Please try again.");
      setSubscribing(false);
    }
  };

  // ── Option B: manual bank transfer — create a pending subscription, then collect a receipt ──
  const handleBankTransferSubscribe = async () => {
    if (!user) return;
    setSubscribing(true);
    const { data: subData, error } = await upsertSubscription("pending", "red", "bank_transfer");
    if (error || !subData) {
      console.error("[bank transfer subscribe] save failed:", error);
      toast.error(`Could not start your subscription (${error?.message ?? "unknown error"}). Please try again.`);
      setSubscribing(false);
      return;
    }
    setSub(subData as Subscription);
    setSubscribing(false);
    setShowReceiptUpload(true);
    toast("Now upload your transfer receipt so we can confirm payment.", { icon: "🧾" });
  };

  const handleSubscribe = () => {
    if (selectedMethod === "korapay") return handleKorapaySubscribe();
    return handleBankTransferSubscribe();
  };

  // ── Pay an overdue (past_due) subscription via Korapay ──
  const payOverdueWithKorapay = async () => {
    if (!sub || !user) return;
    const reference = newPaymentReference("SUB");
    let handled = false;
    await payWithKorapay({
      amount: sub.price,
      email: user.email!,
      name: profile?.full_name ?? undefined,
      reference,
      narration: "EcoWaste subscription renewal",
      onSuccess: async (data) => {
        if (handled) return;
        handled = true;
        const todayDate = new Date();
        const today = todayDate.toISOString().split("T")[0];
        const nextBillingDate = new Date(todayDate);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        const nextBilling = nextBillingDate.toISOString().split("T")[0];
        await supabase.from("subscriptions").update({ status: "active", manifest_status: "green", last_payment_date: today, next_billing_date: nextBilling }).eq("id", sub.id);
        const { error: paymentError } = await supabase.from("payments").insert({
          user_id: user.id, purpose: "subscription", subscription_id: sub.id,
          amount: sub.price, channel: "korapay", status: "success", korapay_reference: data?.reference ?? reference,
        });
        if (paymentError && !paymentError.message?.toLowerCase().includes("duplicate")) {
          console.error("[payOverdueWithKorapay] payment record failed:", paymentError);
        }
        setSub({ ...sub, status: "active", manifest_status: "green", last_payment_date: today, next_billing_date: nextBilling });
        fetchPayments();
        toast.success("Payment successful — house is GREEN again.");
      },
      onFailed: () => { if (!handled) { handled = true; toast.error("Payment failed. Please try again."); } },
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f7f5f0" }}>
      <div className="w-8 h-8 rounded-full border-2 border-[#008751] border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#f7f5f0", fontFamily: "var(--font-body)" }}>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 mb-6 text-sm hover:opacity-70" style={{ color: "#5a6e5c" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </button>

        <h1 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1.6rem", fontWeight: 700 }}>Subscription Plan</h1>
        <p style={{ color: "#5a6e5c", fontSize: "0.85rem", marginTop: "0.3rem", marginBottom: "1.75rem" }}>
          Automated weekly pickups, billed monthly to your card or dedicated virtual account.
        </p>

        {sub ? (
          <div className="flex flex-col gap-6">
            {/* Active plan card */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
              <div className="px-6 py-5 flex items-center justify-between" style={{ background: "#1a2e1c" }}>
                <div>
                  <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.65rem", letterSpacing: "0.08em", fontWeight: 600 }}>YOUR PLAN</p>
                  <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 700, fontSize: "1.1rem", marginTop: "0.2rem" }}>
                    {PLANS[sub.plan_type].label} — {formatNaira(sub.price)}/mo
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-full flex items-center gap-2" style={{
                  background: sub.manifest_status === "green" ? "rgba(0,135,81,0.18)" : sub.status === "pending" ? "rgba(245,158,11,0.18)" : "rgba(192,57,43,0.18)"
                }}>
                  <span className="w-2 h-2 rounded-full" style={{
                    background: sub.manifest_status === "green" ? "#85c48a" : sub.status === "pending" ? "#f59e0b" : "#e57373"
                  }} />
                  <span style={{
                    color: sub.manifest_status === "green" ? "#85c48a" : sub.status === "pending" ? "#f59e0b" : "#e57373",
                    fontSize: "0.75rem", fontWeight: 600
                  }}>
                    {sub.manifest_status === "green" ? "Active" : sub.status === "pending" ? "Awaiting verification" : "Payment overdue"}
                  </span>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-5">
                {/* Pending bank transfer — receipt uploaded, waiting for admin */}
                {sub.status === "pending" && (
                  <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "#fff8e6", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#d97706" }} />
                    <div className="flex-1">
                      <p style={{ color: "#92400e", fontWeight: 600, fontSize: "0.82rem" }}>Bank transfer under review</p>
                      <p style={{ color: "rgba(146,64,14,0.75)", fontSize: "0.78rem", marginTop: "0.2rem", lineHeight: 1.5 }}>
                        We've received your receipt and it's being reviewed by our team. Your subscription will activate once payment is confirmed — usually within 24 hours.
                      </p>
                    </div>
                  </div>
                )}

                {/* Past due — no receipt uploaded or payment lapsed */}
                {sub.status === "past_due" && (
                  <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "#fde8e8" }}>
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#c0392b" }} />
                    <div className="flex-1">
                      <p style={{ color: "#c0392b", fontWeight: 600, fontSize: "0.82rem" }}>Payment overdue</p>
                      <p style={{ color: "#9b3026", fontSize: "0.78rem", marginTop: "0.2rem" }}>
                        Your house is marked RED — the truck will bypass you until payment is resolved.
                      </p>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button onClick={payOverdueWithKorapay} className="px-4 py-2 rounded-full text-xs font-medium" style={{ background: "#c0392b", color: "#fff", cursor: "pointer" }}>
                          Pay with Korapay
                        </button>
                        <button onClick={() => setShowReceiptUpload(true)} className="px-4 py-2 rounded-full text-xs font-medium" style={{ background: "#fff", color: "#c0392b", border: "1px solid #c0392b", cursor: "pointer" }}>
                          Upload transfer receipt
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>Pickup days</p>
                    <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.9rem" }}>
                      {sub.plan_type === "basic" ? "Every Saturday" : "Wed & Friday"}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>Pickups per week</p>
                    <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.95rem" }}>{sub.pickups_per_week}x</p>
                  </div>
                  <div>
                    <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>Next billing date</p>
                    <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.95rem" }}>{sub.next_billing_date}</p>
                  </div>
                  <div>
                    <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>Payment method</p>
                    <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.95rem", textTransform: "capitalize" }}>{sub.payment_method.replace("_", " ")}</p>
                  </div>
                  <div>
                    <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>Last payment</p>
                    <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.95rem" }}>{sub.last_payment_date ?? "—"}</p>
                  </div>
                </div>

                {/* Only show change plan if upgrade is possible (basic → commercial) */}
                {sub.plan_type === "basic" && (
                  <button onClick={() => setShowChangePlan(true)} className="w-full py-3 rounded-xl text-sm font-medium" style={{ background: "#f0ece4", color: "#1a2e1c" }}>
                    Upgrade to Commercial Plan
                  </button>
                )}

                <p style={{ color: "#5a6e5c", fontSize: "0.72rem", textAlign: "center" }}>
                  Your plan renews automatically each month. To cancel it, contact support.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Plan picker */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(PLANS) as PlanKey[]).map(key => {
                const plan = PLANS[key];
                const active = selectedPlan === key;
                return (
                  <button key={key} onClick={() => setSelectedPlan(key)} className="text-left rounded-2xl p-6 transition-all"
                    style={{ background: active ? "#1a2e1c" : "#fff", border: `1.5px solid ${active ? "#1a2e1c" : "rgba(26,46,28,0.08)"}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: active ? "rgba(133,196,138,0.18)" : "#e8f0e4" }}>
                      <plan.icon className="w-5 h-5" style={{ color: active ? "#85c48a" : "#008751" }} />
                    </div>
                    <p style={{ fontFamily: "var(--font-display)", color: active ? "#f7f5f0" : "#1a2e1c", fontWeight: 700, fontSize: "1.05rem" }}>{plan.label}</p>
                    <p style={{ color: active ? "rgba(247,245,240,0.5)" : "#5a6e5c", fontSize: "0.78rem", marginTop: "0.1rem" }}>{plan.sub}</p>
                    <p style={{ fontFamily: "var(--font-display)", color: active ? "#85c48a" : "#008751", fontWeight: 700, fontSize: "1.3rem", marginTop: "0.9rem" }}>
                      {plan.priceRange}<span style={{ fontSize: "0.7rem", fontWeight: 400, opacity: 0.7 }}>/month</span>
                    </p>
                    <ul className="flex flex-col gap-1.5 mt-4">
                      {plan.perks.map(perk => (
                        <li key={perk} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: active ? "#85c48a" : "#008751" }} />
                          <span style={{ color: active ? "rgba(247,245,240,0.75)" : "#5a6e5c", fontSize: "0.75rem", lineHeight: 1.5 }}>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {/* Payment method */}
            <div className="rounded-2xl p-6" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
              <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.9rem" }}>Choose how you'll be billed</p>
              <div className="flex flex-col gap-2">
                {PAYMENT_METHODS.map(m => {
                  const active = selectedMethod === m.key;
                  return (
                    <button key={m.key} onClick={() => setSelectedMethod(m.key)} className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all"
                      style={{ background: active ? "#e8f0e4" : "#f7f5f0", border: `1.5px solid ${active ? "#008751" : "transparent"}` }}>
                      <m.icon className="w-4 h-4 flex-shrink-0" style={{ color: "#008751" }} />
                      <div className="flex-1">
                        <p style={{ color: "#1a2e1c", fontWeight: 500, fontSize: "0.8rem" }}>{m.label}</p>
                        <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>{m.desc}</p>
                      </div>
                      {active && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#008751" }} />}
                    </button>
                  );
                })}
              </div>
              <p style={{ color: "#5a6e5c", fontSize: "0.72rem", marginTop: "0.9rem", lineHeight: 1.6 }}>
                Powered by Paystack / Flutterwave. You'll be charged automatically on the 1st of every month. If a payment fails, your house is marked RED on the driver's manifest and the truck will skip your address until you pay.
              </p>
              <button onClick={handleSubscribe} disabled={subscribing} className="w-full mt-5 py-3.5 rounded-xl font-medium transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: "#1a2e1c", color: "#f7f5f0" }}>
                {subscribing ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : `Subscribe to ${PLANS[selectedPlan].label} — ${formatNaira(PLANS[selectedPlan].price)}/mo`}
              </button>
            </div>
          </div>
        )}

        {/* Recent payments — customer's own record */}
        {payments.length > 0 && (
          <div className="rounded-2xl overflow-hidden mt-6" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(26,46,28,0.07)" }}>
              <p style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 600, fontSize: "0.95rem" }}>Payment History</p>
            </div>
            {payments.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-6 py-3.5" style={{ borderBottom: i < payments.length - 1 ? "1px solid rgba(26,46,28,0.06)" : "none" }}>
                {p.channel === "korapay" ? <CreditCard className="w-4 h-4 flex-shrink-0" style={{ color: "#5a6e5c" }} /> : <Landmark className="w-4 h-4 flex-shrink-0" style={{ color: "#5a6e5c" }} />}
                <div className="flex-1 min-w-0">
                  <p style={{ color: "#1a2e1c", fontWeight: 500, fontSize: "0.82rem" }}>{formatNaira(p.amount)} — {p.channel === "korapay" ? "Korapay" : "Bank transfer"}</p>
                  <p style={{ color: "#5a6e5c", fontSize: "0.7rem" }}>{new Date(p.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 flex items-center gap-1"
                  style={{
                    background: p.status === "success" ? "#d4e8d5" : p.status === "rejected" || p.status === "failed" ? "#fde8e8" : "#fff3cd",
                    color: p.status === "success" ? "#1a2e1c" : p.status === "rejected" || p.status === "failed" ? "#c0392b" : "#856404",
                  }}>
                  {p.status === "pending" && <Clock className="w-3 h-3" />}
                  {p.status === "success" ? "Confirmed" : p.status === "rejected" ? "Rejected" : p.status === "failed" ? "Failed" : "Under review"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 2. THE ADD-ON — bulk clean-out, available to everyone */}
        <button onClick={() => setShowBulk(true)} className="w-full mt-6 flex items-center justify-between p-5 rounded-2xl transition-all hover:opacity-90" style={{ background: "#e8f0e4" }}>
          <div className="flex items-center gap-3 text-left">
            <Truck className="w-5 h-5 flex-shrink-0" style={{ color: "#008751" }} />
            <div>
              <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.85rem" }}>Moving out? Need a bulk clean-out?</p>
              <p style={{ color: "#5a6e5c", fontSize: "0.75rem", marginTop: "0.1rem" }}>One-time truck dispatch — upload a photo and get a custom quote, no subscription required.</p>
            </div>
          </div>
        </button>
      </div>

      {showBulk && <BulkCleanoutModal onClose={() => setShowBulk(false)} />}
      {showReceiptUpload && sub && (
        <ReceiptUploadModal
          sub={sub}
          onClose={() => setShowReceiptUpload(false)}
          onSubmitted={() => { fetchPayments(); setShowReceiptUpload(false); }}
        />
      )}
      {showChangePlan && sub && (
        <ChangePlanModal
          sub={sub}
          onClose={() => setShowChangePlan(false)}
          onUpgradeConfirmed={() => setPendingUpgrade(true)}
        />
      )}
    </div>
  );
}

// ── Change Plan modal — enforces downgrade/upgrade rules ──
function ChangePlanModal({ sub, onClose, onUpgradeConfirmed }: { sub: Subscription; onClose: () => void; onUpgradeConfirmed: () => void }) {
  const isDowngrade = sub.plan_type === "commercial";

  const confirm = () => {
    if (isDowngrade) return;
    // Close modal first, then parent's useEffect fires Korapay after unmount
    onClose();
    onUpgradeConfirmed();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0" style={{ background: "rgba(10,22,11,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "#fff" }}>
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: "#1a2e1c" }}>
          <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 700, fontSize: "1rem" }}>Change Plan</p>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: "rgba(247,245,240,0.6)" }} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">

          {/* Current plan */}
          <div className="px-4 py-3 rounded-xl" style={{ background: "#f0ece4" }}>
            <p style={{ color: "#5a6e5c", fontSize: "0.7rem" }}>Current plan</p>
            <p style={{ color: "#1a2e1c", fontWeight: 700, fontSize: "0.9rem" }} className="capitalize">{sub.plan_type} Plan · {formatNaira(sub.price)}/mo</p>
          </div>

          {/* Downgrade blocked notice */}
          {sub.plan_type === "commercial" && (
            <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "#fde8e8" }}>
              <span className="text-lg flex-shrink-0">🚫</span>
              <div>
                <p style={{ color: "#c0392b", fontWeight: 600, fontSize: "0.82rem" }}>Downgrade not available</p>
                <p style={{ color: "#9b3026", fontSize: "0.75rem", marginTop: "0.2rem", lineHeight: 1.5 }}>
                  Commercial plans cannot be downgraded to Basic. Contact support if you need to cancel.
                </p>
              </div>
            </div>
          )}

          {/* Upgrade option */}
          {sub.plan_type === "basic" && (
            <>
              <div className="rounded-xl p-4" style={{ background: "#e8f0e4", border: "1.5px solid #008751" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p style={{ color: "#1a2e1c", fontWeight: 700, fontSize: "0.9rem" }}>Commercial Plan</p>
                    <p style={{ color: "#5a6e5c", fontSize: "0.75rem", marginTop: "0.2rem" }}>3x pickups/week · shops &amp; offices</p>
                  </div>
                  <p style={{ fontFamily: "var(--font-display)", color: "#008751", fontWeight: 800, fontSize: "1rem" }}>{PLANS.commercial.priceRange}/mo</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3.5 rounded-xl" style={{ background: "#fff3cd" }}>
                <span className="text-base flex-shrink-0">ℹ️</span>
                <p style={{ color: "#856404", fontSize: "0.75rem", lineHeight: 1.5 }}>
                  Upgrading requires paying the full Commercial plan amount now. Your billing cycle restarts today — you will be charged again in one month.
                </p>
              </div>
              <button onClick={confirm} className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2" style={{ background: "#008751", color: "#fff", cursor: "pointer" }}>
                Pay {formatNaira(PLANS.commercial.price)} &amp; upgrade to Commercial
              </button>
            </>
          )}

          <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-medium" style={{ background: "#f0ece4", color: "#5a6e5c" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Receipt Upload modal (bank transfer proof-of-payment) ──
function ReceiptUploadModal({ sub, onClose, onSubmitted }: { sub: Subscription; onClose: () => void; onSubmitted: () => void }) {
  const { user } = useAuth();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Only image files are allowed (JPEG, PNG, WebP, GIF).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB."); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!photoFile) { toast.error("Please upload a photo of your transfer receipt."); return; }
    setSubmitting(true);

    const path = `${user!.id}/${Date.now()}-${photoFile.name}`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, photoFile);
    if (upErr) { toast.error("Could not upload receipt. Please try again."); setSubmitting(false); return; }
    const { data: pub } = supabase.storage.from("receipts").getPublicUrl(path);

    const { error } = await supabase.from("payments").insert({
      user_id: user!.id,
      purpose: "subscription",
      subscription_id: sub.id,
      amount: sub.price,
      channel: "bank_transfer",
      status: "pending",
      receipt_url: pub.publicUrl,
      korapay_reference: reference || null,
    });
    if (error) { toast.error("Could not save your receipt. Please try again."); setSubmitting(false); return; }

    await supabase.from("notifications").insert({
      user_id: user!.id,
      title: "Receipt received 🧾",
      message: "We've received your transfer receipt and it's being reviewed. Your house stays GREEN once an admin confirms payment.",
      type: "info",
    });

    toast.success("Receipt uploaded — awaiting admin verification.");
    setSubmitting(false);
    onSubmitted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0" style={{ background: "rgba(10,22,11,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "#fff" }}>
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: "#1a2e1c" }}>
          <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 700, fontSize: "1rem" }}>Upload Transfer Receipt</p>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: "rgba(247,245,240,0.6)" }} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="rounded-xl p-4" style={{ background: "#e8f0e4" }}>
            <p style={{ color: "#5a6e5c", fontSize: "0.72rem", marginBottom: "0.4rem" }}>TRANSFER TO</p>
            {[
              { label: "Bank", value: BANK_TRANSFER_DETAILS.bankName },
              { label: "Account name", value: BANK_TRANSFER_DETAILS.accountName },
              { label: "Account number", value: BANK_TRANSFER_DETAILS.accountNumber },
              { label: "Amount", value: formatNaira(sub.price) },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1">
                <span style={{ color: "#5a6e5c", fontSize: "0.78rem" }}>{row.label}</span>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.8rem" }}>{row.value}</span>
                  <button onClick={() => { navigator.clipboard.writeText(String(row.value)); toast.success("Copied!"); }}>
                    <Copy className="w-3 h-3" style={{ color: "#5a6e5c" }} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label style={{ color: "#1a2e1c", fontSize: "0.72rem", fontWeight: 600 }}>PHOTO OF RECEIPT</label>
            {photoPreview ? (
              <div className="relative w-full h-36 rounded-xl overflow-hidden mt-1.5">
                <img src={photoPreview} alt="receipt preview" className="w-full h-full object-cover" />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 w-full h-28 rounded-xl cursor-pointer mt-1.5" style={{ background: "#f0ece4", border: "1.5px dashed rgba(26,46,28,0.2)" }}>
                <Upload className="w-4 h-4" style={{ color: "#5a6e5c" }} />
                <span style={{ color: "#5a6e5c", fontSize: "0.75rem" }}>Tap to upload a photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            )}
          </div>

          <div>
            <label style={{ color: "#1a2e1c", fontSize: "0.72rem", fontWeight: 600 }}>TRANSACTION REFERENCE <span style={{ color: "#5a6e5c", fontWeight: 400 }}>(optional)</span></label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. bank session ID" className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" style={{ background: "#f0ece4", border: "none", outline: "none" }} />
          </div>

          <button onClick={submit} disabled={submitting} className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "#008751", color: "#fff" }}>
            {submitting ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "Submit for verification"}
          </button>
          <p style={{ color: "#5a6e5c", fontSize: "0.7rem", textAlign: "center" }}>An admin will confirm your payment shortly.</p>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Clean-out modal (one-time dispatch, custom quote) ──
function BulkCleanoutModal({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const [address, setAddress] = useState(profile?.address ?? "");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Only image files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB."); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!address || !description) { toast.error("Please describe the clean-out and your address."); return; }
    setSubmitting(true);
    let photo_url: string | null = null;

    if (photoFile) {
      const path = `${user!.id}/${Date.now()}-${photoFile.name}`;
      const { error: upErr } = await supabase.storage.from("pickup-photos").upload(path, photoFile);
      if (!upErr) {
        const { data } = supabase.storage.from("pickup-photos").getPublicUrl(path);
        photo_url = data.publicUrl;
      }
    }

    const { error } = await supabase.from("bulk_cleanouts").insert({ user_id: user!.id, address, description, photo_url });
    if (error) { toast.error("Could not submit request."); setSubmitting(false); return; }

    await supabase.from("notifications").insert({
      user_id: user!.id,
      title: "Clean-out request received 📦",
      message: "We received your bulk clean-out request. Our team will review your photo and send a custom quote shortly.",
      type: "info",
    });

    toast.success("Request sent — you'll get a custom quote soon.");
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0" style={{ background: "rgba(10,22,11,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "#fff" }}>
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: "#1a2e1c" }}>
          <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 700, fontSize: "1rem" }}>Bulk Clean-out</p>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: "rgba(247,245,240,0.6)" }} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p style={{ color: "#5a6e5c", fontSize: "0.8rem", lineHeight: 1.6 }}>
            Moving out or clearing a warehouse? Upload a photo of the junk and we'll send you a custom quote — pay before the truck arrives.
          </p>
          <div>
            <label style={{ color: "#1a2e1c", fontSize: "0.72rem", fontWeight: 600 }}>ADDRESS</label>
            <input value={address} onChange={e => setAddress(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" style={{ background: "#f0ece4", border: "none", outline: "none" }} />
          </div>
          <div>
            <label style={{ color: "#1a2e1c", fontSize: "0.72rem", fontWeight: 600 }}>DESCRIBE THE JUNK</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="e.g. 2-bedroom apartment, old furniture, mattresses" className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm resize-none" style={{ background: "#f0ece4", border: "none", outline: "none" }} />
          </div>
          <div>
            <label style={{ color: "#1a2e1c", fontSize: "0.72rem", fontWeight: 600 }}>PHOTO</label>
            {photoPreview ? (
              <div className="relative w-full h-32 rounded-xl overflow-hidden mt-1">
                <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 w-full h-24 rounded-xl cursor-pointer mt-1" style={{ background: "#f0ece4", border: "1.5px dashed rgba(26,46,28,0.2)" }}>
                <Upload className="w-4 h-4" style={{ color: "#5a6e5c" }} />
                <span style={{ color: "#5a6e5c", fontSize: "0.75rem" }}>Upload a photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            )}
          </div>
          <button onClick={submit} disabled={submitting} className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "#008751", color: "#fff" }}>
            {submitting ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "Request quote"}
          </button>
        </div>
      </div>
    </div>
  );
}