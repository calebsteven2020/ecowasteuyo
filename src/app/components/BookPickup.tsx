import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft, Leaf, ChevronLeft, ChevronRight, Upload, X, CheckCircle2, Share2, LayoutDashboard, CalendarDays } from "lucide-react";
import { supabase } from "../../../utils/supabase/client";
import { useAuth } from "../context/AuthContext";
import { payWithKorapay, newPaymentReference } from "../../../utils/korapay/checkout";
import { isProfileComplete, PROFILE_INCOMPLETE_MESSAGE } from "../../../utils/profile/isProfileComplete";

const URGENT_PRICE = 8000; // Fixed flat price for all urgent pickups

const WASTE_TYPES = [
  { value: "General Waste", emoji: "🗑️", desc: "Household non-recyclable" },
  { value: "Recyclable Materials", emoji: "♻️", desc: "Paper, plastic, glass, tin" },
  { value: "Organic Waste", emoji: "🌿", desc: "Food scraps, garden waste" },
  { value: "Electronic Waste", emoji: "💻", desc: "Devices, batteries, cables" },
  { value: "Hazardous Waste", emoji: "⚠️", desc: "Chemicals, paint, oils" },
  { value: "Construction Debris", emoji: "🏗️", desc: "Rubble, timber, blocks" },
];

const formatNaira = (amount: number) => "₦" + amount.toLocaleString("en-NG");

const TIME_SLOTS = [
  "7:00 AM – 9:00 AM", "9:00 AM – 11:00 AM",
  "11:00 AM – 1:00 PM", "1:00 PM – 3:00 PM", "3:00 PM – 5:00 PM",
];

const LAGOS_LGAS = ["Uyo"];

