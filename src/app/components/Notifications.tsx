import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Bell, CheckCheck, Leaf, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { supabase } from "../../../utils/supabase/client";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

interface Notification {
  id: string; title: string; message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean; created_at: string;
}

const TYPE_ICON = { success: CheckCircle2, info: Info, warning: AlertTriangle, error: AlertTriangle };
const TYPE_COLOR = { success: "#008751", info: "#3a6b3f", warning: "#856404", error: "#c0392b" };
const TYPE_BG    = { success: "#e8f0e4", info: "#e8f0e4", warning: "#fef3cd", error: "#fde8e8" };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setNotifs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
    setNotifs(n => n.map(x => ({ ...x, read: true })));
    toast.success("All notifications marked as read");
  };

  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  };

  const unread = notifs.filter(n => !n.read).length;

  return (
    <div className="min-h-svh" style={{ background: "#f7f5f0", fontFamily: "var(--font-body)" }}>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 mb-6 opacity-45 hover:opacity-75 transition-opacity" style={{ color: "#1a2e1c", fontSize: "0.78rem" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </button>

        <div className="flex items-end justify-between mb-7">
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "clamp(1.8rem,3vw,2.3rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Notifications
            </h1>
            <p style={{ color: "#5a6e5c", fontSize: "0.875rem", marginTop: "0.3rem" }}>
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors hover:opacity-80" style={{ background: "#1a2e1c", color: "#f7f5f0" }}>
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#008751] border-t-transparent animate-spin" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="rounded-2xl py-16 flex flex-col items-center" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#e8f0e4" }}>
              <Bell className="w-6 h-6" style={{ color: "#008751" }} />
            </div>
            <p style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 600 }}>No notifications yet</p>
            <p style={{ color: "#5a6e5c", fontSize: "0.82rem", marginTop: "0.3rem" }}>We'll notify you about your pickups here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifs.map(n => {
              const Icon = TYPE_ICON[n.type] ?? Info;
              return (
                <button key={n.id} onClick={() => !n.read && markOne(n.id)}
                  className="flex gap-4 p-5 rounded-2xl text-left transition-colors hover:shadow-sm"
                  style={{ background: n.read ? "#fff" : "#f0ece4", border: `1px solid ${n.read ? "rgba(26,46,28,0.08)" : "rgba(26,46,28,0.15)"}` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: TYPE_BG[n.type] }}>
                    <Icon className="w-4 h-4" style={{ color: TYPE_COLOR[n.type] }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p style={{ color: "#1a2e1c", fontWeight: n.read ? 400 : 600, fontSize: "0.875rem" }}>{n.title}</p>
                      <span style={{ color: "#5a6e5c", fontSize: "0.72rem", flexShrink: 0, marginTop: "2px" }}>{timeAgo(n.created_at)}</span>
                    </div>
                    <p style={{ color: "#5a6e5c", fontSize: "0.8rem", marginTop: "0.25rem", lineHeight: 1.55 }}>{n.message}</p>
                    {!n.read && <div className="mt-2 w-2 h-2 rounded-full" style={{ background: "#008751" }} />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
