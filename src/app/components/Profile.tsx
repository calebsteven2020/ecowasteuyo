import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, User, Upload, Save, Phone, MapPin, Mail, Leaf } from "lucide-react";
import { supabase } from "../../../utils/supabase/client";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export function Profile() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Use signup name as fallback if profile name not yet set
  const signupName = user?.user_metadata?.full_name ?? "";
  const [form, setForm] = useState({
    full_name: profile?.full_name || signupName,
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url ?? null;
      if (avatarFile) {
        const path = `${user.id}/avatar-${Date.now()}`;
        const { error: upErr } = await supabase.storage.from("pickup-photos").upload(path, avatarFile, { upsert: true });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("pickup-photos").getPublicUrl(path);
          avatarUrl = publicUrl;
        }
      }
      const { error } = await supabase.from("profiles").upsert({ id: user.id, ...form, avatar_url: avatarUrl });
      if (error) { toast.error(error.message); return; }
      await refreshProfile();
      toast.success("Profile updated!");
    } finally {
      setSaving(false);
    }
  };

  const inp = { background: "#f0ece4", border: "1.5px solid transparent", borderRadius: "12px", color: "#1a2e1c", fontSize: "0.875rem", padding: "13px 16px", width: "100%", outline: "none", transition: "border-color 0.15s", fontFamily: "var(--font-body)" } as React.CSSProperties;
  const lbl = { color: "#1a2e1c", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", display: "block", marginBottom: "8px" } as React.CSSProperties;
  const focus = (e: React.FocusEvent<any>) => (e.target.style.borderColor = "#008751");
  const blur  = (e: React.FocusEvent<any>) => (e.target.style.borderColor = "transparent");

  return (
    <div className="min-h-screen" style={{ background: "#f7f5f0", fontFamily: "var(--font-body)" }}>
      <div className="max-w-lg mx-auto px-6 py-10">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 mb-6 opacity-45 hover:opacity-75 transition-opacity" style={{ color: "#1a2e1c", fontSize: "0.78rem" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </button>
        <h1 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "clamp(1.8rem,3vw,2.3rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>My Profile</h1>
        <p style={{ color: "#5a6e5c", fontSize: "0.875rem", marginTop: "0.3rem", marginBottom: "2rem" }}>Manage your account details.</p>

        {/* Avatar */}
        <div className="rounded-2xl p-6 mb-5 flex flex-col items-center gap-4" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "#e8f0e4" }}>
              {avatarPreview
                ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                : <User className="w-10 h-10" style={{ color: "#008751" }} />}
            </div>
            <button onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-80" style={{ background: "#1a2e1c" }}>
              <Upload className="w-3.5 h-3.5 text-white" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>
          <div className="text-center">
            <p style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 600, fontSize: "1rem" }}>{form.full_name || "Your name"}</p>
            <p style={{ color: "#5a6e5c", fontSize: "0.8rem", marginTop: "0.2rem" }}>{user?.email}</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl p-6 mb-5 flex flex-col gap-5" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
          <div>
            <label style={lbl}>
              <User className="w-3 h-3 inline mr-1.5" style={{color:"#008751"}} />FULL NAME
            </label>
            <input
              value={form.full_name}
              onChange={e => set("full_name", e.target.value)}
              placeholder="John Doe"
              style={inp}
              onFocus={focus}
              onBlur={blur}
            />
            {form.full_name && !profile?.full_name && (
              <p style={{ color: "#008751", fontSize: "0.7rem", marginTop: "6px", opacity: 0.7 }}>
                ✓ Pre-filled from your signup details — update if needed
              </p>
            )}
          </div>
          <div>
            <label style={lbl}><Mail className="w-3 h-3 inline mr-1.5" style={{color:"#008751"}} />EMAIL</label>
            <input value={user?.email ?? ""} disabled style={{ ...inp, opacity: 0.5, cursor: "not-allowed" }} />
          </div>
          <div>
            <label style={lbl}><Phone className="w-3 h-3 inline mr-1.5" style={{color:"#008751"}} />PHONE NUMBER</label>
            <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+234 801 234 5678" style={inp} onFocus={focus} onBlur={blur} />
          </div>
          <div>
            <label style={lbl}><MapPin className="w-3 h-3 inline mr-1.5" style={{color:"#008751"}} />DEFAULT PICKUP ADDRESS</label>
            <textarea rows={2} value={form.address} onChange={e => set("address", e.target.value)} placeholder="12 Adeola Odeku Street, Victoria Island, Lagos" style={{ ...inp, resize: "none" }} onFocus={focus} onBlur={blur} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={handleSave} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium transition-all hover:opacity-90 disabled:opacity-60" style={{ background: "#1a2e1c", color: "#f7f5f0", fontSize: "0.875rem" }}>
            {saving ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><Save className="w-4 h-4" /> Save changes</>}
          </button>
          <button onClick={signOut} className="w-full py-3.5 rounded-xl font-medium transition-all hover:opacity-70" style={{ background: "#ede9e2", color: "#c0392b", fontSize: "0.875rem" }}>
            Sign out
          </button>
        </div>

        {/* Nigerian flag accent */}
        <div className="flex items-center justify-center gap-2 mt-8 opacity-30">
          <Leaf className="w-3.5 h-3.5" style={{ color: "#008751" }} />
          <span style={{ color: "#1a2e1c", fontSize: "0.72rem" }}>EcoWaste Uyo Building a Cleaner Environment</span>
        </div>
      </div>
    </div>
  );
}