function InlineCalendar({ selected, onSelect }: { selected: Date | undefined; onSelect: (d: Date) => void }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ background:"#fff", borderRadius:"16px", border:"1px solid rgba(26,46,28,0.1)", padding:"16px", width:"280px", userSelect:"none" }}>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#e8f0e4] transition-colors">
          <ChevronLeft className="w-4 h-4" style={{color:"#1a2e1c"}} />
        </button>
        <span style={{fontFamily:"var(--font-display)",color:"#1a2e1c",fontWeight:600,fontSize:"0.875rem"}}>
          {new Date(viewYear,viewMonth).toLocaleString("default",{month:"long",year:"numeric"})}
        </span>
        <button type="button" onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#e8f0e4] transition-colors">
          <ChevronRight className="w-4 h-4" style={{color:"#1a2e1c"}} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} style={{textAlign:"center",color:"#5a6e5c",fontSize:"0.68rem",fontWeight:500,padding:"4px 0"}}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day,idx) => {
          if (!day) return <div key={`e${idx}`} />;
          const date = new Date(viewYear,viewMonth,day); date.setHours(0,0,0,0);
          const isPast = date < today;
          const isSel = selected && date.toDateString()===selected.toDateString();
          const isToday = date.toDateString()===today.toDateString();
          return (
            <button key={day} type="button" disabled={isPast} onClick={() => !isPast && onSelect(date)}
              className="flex items-center justify-center"
              style={{width:"36px",height:"36px",borderRadius:"8px",fontSize:"0.78rem",fontWeight:isSel?600:400,background:isSel?"#1a2e1c":isToday?"#e8f0e4":"transparent",color:isSel?"#f7f5f0":isPast?"rgba(26,46,28,0.2)":"#1a2e1c",border:"none",cursor:isPast?"not-allowed":"pointer",transition:"background 0.12s"}}
              onMouseEnter={e => {if(!isSel&&!isPast)(e.target as HTMLElement).style.background="#e8f0e4";}}
              onMouseLeave={e => {if(!isSel&&!isPast)(e.target as HTMLElement).style.background=isToday?"#e8f0e4":"transparent";}}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BookPickup() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [date, setDate] = useState<Date>();
  const [showCal, setShowCal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ wasteTypes:[] as string[], address:"", lga:"", time:"", notes:"", estimatedWeight:"" });
  const [confirmed, setConfirmed] = useState(false);
  const [bookingRef, setBookingRef] = useState("");
  const [confirmedDetails, setConfirmedDetails] = useState<{ wasteType: string; address: string; date: string; time: string; price: number } | null>(null);

  const set = (k: string, v: string) => setForm(f => ({...f, [k]: v}));

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) { toast.error("Only image files are allowed."); e.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be smaller than 5MB."); e.target.value = ""; return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const sanitize = (str: string) => str.replace(/<[^>]*>/g, "").trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.address = sanitize(form.address);
    form.notes = sanitize(form.notes);
    if (form.wasteTypes.length === 0) { toast.error("Please select at least one waste type"); return; }
    if (!date) { toast.error("Please select a pickup date"); return; }
    if (!form.time) { toast.error("Please select a time slot"); return; }
    if (!user) return;
    if (!isProfileComplete(profile)) {
      toast.error(PROFILE_INCOMPLETE_MESSAGE);
      navigate("/profile");
      return;
    }
    setSubmitting(true);

    const fullAddress = `${form.address}${form.lga ? ", " + form.lga : ""}`;
    const reference = newPaymentReference("URG");
    let handled = false;

    try {
      await payWithKorapay({
        amount: URGENT_PRICE,
        email: user.email!,
        name: profile?.full_name ?? undefined,
        reference,
        narration: "EcoWaste Urgent Pickup — ₦8,000",
        onSuccess: async (data) => {
          if (handled) return;
          handled = true;

          let photoUrl: string | null = null;
          if (photoFile) {
            const path = `${user.id}/${Date.now()}-${photoFile.name}`;
            const { error: upErr } = await supabase.storage.from("pickup-photos").upload(path, photoFile);
            if (!upErr) {
              const { data: { publicUrl } } = supabase.storage.from("pickup-photos").getPublicUrl(path);
              photoUrl = publicUrl;
            }
          }

          const { data: pickupData, error } = await supabase.from("pickups").insert({
            user_id: user.id,
            waste_type: form.wasteTypes.join(", "),
            address: fullAddress,
            pickup_date: format(date, "MMM dd, yyyy"),
            pickup_time: form.time,
            status: "scheduled",
            source: "urgent",
            estimated_weight: form.estimatedWeight ? parseFloat(form.estimatedWeight) : null,
            notes: form.notes || null,
            photo_url: photoUrl,
            price: URGENT_PRICE,
          }).select().maybeSingle();

          if (error) {
            toast.error("Payment succeeded but booking failed. Contact support. Ref: " + reference);
            setSubmitting(false);
            return;
          }

          // Record payment for user + admin visibility
          await supabase.from("payments").insert({
            user_id: user.id,
            purpose: "urgent_pickup",
            amount: URGENT_PRICE,
            channel: "korapay",
            status: "success",
            korapay_reference: data?.reference ?? reference,
          });

          await supabase.from("notifications").insert({
            user_id: user.id,
            title: "Urgent Pickup Confirmed ⚡",
            message: `Your urgent pickup on ${format(date, "MMM dd, yyyy")} at ${form.time} has been booked and paid. Ref: ${reference}`,
            type: "success",
          });

          const ref = `URG-${Date.now().toString(36).toUpperCase().slice(-6)}`;
          setBookingRef(ref);
          setConfirmedDetails({
            wasteType: form.wasteTypes.join(", "),
            address: fullAddress,
            date: format(date, "MMMM d, yyyy"),
            time: form.time,
            price: URGENT_PRICE,
          });
          setConfirmed(true);
          setSubmitting(false);
        },
        onFailed: () => {
          if (!handled) { handled = true; toast.error("Payment failed. Please try again."); setSubmitting(false); }
        },
        onClose: () => { if (!handled) setSubmitting(false); },
      });
    } catch {
      toast.error("Couldn't open payment. Please try again.");
      setSubmitting(false);
    }
  };

  const inp = { background:"#f0ece4", border:"1.5px solid transparent", borderRadius:"12px", color:"#1a2e1c", fontSize:"0.875rem", padding:"12px 16px", width:"100%", outline:"none", transition:"border-color 0.15s", fontFamily:"var(--font-body)" } as React.CSSProperties;
  const lbl = { color:"#1a2e1c", fontSize:"0.72rem", fontWeight:600, letterSpacing:"0.06em", display:"block", marginBottom:"8px" } as React.CSSProperties;
  const focus = (e: React.FocusEvent<any>) => (e.target.style.borderColor = "#008751");
  const blur  = (e: React.FocusEvent<any>) => (e.target.style.borderColor = "transparent");

  if (!profile?.phone) return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 py-16" style={{ background: "#f7f5f0", fontFamily: "var(--font-body)" }}>
      <div className="fixed top-0 left-0 right-0 h-1 flex z-50">
        <div className="flex-1" style={{ background: "#008751" }} /><div className="flex-1" style={{ background: "#ffffff" }} /><div className="flex-1" style={{ background: "#008751" }} />
      </div>
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "#e8f0e4" }}>
          <span style={{ fontSize: "2rem" }}>📱</span>
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Complete your profile first</h2>
        <p style={{ color: "#5a6e5c", fontSize: "0.875rem", lineHeight: 1.7, marginBottom: "2rem" }}>Add a phone number before booking a pickup.</p>
        <button onClick={() => navigate("/profile")} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium" style={{ background: "#1a2e1c", color: "#f7f5f0" }}>
          Complete profile
        </button>
        <button onClick={() => navigate("/dashboard")} className="w-full mt-3 py-3 rounded-xl text-sm font-medium" style={{ background: "#f0ece4", color: "#5a6e5c" }}>Back to dashboard</button>
      </div>
    </div>
  );

  if (confirmed && confirmedDetails) return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 py-16" style={{ background: "#f7f5f0", fontFamily: "var(--font-body)", animation: "fadeIn 0.4s ease" }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "#c0392b" }}>
          <span style={{ fontSize: "2rem" }}>⚡</span>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1.8rem", fontWeight: 700, textAlign: "center", marginBottom: "0.4rem" }}>Pickup booked!</h1>
        <p style={{ color: "#5a6e5c", textAlign: "center", fontSize: "0.875rem", marginBottom: "1.75rem" }}>Payment confirmed · your agent is being assigned</p>
        <div className="rounded-2xl overflow-hidden mb-6" style={{ border: "1px solid rgba(26,46,28,0.1)" }}>
          <div className="px-5 py-3" style={{ background: "#1a2e1c" }}>
            <p style={{ color: "rgba(247,245,240,0.45)", fontSize: "0.65rem", letterSpacing: "0.08em" }}>BOOKING REFERENCE</p>
            <p style={{ fontFamily: "monospace", color: "#85c48a", fontWeight: 700, fontSize: "1rem" }}>{bookingRef}</p>
          </div>
          <div className="px-5 py-4 flex flex-col gap-3" style={{ background: "#fff" }}>
            {[
              { l: "Waste type", v: confirmedDetails.wasteType },
              { l: "Address", v: confirmedDetails.address },
              { l: "Date", v: confirmedDetails.date },
              { l: "Time", v: confirmedDetails.time },
              { l: "Amount paid", v: formatNaira(confirmedDetails.price) },
            ].map(row => (
              <div key={row.l} className="flex justify-between gap-2">
                <span style={{ color: "#5a6e5c", fontSize: "0.78rem" }}>{row.l}</span>
                <span style={{ color: "#1a2e1c", fontWeight: 500, fontSize: "0.78rem", textAlign: "right" }}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { if (navigator.share) navigator.share({ title: "EcoWaste Pickup Confirmed", text: `Booked! Ref: ${bookingRef}` }).catch(() => {}); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium" style={{ background: "#f0ece4", color: "#1a2e1c" }}>
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button onClick={() => navigate("/dashboard")} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium" style={{ background: "#1a2e1c", color: "#f7f5f0" }}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
        </div>
        <button onClick={() => navigate("/history")} className="w-full mt-3 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5" style={{ background: "#e8f0e4", color: "#2d5230" }}>
          <CalendarDays className="w-4 h-4" /> View booking history
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-svh" style={{background:"#f7f5f0",fontFamily:"var(--font-body)"}}>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button type="button" onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 mb-6 opacity-45 hover:opacity-75 transition-opacity" style={{color:"#1a2e1c",fontSize:"0.78rem"}}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </button>
        <h1 style={{fontFamily:"var(--font-display)",color:"#1a2e1c",fontSize:"clamp(1.8rem,3vw,2.3rem)",fontWeight:700,letterSpacing:"-0.02em",lineHeight:1.1}}>⚡ Urgent Pickup</h1>
        <p style={{color:"#5a6e5c",fontSize:"0.875rem",marginTop:"0.35rem",marginBottom:"0.75rem"}}>One-time, on-demand collection. Pay now — agent dispatched same day.</p>

        {/* Fixed price banner */}
        <div className="flex items-center justify-between p-4 rounded-2xl mb-6" style={{ background: "#1a2e1c" }}>
          <div>
            <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.65rem", letterSpacing: "0.07em" }}>FLAT RATE — ALL WASTE TYPES</p>
            <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 800, fontSize: "1.5rem", marginTop: "0.1rem" }}>{formatNaira(URGENT_PRICE)}</p>
          </div>
          <div className="text-right">
            <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.7rem" }}>Pay securely via</p>
            <p style={{ color: "#85c48a", fontWeight: 600, fontSize: "0.78rem" }}>Korapay</p>
          </div>
        </div>

        <button type="button" onClick={() => navigate("/subscriptions")} className="flex items-center gap-1.5 mb-6 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: "#e8f0e4", color: "#2d5230" }}>
          💡 Need weekly pickups? A subscription saves more — view plans
        </button>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Waste type */}
          <div className="rounded-2xl p-6" style={{background:"#fff",border:"1px solid rgba(26,46,28,0.08)"}}>
            <div className="flex items-center justify-between mb-3">
              <span style={lbl}>WASTE TYPE</span>
              <span style={{color:"#5a6e5c",fontSize:"0.72rem"}}>Select all that apply</span>
            </div>
            {form.wasteTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {form.wasteTypes.map(wt => (
                  <span key={wt} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{background:"#1a2e1c",color:"#85c48a"}}>
                    {wt}
                    <button type="button" onClick={() => setForm(f => ({...f, wasteTypes: f.wasteTypes.filter(t => t !== wt)}))} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WASTE_TYPES.map(wt => {
                const active = form.wasteTypes.includes(wt.value);
                return (
                  <button type="button" key={wt.value}
                    onClick={() => setForm(f => ({ ...f, wasteTypes: active ? f.wasteTypes.filter(t => t !== wt.value) : [...f.wasteTypes, wt.value] }))}
                    className="flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
                    style={{ background: active ? "#1a2e1c" : "#f7f5f0", border: `1.5px solid ${active ? "#1a2e1c" : "rgba(26,46,28,0.12)"}` }}>
                    <span style={{fontSize:"1.2rem"}}>{wt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div style={{color:active?"#f7f5f0":"#1a2e1c",fontWeight:600,fontSize:"0.82rem"}}>{wt.value}</div>
                      <div style={{color:active?"rgba(247,245,240,0.55)":"#5a6e5c",fontSize:"0.7rem",marginTop:"1px"}}>{wt.desc}</div>
                    </div>
                    {active && <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{background:"#008751"}}><CheckCircle2 className="w-3 h-3 text-white" /></div>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Address */}
          <div className="rounded-2xl p-6" style={{background:"#fff",border:"1px solid rgba(26,46,28,0.08)"}}>
            <label style={lbl}>PICKUP ADDRESS</label>
            <textarea rows={2} placeholder="House / flat number and street name" value={form.address}
              onChange={e => set("address", e.target.value)} required style={{...inp,resize:"none"}} onFocus={focus} onBlur={blur} />
            <label style={{...lbl,marginTop:"14px"}}>LOCAL GOVERNMENT AREA</label>
            <select value={form.lga} onChange={e => set("lga", e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option value="">Select your LGA / city</option>
              {LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>

          {/* Date + Time */}
          <div className="rounded-2xl p-6" style={{background:"#fff",border:"1px solid rgba(26,46,28,0.08)"}}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label style={lbl}>PICKUP DATE</label>
                <div className="relative">
                  <button type="button" onClick={() => setShowCal(v => !v)} className="w-full flex items-center gap-2 transition-colors"
                    style={{...inp,textAlign:"left",cursor:"pointer",borderColor:showCal?"#008751":"transparent"}}>
                    <CalendarIcon className="w-4 h-4 flex-shrink-0" style={{color:"#008751"}} />
                    <span style={{color:date?"#1a2e1c":"#5a6e5c",fontSize:"0.875rem"}}>{date ? format(date,"MMMM d, yyyy") : "Select a date"}</span>
                  </button>
                  {showCal && <div className="absolute top-full mt-2 z-50"><InlineCalendar selected={date} onSelect={d => { setDate(d); setShowCal(false); }} /></div>}
                </div>
              </div>
              <div>
                <label style={lbl}>TIME SLOT</label>
                <div className="flex flex-col gap-2">
                  {TIME_SLOTS.map(slot => {
                    const active = form.time === slot;
                    return (
                      <button type="button" key={slot} onClick={() => set("time", slot)} className="px-3 py-2.5 rounded-xl text-left transition-colors"
                        style={{background:active?"#1a2e1c":"#f7f5f0",color:active?"#f7f5f0":"#1a2e1c",fontSize:"0.8rem",fontWeight:active?500:400,border:`1.5px solid ${active?"#1a2e1c":"transparent"}`}}>
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Extra details */}
          <div className="rounded-2xl p-6" style={{background:"#fff",border:"1px solid rgba(26,46,28,0.08)"}}>
            <div className="flex flex-col gap-5">
              <div>
                <label style={lbl}>ESTIMATED WEIGHT <span style={{color:"#5a6e5c",fontWeight:400}}>— optional</span></label>
                <div className="flex items-center gap-3 mt-1">
                  <button type="button" onClick={() => set("estimatedWeight", String(Math.max(0, (parseFloat(form.estimatedWeight)||0) - 1)))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0" style={{background:"#e8f0e4",color:"#1a2e1c"}}>−</button>
                  <div className="flex-1 text-center">
                    <div style={{fontFamily:"var(--font-display)",color:"#1a2e1c",fontSize:"1.6rem",fontWeight:700,lineHeight:1}}>
                      {form.estimatedWeight || "0"}<span style={{fontSize:"0.9rem",fontWeight:400,color:"#5a6e5c",marginLeft:"4px"}}>kg</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => set("estimatedWeight", String((parseFloat(form.estimatedWeight)||0) + 1))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0" style={{background:"#1a2e1c",color:"#fff"}}>+</button>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {[5,10,20,50].map(kg => (
                    <button type="button" key={kg} onClick={() => set("estimatedWeight", String(kg))} className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                      style={{ background: parseFloat(form.estimatedWeight) === kg ? "#1a2e1c" : "#f0ece4", color: parseFloat(form.estimatedWeight) === kg ? "#f7f5f0" : "#5a6e5c" }}>
                      {kg}kg
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>WASTE PHOTO <span style={{color:"#5a6e5c",fontWeight:400}}>— optional</span></label>
                {photoPreview ? (
                  <div className="relative w-full h-36 rounded-xl overflow-hidden">
                    <img src={photoPreview} alt="Waste preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={{background:"rgba(0,0,0,0.5)"}}>
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 w-full h-28 rounded-xl cursor-pointer" style={{background:"#f0ece4",border:"1.5px dashed rgba(26,46,28,0.2)"}}>
                    <Upload className="w-5 h-5" style={{color:"#5a6e5c"}} />
                    <span style={{color:"#5a6e5c",fontSize:"0.78rem"}}>Tap to upload a photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  </label>
                )}
              </div>
              <div>
                <label style={lbl}>SPECIAL INSTRUCTIONS <span style={{color:"#5a6e5c",fontWeight:400}}>— optional</span></label>
                <textarea rows={3} placeholder="Gate code, access notes, heavy items..." value={form.notes}
                  onChange={e => set("notes", e.target.value)} style={{...inp,resize:"none"}} onFocus={focus} onBlur={blur} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 p-4 rounded-2xl" style={{background:"#e8f0e4"}}>
            <Leaf className="w-4 h-4 flex-shrink-0 mt-0.5" style={{color:"#008751"}} />
            <p style={{color:"#2d5230",fontSize:"0.8rem",lineHeight:1.6}}>
              Please bag your waste before collection. Hazardous waste requires advance documentation. We operate Monday–Saturday, 7 AM–5 PM.
            </p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => navigate("/dashboard")} className="flex-1 py-3.5 rounded-xl font-medium" style={{background:"#ede9e2",color:"#1a2e1c",fontSize:"0.875rem"}}>Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3.5 rounded-xl font-medium disabled:opacity-60 flex items-center justify-center gap-2" style={{background:"#c0392b",color:"#fff",fontSize:"0.875rem"}}>
              {submitting ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : `Pay ${formatNaira(URGENT_PRICE)} & Book`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}