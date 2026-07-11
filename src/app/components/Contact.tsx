import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import {
  Leaf, Mail, Phone, MapPin,
  MessageSquare, Clock
} from "lucide-react";

const CONTACT_INFO = [
  {
    icon: Mail,
    label: "Email us",
    value: "support@ecowaste.ng",
    sub: "We reply within 24 hours",
    bg: "#e8f0e4",
    ic: "#008751",
  },
  {
    icon: Phone,
    label: "Call us",
    value: "+234 800 ECO WASTE",
    sub: "Mon – Sat, 8am – 6pm WAT",
    bg: "#dce8dd",
    ic: "#2d5230",
  },
  {
    icon: MapPin,
    label: "Head office",
    value: "Oron Road, Uyo, Akwa Ibom",
    sub: "By appointment only",
    bg: "#f0ece4",
    ic: "#5a6e5c",
  },
  {
    icon: Clock,
    label: "Operations hours",
    value: "Mon – Sat: 7am – 7pm",
    sub: "Sunday: Emergency pickups only",
    bg: "#e8f0e4",
    ic: "#008751",
  },
];

export function Contact() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div style={{ fontFamily: "var(--font-body)", background: "#f7f5f0" }} className="min-h-svh">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50"
        style={{ background: "rgba(10,22,11,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(247,245,240,0.06)" }}>
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
              { label: "How it works", href: "/#how-it-works" },
              { label: "Features", href: "/#features" },
              { label: "Cities", href: "/#cities" },
              { label: "Contact", href: "/contact" },
            ].map(item => (
              <a key={item.label} href={item.href}
                style={{ color: item.href === "/contact" ? "#f7f5f0" : "rgba(247,245,240,0.6)", fontSize: "0.875rem", fontWeight: item.href === "/contact" ? 600 : 400 }}
                className="hover:text-white transition-colors">{item.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <button onClick={() => navigate("/dashboard")}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:opacity-90"
                style={{ background: "#008751", color: "#fff" }}>
                My Dashboard
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Nigerian flag strip */}
      <div className="fixed top-0 left-0 right-0 h-1 flex z-[60]">
        <div className="flex-1" style={{ background: "#008751" }} />
        <div className="flex-1" style={{ background: "#ffffff" }} />
        <div className="flex-1" style={{ background: "#008751" }} />
      </div>

      {/* HERO HEADER */}
      <section className="relative pt-32 pb-16 px-6 text-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="https://xhsqygawsgsnpfwemczi.supabase.co/storage/v1/object/public/assets/custom.jpg"
            alt="Contact hero"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: "rgba(10,22,11,0.72)" }} />
        </div>
        {/* Content */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-medium"
            style={{ background: "rgba(133,196,138,0.15)", color: "#85c48a", border: "1px solid rgba(133,196,138,0.25)" }}>
            <MessageSquare className="w-3.5 h-3.5" /> Get in touch
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "1rem" }}>
            We're here to help.
          </h1>
          <p style={{ color: "rgba(247,245,240,0.6)", fontSize: "1rem", maxWidth: "480px", margin: "0 auto", lineHeight: 1.7 }}>
            Whether you have a question about pickups, partnerships, or just want to say hello — our team in Uyo is ready.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto">
            <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Contact information
            </h2>
            <p style={{ color: "#5a6e5c", fontSize: "0.875rem", marginBottom: "2rem", lineHeight: 1.7 }}>
              Reach us through any of these channels. We're a Nigerian team solving a Nigerian problem — expect fast, friendly responses.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-10">
              {CONTACT_INFO.map(info => (
                <div key={info.label} className="rounded-2xl p-5"
                  style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: info.bg }}>
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
                {["Twitter / X", "Instagram", "WhatsApp", "LinkedIn"].map(s => (
                  <span key={s} className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ background: "rgba(133,196,138,0.15)", color: "#85c48a", border: "1px solid rgba(133,196,138,0.2)" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
      </div>

      {/* FOOTER */}
      <footer className="py-10 px-6 text-center" style={{ borderTop: "1px solid rgba(26,46,28,0.08)" }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#1a2e1c" }}>
            <Leaf className="w-3.5 h-3.5 text-white" />
          </div>
          <span style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "0.95rem" }}>
            EcoWaste Uyo
          </span>
        </div>
        <p style={{ color: "#5a6e5c", fontSize: "0.78rem" }}>
          © 2024 EcoWaste Uyo. Built with 💚 for a cleaner Uyo.
        </p>
      </footer>
    </div>
  );
}
