import { useNavigate } from "react-router";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../context/AuthContext";
import { APK_DOWNLOAD_URL, ADMIN_EMAIL } from "../constants";
import {
  ArrowRight, Leaf, Recycle, BarChart3, Calendar,
  CheckCircle2, Star, Bell, LayoutDashboard,
  LogOut, User, Trash2, MapPin, TrendingUp, Phone, Mail, Clock, MessageSquare,
  ArrowUpRight, ChevronRight, Repeat, Home as HomeIcon, Building2, Truck, CreditCard, Smartphone,
} from "lucide-react";

const HERO_IMG   = "https://xhsqygawsgsnpfwemczi.supabase.co/storage/v1/object/public/assets/disposal.jpg";
const CITY_IMG   = "https://xhsqygawsgsnpfwemczi.supabase.co/storage/v1/object/public/assets/Uyo,%20Akwa%20Ibom%20State_.jpg";
const AERIAL_IMG = "https://images.unsplash.com/photo-1707008797390-38f13ea40163?w=700&h=900&fit=crop&auto=format";

const STATS = [
  { value: "5,000+", label: "Nigerians served" },
  { value: "850 t", label: "Waste diverted" },
  { value: "₦8,000", label: "From / month" },
  { value: "99.1%", label: "On-time rate" },
];

const STEPS = [
  { n: "01", title: "Create account", body: "Sign up in under 60 seconds. No paperwork, no stress — simply provide your name, email, and service address.", icon: CheckCircle2 },
  { n: "02", title: "Subscribe to a plan", body: "Pick Basic or Commercial. We charge you monthly and show up on your fixed pickup days — no booking needed.", icon: Calendar },
  { n: "03", title: "We collect & report", body: "Verified agents arrive, collect, and send you an impact report.", icon: Recycle },
];

const FEATURES = [
  { icon: Repeat, title: "Fixed Weekly Pickups", body: "No more booking every time. Subscribe once and we show up on your fixed pickup day, every week, automatically." },
  { icon: CreditCard, title: "Billed Monthly", body: "Pay by card, bank, or USSD through Korapay — or transfer manually. We charge you once a month, no surprises." },
  { icon: BarChart3, title: "Personal Green Dashboard", body: "Track your cumulative impact, water protected. Share your milestone on WhatsApp." },
];

const TESTIMONIALS = [
  { name: "Anamemem Ekwere", role: "Shelter Afrique Estate, Uyo", body: "Before EcoWaste, I was burning my rubbish or waiting for the PSP truck that never showed. Now I book, they come. E no hard.", rating: 5 },
  { name: "Kenneth Sideso", role: "Restaurant owner, Nwaniba Road", body: "I generate serious organic waste daily. EcoWaste handles everything — commercial volume, custom schedules, they no dey let me down.", rating: 5 },
  { name: "Theodore Udosen", role: "Ewet Housing Estate, Uyo", body: "Had difficulty in seeing a dumpsite around, now with Ecowaste, i don't need to worry about that, they worry for me.", rating: 5 },
];

const CITIES = ["Uyo"];

const CONTACT_INFO = [
  { icon: Mail, label: "Email us", value: "support@ecowaste.ng", sub: "We reply within 24 hours", bg: "#e8f0e4", ic: "#008751" },
  { icon: Phone, label: "Call us", value: "+234 800 ECO WASTE", sub: "Mon – Sat, 8am – 6pm WAT", bg: "#dce8dd", ic: "#2d5230" },
  { icon: MapPin, label: "Head office", value: "Oron Road, Uyo, Akwa Ibom", sub: "By appointment only", bg: "#f0ece4", ic: "#5a6e5c" },
  { icon: Clock, label: "Operations hours", value: "Mon – Sat: 7am – 7pm", sub: "Sunday: Emergency pickups only", bg: "#e8f0e4", ic: "#008751" },
];

// Fill in the real profile URLs — left blank on purpose.
const SOCIAL_LINKS = [
  { label: "Twitter / X", href: "" },
  { label: "Instagram", href: "" },
  { label: "WhatsApp", href: "" },
];

function PublicHome() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: "var(--font-body)", background: "#f7f5f0", overflowX: "hidden" }}>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50"
        style={{ background: "rgba(10,22,11,0.92)", borderBottom: "1px solid rgba(247,245,240,0.06)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-between h-14 sm:h-16">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#008751" }}>
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span style={{ color: "#f7f5f0", fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.01em" }}>
              EcoWaste <span style={{ color: "#85c48a", fontWeight: 400 }}>Uyo</span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-7">
            {[
              { label: "How it works", href: "#how-it-works" },
              { label: "Plans", href: "/#plans" },
              { label: "Features", href: "#features" },
              { label: "Cities", href: "#cities" },
              { label: "Contact", href: "#contact" },
            ].map(item => (
              <a key={item.label} href={item.href}
                style={{ color: "rgba(247,245,240,0.6)", fontSize: "0.875rem" }}
                className="hover:text-white transition-colors">{item.label}</a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/login")}
              style={{ color: "rgba(247,245,240,0.7)", fontSize: "0.82rem" }}
              className="hidden sm:block hover:text-white transition-colors px-3 py-2">
              Sign in
            </button>
            <button onClick={() => navigate("/login")}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:opacity-90 whitespace-nowrap"
              style={{ background: "#008751", color: "#fff" }}>
              <span className="hidden sm:inline">Get started free</span>
              <span className="sm:hidden">Get started</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Nigerian flag strip */}
      <div className="fixed top-0 left-0 right-0 h-0.5 flex z-[60]">
        <div className="flex-1" style={{ background: "#008751" }} />
        <div className="flex-1" style={{ background: "#fff" }} />
        <div className="flex-1" style={{ background: "#008751" }} />
      </div>

      {/* HERO */}
      <section className="relative min-h-svh flex items-end pb-20 overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_IMG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(10,22,11,0.75) 0%, rgba(10,22,11,0.5) 40%, rgba(10,22,11,0.88) 100%)" }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 w-full pt-32">
          <div className="max-w-2xl">
            {/* Pill */}
            <h1 style={{ color: "#f7f5f0", fontSize: "clamp(2.4rem,7vw,4.8rem)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.03em" }}>
              Clean Uyo,<br />
              <span style={{ color: "#85c48a" }}>One Litter at a time.</span>
            </h1>

            <p style={{ color: "rgba(247,245,240,0.65)", fontSize: "clamp(0.95rem,2vw,1.1rem)", lineHeight: 1.75, marginTop: "1.25rem", maxWidth: "480px" }}>
              Subscribe once a month. We show up on your fixed pickup days automatically —
              no PSP wahala, no booking every time, no open burning. Real impact, tracked.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button onClick={() => navigate("/login")}
                className="group flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold transition-colors hover:opacity-95 text-sm"
                style={{ background: "#008751", color: "#fff" }}>
                See subscription plans
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-medium text-sm transition-colors hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.08)", color: "#f7f5f0", border: "1px solid rgba(255,255,255,0.15)" }}>
                See how it works
              </button>
            </div>

            {/* City pills */}
            <div className="flex gap-2 mt-8 flex-wrap">
              {CITIES.map(c => (
                <span key={c} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(247,245,240,0.55)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <MapPin className="w-2.5 h-2.5" /> {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Floating stats strip */}
        <div className="absolute bottom-0 left-0 right-0" style={{ background: "rgba(0,0,0,0.4)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="max-w-6xl mx-auto px-5 sm:px-8 grid grid-cols-4 divide-x divide-white/10">
            {STATS.map(s => (
              <div key={s.label} className="py-4 px-3 sm:px-6 text-center">
                <div style={{ color: "#85c48a", fontWeight: 800, fontSize: "clamp(1rem,3vw,1.5rem)", lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: "rgba(247,245,240,0.45)", fontSize: "clamp(0.6rem,1.5vw,0.75rem)", marginTop: "0.25rem" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-5 sm:px-8" style={{ background: "#f7f5f0" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-16">
            <div>
              <p style={{ color: "#008751", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em" }} className="mb-2">HOW IT WORKS</p>
              <h2 style={{ color: "#1a2e1c", fontSize: "clamp(1.7rem,4vw,2.6rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.025em" }}>
                Three steps
              </h2>
            </div>
            <button onClick={() => navigate("/login")}
              className="self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-90"
              style={{ background: "#1a2e1c", color: "#f7f5f0" }}>
              Get started <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.n} className="rounded-2xl p-7 relative overflow-hidden"
                style={{ background: i === 1 ? "#1a2e1c" : "#fff", border: `1px solid ${i === 1 ? "transparent" : "rgba(26,46,28,0.08)"}` }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "5rem", fontWeight: 800,
                  color: i === 1 ? "rgba(133,196,138,0.08)" : "rgba(26,46,28,0.04)",
                  lineHeight: 1, position: "absolute", top: "0.5rem", right: "1rem" }}>{step.n}</div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: i === 1 ? "rgba(133,196,138,0.15)" : "#e8f0e4" }}>
                  <step.icon className="w-5 h-5" style={{ color: i === 1 ? "#85c48a" : "#008751" }} />
                </div>
                <h3 style={{ color: i === 1 ? "#f7f5f0" : "#1a2e1c", fontWeight: 700, fontSize: "1.05rem", marginBottom: "0.6rem" }}>{step.title}</h3>
                <p style={{ color: i === 1 ? "rgba(247,245,240,0.55)" : "#5a6e5c", lineHeight: 1.7, fontSize: "0.875rem" }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SPLIT SECTION */}
      <section style={{ background: "#1a2e1c" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2">
          <div className="relative min-h-72 lg:min-h-0 overflow-hidden">
            <img src={CITY_IMG} alt="" className="w-full h-full object-cover opacity-75" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(26,46,28,0.5), transparent)" }} />
          </div>
          <div className="px-8 sm:px-12 py-14 flex flex-col justify-center">
            <p style={{ color: "#85c48a", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em", marginBottom: "1rem" }}>THE PROBLEM</p>
            <h2 style={{ color: "#f7f5f0", fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.025em" }}>
              690k tonnes of waste.
              <span style={{ color: "#85c48a", fontStyle: "italic" }}> Most of it unmanaged.</span>
            </h2>
            <p style={{ color: "rgba(247,245,240,0.55)", lineHeight: 1.8, fontSize: "0.9rem", marginTop: "1.25rem", maxWidth: "400px" }}>
              The Uyo Capital City Development Area generates an estimated 690,000 tonnes of municipal solid waste annually, with studies showing that collection systems still struggle to keep pace with rapid urban growth. Much of the uncollected waste finds its way into drains, rivers, and open dumps, worsening flooding and environmental hazards across our communities.
            </p>
            <button onClick={() => navigate("/login")}
              className="mt-8 self-start flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-colors hover:opacity-90"
              style={{ background: "#008751", color: "#fff" }}>
              Be part of the solution <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* PLANS / PRICING */}
      <section id="plans" className="py-24 px-5 sm:px-8" style={{ background: "#f7f5f0" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p style={{ color: "#008751", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em" }} className="mb-2">SUBSCRIPTION PLANS</p>
            <h2 style={{ color: "#1a2e1c", fontSize: "clamp(1.7rem,4vw,2.6rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.025em" }}>
              Pick a plan. We handle the rest.
            </h2>
            <p style={{ color: "#5a6e5c", fontSize: "0.9rem", marginTop: "0.75rem", maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
              No per-pickup booking. Subscribe once monthly, and we show up on your fixed pickup days automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Basic plan */}
            <div className="rounded-2xl p-7" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: "#e8f0e4" }}>
                <HomeIcon className="w-5 h-5" style={{ color: "#008751" }} />
              </div>
              <p style={{ color: "#5a6e5c", fontWeight: 600, fontSize: "0.72rem", letterSpacing: "0.06em" }}>RESIDENTIAL</p>
              <h3 style={{ color: "#1a2e1c", fontWeight: 800, fontSize: "1.3rem", marginTop: "0.3rem" }}>Basic Plan</h3>
              <div className="flex items-baseline gap-1.5 mt-3 mb-5">
                <span style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 800, fontSize: "2.2rem" }}>₦8,000</span>
                <span style={{ color: "#5a6e5c", fontSize: "0.85rem" }}>/ month</span>
              </div>
              <div className="flex flex-col gap-2.5 mb-7">
                {["1 fixed pickup every week (4x a month)", "Automatic monthly billing", "WhatsApp/SMS pickup reminders"].map(perk => (
                  <div key={perk} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#008751" }} />
                    <span style={{ color: "#5a6e5c", fontSize: "0.85rem", lineHeight: 1.5 }}>{perk}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate("/login")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors hover:opacity-90"
                style={{ background: "#1a2e1c", color: "#f7f5f0" }}>
                Subscribe to Basic <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Commercial plan */}
            <div className="rounded-2xl p-7 relative" style={{ background: "#1a2e1c" }}>
              <div className="absolute top-5 right-5 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: "#008751", color: "#fff" }}>
                MOST POPULAR
              </div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: "rgba(133,196,138,0.15)" }}>
                <Building2 className="w-5 h-5" style={{ color: "#85c48a" }} />
              </div>
              <p style={{ color: "rgba(247,245,240,0.5)", fontWeight: 600, fontSize: "0.72rem", letterSpacing: "0.06em" }}>SHOPS / OFFICES</p>
              <h3 style={{ color: "#f7f5f0", fontWeight: 800, fontSize: "1.3rem", marginTop: "0.3rem" }}>Commercial Plan</h3>
              <div className="flex items-baseline gap-1.5 mt-3 mb-5">
                <span style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 800, fontSize: "2.2rem" }}>₦15,000</span>
                <span style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.85rem" }}>/ month</span>
              </div>
              <div className="flex flex-col gap-2.5 mb-7">
                {["2 fixed pickups every week", "Priority truck routing", "Daily commercial pickup available"].map(perk => (
                  <div key={perk} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#85c48a" }} />
                    <span style={{ color: "rgba(247,245,240,0.7)", fontSize: "0.85rem", lineHeight: 1.5 }}>{perk}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate("/login")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors hover:opacity-90"
                style={{ background: "#008751", color: "#fff" }}>
                Subscribe to Commercial <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p style={{ color: "#5a6e5c", fontSize: "0.8rem", textAlign: "center", marginTop: "2rem" }}>
            Need a one-time, urgent pickup instead? <a href="/login" style={{ color: "#008751", fontWeight: 600 }}>Book it on-demand →</a>
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-5 sm:px-8" style={{ background: "#f7f5f0" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p style={{ color: "#008751", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em" }} className="mb-2">FEATURES</p>
            <h2 style={{ color: "#1a2e1c", fontSize: "clamp(1.7rem,4vw,2.6rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.025em" }}>
              Built for Nigeria's reality.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="rounded-2xl p-7 group hover:-translate-y-1 transition-colors duration-200"
                style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.07)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 transition-colors"
                  style={{ background: "#e8f0e4" }}>
                  <f.icon className="w-5 h-5" style={{ color: "#008751" }} />
                </div>
                <h3 style={{ color: "#1a2e1c", fontSize: "1rem", fontWeight: 700, marginBottom: "0.6rem" }}>{f.title}</h3>
                <p style={{ color: "#5a6e5c", lineHeight: 1.7, fontSize: "0.85rem" }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ background: "#1a2e1c" }} className="py-24 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <p style={{ color: "#85c48a", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em" }} className="mb-2">REAL PEOPLE. REAL CHANGE.</p>
            <h2 style={{ color: "#f7f5f0", fontSize: "clamp(1.7rem,4vw,2.6rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.025em" }}>
              Nigerians talking.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="rounded-2xl p-6 flex flex-col gap-5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" style={{ color: "#85c48a" }} />
                  ))}
                </div>
                <p style={{ color: "rgba(247,245,240,0.8)", lineHeight: 1.7, fontSize: "0.9rem", flex: 1 }}>"{t.body}"</p>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "1rem" }}>
                  <div style={{ color: "#f7f5f0", fontWeight: 600, fontSize: "0.85rem" }}>{t.name}</div>
                  <div style={{ color: "rgba(247,245,240,0.35)", fontSize: "0.72rem", marginTop: "0.2rem" }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CITIES */}
      <section id="cities" className="py-20 px-5 sm:px-8" style={{ background: "#f7f5f0" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
            <div>
              <p style={{ color: "#008751", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em" }} className="mb-2">NOW LIVE IN</p>
              <h2 style={{ color: "#1a2e1c", fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 800, letterSpacing: "-0.025em" }}>
                {CITIES.length} city — and growing fast.
              </h2>
            </div>
            <button onClick={() => navigate("/login")}
              className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-90"
              style={{ background: "#1a2e1c", color: "#f7f5f0" }}>
              Check your area <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {CITIES.map(city => (
              <div key={city} className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm"
                style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)", color: "#1a2e1c" }}>
                <MapPin className="w-3.5 h-3.5" style={{ color: "#008751" }} /> {city}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-24 px-5 sm:px-8" style={{ background: "#1a2e1c" }}>
        <div className="absolute right-0 top-0 bottom-0 w-2/5 hidden lg:block opacity-10 pointer-events-none">
          <img src={AERIAL_IMG} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="max-w-lg">
            <p style={{ color: "#85c48a", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em" }} className="mb-4">START TODAY</p>
            <h2 style={{ color: "#f7f5f0", fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
              Your cleanest home.<br />
              <span style={{ color: "#85c48a" }}>Starting now.</span>
            </h2>
            <p style={{ color: "rgba(247,245,240,0.5)", lineHeight: 1.75, fontSize: "0.9rem", marginTop: "1rem" }}>
              Plans start at ₦8,000/month. Join thousands of Nigerians building a cleaner nation, one weekly pickup at a time.
            </p>
            <button onClick={() => navigate("/login")}
              className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm transition-colors hover:opacity-90"
              style={{ background: "#008751", color: "#fff" }}>
              Create free account <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* GET THE APP — only on the website. Capacitor.isNativePlatform() is
          true when this same code is running inside the wrapped Android/iOS
          app itself, where it'd be pointless (and a little odd) to prompt
          someone to download the app they're already using. Keeping this as
          a runtime check on one Home.tsx, rather than a separate app-only
          copy of the page, means the two can never drift out of sync — any
          other change you make here automatically applies to both. */}
      {!Capacitor.isNativePlatform() && (
      <section className="py-20 px-5 sm:px-8" style={{ background: "#f7f5f0" }}>
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="max-w-md text-center lg:text-left">
            <p style={{ color: "#008751", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em" }} className="mb-3">TAKE US WITH YOU</p>
            <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "clamp(1.6rem,4vw,2.3rem)", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Get the EcoWaste Uyo app
            </h2>
            <p style={{ color: "#5a6e5c", lineHeight: 1.7, fontSize: "0.9rem", marginTop: "0.75rem" }}>
              Book pickups, track your schedule, and pay — all from your phone. Available on iOS and Android.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {/*
              iOS: still points at a placeholder — replace once you have a real
              App Store listing.

              Android: no Play Store listing yet, so this links straight to the
              signed release APK and forces a download via the `download` attr
              instead of navigating to a store page. Two ways to host the APK
              file itself — pick one and set APK_DOWNLOAD_URL below:

              1) Supabase Storage (recommended — keeps the ~5-50MB binary out
                 of your git repo/build, and you can swap the file for a new
                 version without redeploying the site):
                   - In the Supabase dashboard: Storage → New bucket → name it
                     "downloads" → toggle "Public bucket" on.
                   - Upload app-release.apk into it, e.g. as ecowaste-uyo.apk.
                   - Copy its public URL (Storage → the file → "Get URL") and
                     paste it below. It looks like:
                     https://<project-ref>.supabase.co/storage/v1/object/public/downloads/ecowaste-uyo.apk

              2) Bundle it as a static site asset instead:
                   - Create a `public/downloads/` folder at the project root
                     (same level as vite.config.ts) and put the APK there.
                   - Vite copies everything under `public/` as-is into the
                     build output, so it's served at /downloads/<filename>.
                   - Set APK_DOWNLOAD_URL below to "/downloads/ecowaste-uyo.apk".

              Either way: the APK must be a *signed* release build (the one
              Android Studio produces via Build > Generate Signed App Bundle /
              APK), not app-release-unsigned.apk — unsigned APKs fail to
              install on real devices.
            */}
            <a
              href="https://apps.apple.com/app/id0000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-3.5 rounded-xl transition-colors hover:opacity-90"
              style={{ background: "#1a2e1c" }}
            >
              <Smartphone className="w-6 h-6 flex-shrink-0" style={{ color: "#f7f5f0" }} />
              <div className="text-left">
                <p style={{ color: "rgba(247,245,240,0.6)", fontSize: "0.6rem" }}>Download on the</p>
                <p style={{ color: "#f7f5f0", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.1 }}>App Store</p>
              </div>
            </a>
            <a
              href={APK_DOWNLOAD_URL}
              download="ecowaste-uyo.apk"
              className="flex items-center gap-3 px-5 py-3.5 rounded-xl transition-colors hover:opacity-90"
              style={{ background: "#1a2e1c" }}
            >
              <Smartphone className="w-6 h-6 flex-shrink-0" style={{ color: "#f7f5f0" }} />
              <div className="text-left">
                <p style={{ color: "rgba(247,245,240,0.6)", fontSize: "0.6rem" }}>Direct download</p>
                <p style={{ color: "#f7f5f0", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.1 }}>Android APK</p>
              </div>
            </a>
          </div>
        </div>
      </section>
      )}

      {/* CONTACT */}
      <section id="contact" className="py-20 px-5 sm:px-8" style={{ background: "#f7f5f0" }}>
        <div className="max-w-6xl mx-auto">

          {/* Hero */}
          <div className="relative rounded-3xl overflow-hidden mb-12 px-6 py-16 sm:py-20 text-center">
            <div className="absolute inset-0">
              <img
                src="https://xhsqygawsgsnpfwemczi.supabase.co/storage/v1/object/public/assets/custom.jpg"
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0" style={{ background: "rgba(10,22,11,0.72)" }} />
            </div>
            <div className="relative z-10 max-w-xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-medium"
                style={{ background: "rgba(133,196,138,0.15)", color: "#85c48a", border: "1px solid rgba(133,196,138,0.25)" }}>
                <MessageSquare className="w-3.5 h-3.5" /> Get in touch
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontSize: "clamp(1.8rem,4vw,2.6rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "1rem" }}>
                We're here to help.
              </h2>
              <p style={{ color: "rgba(247,245,240,0.6)", fontSize: "0.9rem", lineHeight: 1.7 }}>
                Reach us through any of these channels. We're a Nigerian team solving a Nigerian problem — expect fast, friendly responses.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {CONTACT_INFO.map(info => (
              <div key={info.label} className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: info.bg }}>
                  <info.icon className="w-5 h-5" style={{ color: info.ic }} />
                </div>
                <p style={{ color: "#5a6e5c", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                  {info.label.toUpperCase()}
                </p>
                <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.875rem", lineHeight: 1.4 }}>
                  {info.value}
                </p>
                <p style={{ color: "#5a6e5c", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  {info.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Social links */}
          <div className="rounded-2xl p-6" style={{ background: "#1a2e1c" }}>
            <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.4rem" }}>
              Follow us on social media
            </p>
            <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.8rem", marginBottom: "1.25rem" }}>
              Updates, tips, and real pickup stories in Uyo.
            </p>
            <div className="flex gap-3 flex-wrap">
              {/* href left blank — drop in the real profile URLs */}
              {SOCIAL_LINKS.map(s => (
                <a key={s.label} href={s.href || undefined} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:opacity-80"
                  style={{ background: "rgba(133,196,138,0.15)", color: "#85c48a", border: "1px solid rgba(133,196,138,0.2)" }}>
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#0f1f10", borderTop: "1px solid rgba(247,245,240,0.05)" }} className="px-5 sm:px-8 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "#008751" }}>
              <Leaf className="w-3 h-3 text-white" />
            </div>
            <span style={{ color: "#f7f5f0", fontWeight: 700, fontSize: "0.9rem" }}>EcoWaste Uyo</span>
          </div>
          <p style={{ color: "rgba(247,245,240,0.25)", fontSize: "0.75rem" }}>
            © 2026 EcoWaste Ltd.
          </p>
        </div>
      </footer>
    </div>
  );
}

function LoggedInHome() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  if (user?.email === ADMIN_EMAIL) return null;

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const quickLinks = [
    { icon: LayoutDashboard, label: "My Dashboard", desc: "Stats, impact & overview", href: "/dashboard", dark: false },
    { icon: Calendar, label: "Subscribe", desc: "Weekly pickups, billed monthly", href: "/subscriptions", dark: true },
    { icon: Recycle, label: "Urgent Pickup", desc: "One-time, on-demand collection", href: "/book-pickup", dark: false },
    { icon: Bell, label: "Notifications", desc: "Updates & alerts", href: "/notifications", dark: false },
    { icon: User, label: "My Profile", desc: "Account settings", href: "/profile", dark: false },
  ];

  return (
    <div style={{ fontFamily: "var(--font-body)", background: "#f7f5f0", minHeight: "100svh" }}>
      <div className="h-1 flex">
        <div className="flex-1" style={{ background: "#008751" }} />
        <div className="flex-1" style={{ background: "#fff" }} />
        <div className="flex-1" style={{ background: "#008751" }} />
      </div>

      {/* Topbar */}
      <div className="px-5 sm:px-8 py-4 flex items-center justify-between" style={{ background: "#1a2e1c" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#008751" }}>
            <Leaf className="w-3.5 h-3.5 text-white" />
          </div>
          <span style={{ color: "#f7f5f0", fontWeight: 700, fontSize: "0.95rem" }}>EcoWaste Uyo</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/notifications")} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <Bell className="w-4 h-4 text-white/70" />
          </button>
          <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors"
            style={{ color: "rgba(247,245,240,0.55)" }}>
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* Hero welcome */}
      <div className="relative overflow-hidden" style={{ background: "#1a2e1c" }}>
        <img src={HERO_IMG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" aria-hidden />
        <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 py-14">
          <p style={{ color: "rgba(247,245,240,0.45)", fontSize: "0.82rem" }}>{greeting()},</p>
          <h1 style={{ color: "#f7f5f0", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1 }} className="mt-1">
            {displayName} 👋
          </h1>
          <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.875rem", marginTop: "0.4rem" }}>
            Welcome back to EcoWaste Uyo.
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
        <h2 style={{ color: "#1a2e1c", fontWeight: 700, fontSize: "1rem", marginBottom: "1.25rem" }}>Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map(link => (
            <button key={link.label} onClick={() => navigate(link.href)}
              className="flex items-center gap-4 p-5 rounded-2xl text-left transition-colors"
              style={{ background: link.dark ? "#1a2e1c" : "#fff", border: link.dark ? "none" : "1px solid rgba(26,46,28,0.08)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: link.dark ? "rgba(255,255,255,0.1)" : "#e8f0e4" }}>
                <link.icon className="w-5 h-5" style={{ color: link.dark ? "#85c48a" : "#008751" }} />
              </div>
              <div>
                <div style={{ color: link.dark ? "#f7f5f0" : "#1a2e1c", fontWeight: 600, fontSize: "0.875rem" }}>{link.label}</div>
                <div style={{ color: link.dark ? "rgba(247,245,240,0.45)" : "#5a6e5c", fontSize: "0.75rem", marginTop: "0.15rem" }}>{link.desc}</div>
              </div>
              <ArrowRight className="w-4 h-4 ml-auto flex-shrink-0 opacity-30" style={{ color: link.dark ? "#fff" : "#1a2e1c" }} />
            </button>
          ))}
        </div>

        {/* Subscription promo */}
        <div className="mt-8 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5" style={{ background: "#1a2e1c" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#008751" }}>
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p style={{ color: "#f7f5f0", fontWeight: 600, fontSize: "0.9rem" }}>Never miss a pickup again</p>
            <p style={{ color: "rgba(247,245,240,0.45)", fontSize: "0.78rem", marginTop: "0.2rem" }}>Subscribe once and your bins get collected on schedule, every week — no more chasing a truck down.</p>
          </div>
          <button onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0 hover:opacity-90 transition-colors"
            style={{ background: "#008751", color: "#fff" }}>
            View <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user?.email === ADMIN_EMAIL) {
      navigate("/admin", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return (
    <div className="min-h-svh flex items-center justify-center" style={{ background: "#f7f5f0" }}>
      <div className="w-8 h-8 rounded-full border-2 border-[#008751] border-t-transparent animate-spin" />
    </div>
  );
  if (user?.email === ADMIN_EMAIL) return (
    <div className="min-h-svh flex items-center justify-center" style={{ background: "#f7f5f0" }}>
      <div className="w-8 h-8 rounded-full border-2 border-[#008751] border-t-transparent animate-spin" />
    </div>
  );
  return user ? <LoggedInHome /> : <PublicHome />;
}