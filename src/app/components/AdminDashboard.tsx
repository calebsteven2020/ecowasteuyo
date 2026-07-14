import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Leaf, LogOut, Trash2, CheckCircle, Clock, Users,
  TrendingUp, RefreshCw, X, Package, Search,
  BarChart3, ArrowUpRight, Filter, Download, Copy, Phone, MapPin, Calendar, Weight
} from "lucide-react";
import { supabase } from "../../../utils/supabase/client";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, PieChart, Pie, Cell } from "recharts";

interface Pickup {
  id: string; user_id: string; waste_type: string; address: string;
  pickup_date: string; pickup_time: string; status: string;
  source?: string;
  estimated_weight?: number; actual_weight?: number;
  notes?: string; photo_url?: string | null; price?: number | null; agent_name?: string | null; created_at: string;
  profiles?: { full_name: string | null; phone: string | null; };
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string; dot: string }> = {
  scheduled:    { bg: "#e8f0e4", color: "#2d5230",  label: "Scheduled",   dot: "#008751" },
  in_progress:  { bg: "#fff3cd", color: "#856404",  label: "In Progress", dot: "#f59e0b" },
  completed:    { bg: "#d4e8d5", color: "#1a2e1c",  label: "Completed",   dot: "#008751" },
  cancelled:    { bg: "#fde8e8", color: "#c0392b",  label: "Cancelled",   dot: "#c0392b" },
};

const WASTE_COLORS: Record<string, string> = {
  "General Waste": "#5a6e5c", "Recyclable Materials": "#008751",
  "Organic Waste": "#85c48a", "Electronic Waste": "#2d5230",
  "Hazardous Waste": "#c0392b", "Construction Debris": "#8b7355",
};

const PIE_COLORS = ["#008751", "#85c48a", "#2d5230", "#5a6e5c", "#c0392b", "#8b7355"];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function BulkCleanoutAgentAssign({ cleanout, agents, onAssigned }: { cleanout: any; agents: { id: string; name: string }[]; onAssigned: (id: string, agent: string, status: string) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const assign = async (agent: string) => {
    setSaving(true);
    const nextStatus = cleanout.status === "paid" ? "dispatched" : cleanout.status;
    const { error } = await supabase.from("bulk_cleanouts").update({ agent_name: agent, status: nextStatus }).eq("id", cleanout.id);
    if (!error) {
      await supabase.from("notifications").insert({
        user_id: cleanout.user_id,
        title: "Agent dispatched 🚛",
        message: `${agent} has been dispatched for your bulk clean-out at ${cleanout.address}.`,
        type: "info",
      });
      onAssigned(cleanout.id, agent, nextStatus);
    }
    setSaving(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors hover:opacity-80 flex items-center gap-1"
        style={{ background: cleanout.agent_name ? "#e8f0e4" : "#f0ece4", color: "#1a2e1c" }}
      >
        {saving ? "…" : cleanout.agent_name ? `👷 ${cleanout.agent_name}` : "Assign agent"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.1)", boxShadow: "0 8px 24px rgba(10,22,11,0.18)", minWidth: "160px" }}>
            {agents.length === 0 ? (
              <p className="px-3 py-2.5 text-xs" style={{ color: "#5a6e5c" }}>No agents yet.</p>
            ) : agents.map(a => (
              <button key={a.id} onClick={() => assign(a.name)} className="w-full text-left px-3 py-2.5 text-xs transition-colors hover:bg-[#f7f5f0]" style={{ color: "#1a2e1c" }}>
                {a.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AgentAssign({ pickup, onAssigned }: { pickup: Pickup; onAssigned: (id: string, agent: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(pickup.agent_name ?? "");
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => {
    supabase.from("agents").select("id, name").order("name").then(({ data, error }) => {
      if (error) console.error("AgentAssign fetch error:", error);
      setAgents(data ?? []);
      setLoadingAgents(false);
    });
  }, []);

  const locked = pickup.status === "in_progress" || pickup.status === "completed" || pickup.status === "cancelled";

  const assign = async (agent: string) => {
    if (locked) return;
    setSelected(agent);
    setSaving(true);
    const { error } = await supabase.from("pickups").update({ agent_name: agent }).eq("id", pickup.id);
    if (!error) {
      await supabase.from("notifications").insert({
        user_id: pickup.user_id,
        title: "Agent Assigned 🚛",
        message: `Your pickup has been assigned to ${agent}. They will arrive on ${pickup.pickup_date} during ${pickup.pickup_time}.`,
        type: "info",
      });
      onAssigned(pickup.id, agent);
    }
    setSaving(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(26,46,28,0.08)" }}>
      <div className="px-4 py-3" style={{ background: "#1a2e1c" }}>
        <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.65rem", letterSpacing: "0.08em", fontWeight: 600 }}>ASSIGN AGENT</p>
      </div>
      <div className="px-4 py-4">
        {selected && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "#e8f0e4" }}>
            <span style={{ fontSize: "1rem" }}>👷</span>
            <div className="flex-1">
              <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.82rem" }}>{selected}</p>
              <p style={{ color: "#5a6e5c", fontSize: "0.7rem" }}>
                {locked
                  ? pickup.status === "completed" ? "Pickup completed" : pickup.status === "cancelled" ? "Pickup cancelled" : "In progress"
                  : "Currently assigned"}
              </p>
            </div>
            {saving && <span className="w-4 h-4 rounded-full border-2 border-[#008751] border-t-transparent animate-spin flex-shrink-0" />}
            {locked && <span style={{ fontSize: "0.9rem" }}>🔒</span>}
          </div>
        )}

        {/* Only show agent picker when not locked and no agent assigned yet (or reassigning) */}
        {!locked && (
          loadingAgents ? (
            <p style={{ color: "#5a6e5c", fontSize: "0.78rem", marginTop: selected ? "0.75rem" : "0" }}>Loading agents…</p>
          ) : agents.length === 0 ? (
            <p style={{ color: "#5a6e5c", fontSize: "0.78rem", marginTop: selected ? "0.75rem" : "0" }}>No agents yet. Add agents in the Agents tab.</p>
          ) : (
            <div className={`grid grid-cols-2 gap-2 ${selected ? "mt-3" : ""}`}>
              {agents.map(agent => (
                <button key={agent.id} onClick={() => assign(agent.name)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-[#e8f0e4]"
                  style={{ background: selected === agent.name ? "#1a2e1c" : "#f7f5f0", border: `1px solid ${selected === agent.name ? "#1a2e1c" : "rgba(26,46,28,0.08)"}` }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: selected === agent.name ? "rgba(133,196,138,0.2)" : "#e8f0e4" }}>
                    <span style={{ fontSize: "0.75rem" }}>👷</span>
                  </div>
                  <span style={{ color: selected === agent.name ? "#f7f5f0" : "#1a2e1c", fontSize: "0.75rem", fontWeight: 500, lineHeight: 1.3 }}>{agent.name}</span>
                </button>
              ))}
            </div>
          )
        )}

        {/* No agent assigned and locked — only show if nothing is selected */}
        {locked && !selected && (
          <p style={{ color: "#9ba89a", fontSize: "0.78rem" }}>No agent was assigned.</p>
        )}
      </div>
    </div>
  );
}

function PickupDetailModal({ pickup, onClose, onComplete, onStart, onCancel, onAssigned }: {
  pickup: Pickup;
  onClose: () => void;
  onComplete: (p: Pickup) => void;
  onStart: (id: string) => void;
  onCancel: (id: string) => void;
  onAssigned: (id: string, agent: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const dotColor = WASTE_COLORS[pickup.waste_type] || "#008751";
  const statusStyle = STATUS_STYLES[pickup.status] || STATUS_STYLES.scheduled;
  const name = pickup.profiles?.full_name || "Unknown User";
  const phone = pickup.profiles?.phone || null;

  const copyPhone = () => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(10,22,11,0.6)" }}
      onClick={onClose}>
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: "#fff", boxShadow: "0 8px 24px rgba(10,22,11,0.25)", maxHeight: "92vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ borderBottom: "1px solid rgba(26,46,28,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${dotColor}18` }}>
              <Trash2 className="w-5 h-5" style={{ color: dotColor }} />
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "1rem" }}>
                {pickup.waste_type}
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium mt-0.5"
                style={{ background: statusStyle.bg, color: statusStyle.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }} />
                {statusStyle.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f0ece4] transition-colors flex-shrink-0">
            <X className="w-4 h-4" style={{ color: "#5a6e5c" }} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* User info */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(26,46,28,0.08)" }}>
            <div className="px-4 py-3" style={{ background: "#1a2e1c" }}>
              <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.65rem", letterSpacing: "0.08em", fontWeight: 600 }}>CUSTOMER</p>
            </div>
            <div className="px-4 py-4 flex flex-col gap-3">
              {/* Name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#e8f0e4" }}>
                  <span style={{ fontFamily: "var(--font-display)", color: "#008751", fontWeight: 700, fontSize: "0.9rem" }}>
                    {name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.95rem" }}>{name}</p>
                  <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>Registered user</p>
                </div>
              </div>

              {/* Phone — copyable */}
              {phone ? (
                <button onClick={copyPhone}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl transition-colors hover:bg-[#e8f0e4]"
                  style={{ background: "#f7f5f0", border: "1px solid rgba(26,46,28,0.08)" }}>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4" style={{ color: "#008751" }} />
                    <div className="text-left">
                      <p style={{ color: "#5a6e5c", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em" }}>PHONE NUMBER</p>
                      <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.02em" }}>{phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                    style={{ background: copied ? "#e8f0e4" : "#fff", border: "1px solid rgba(26,46,28,0.1)" }}>
                    <Copy className="w-3.5 h-3.5" style={{ color: copied ? "#008751" : "#5a6e5c" }} />
                    <span style={{ color: copied ? "#008751" : "#5a6e5c", fontSize: "0.72rem", fontWeight: 600 }}>
                      {copied ? "Copied!" : "Copy"}
                    </span>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "#fde8e8" }}>
                  <Phone className="w-4 h-4" style={{ color: "#c0392b" }} />
                  <p style={{ color: "#c0392b", fontSize: "0.82rem" }}>No phone number on file</p>
                </div>
              )}
            </div>
          </div>

          {/* Pickup details */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(26,46,28,0.08)" }}>
            <div className="px-4 py-3" style={{ background: "#1a2e1c" }}>
              <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.65rem", letterSpacing: "0.08em", fontWeight: 600 }}>PICKUP DETAILS</p>
            </div>
            <div className="px-4 py-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#008751" }} />
                <div>
                  <p style={{ color: "#5a6e5c", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em" }}>ADDRESS</p>
                  <p style={{ color: "#1a2e1c", fontSize: "0.875rem", fontWeight: 500, lineHeight: 1.5 }}>{pickup.address}</p>
                </div>
              </div>
              <div className="h-px" style={{ background: "rgba(26,46,28,0.06)" }} />
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "#008751" }} />
                <div>
                  <p style={{ color: "#5a6e5c", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em" }}>DATE & TIME</p>
                  <p style={{ color: "#1a2e1c", fontSize: "0.875rem", fontWeight: 500 }}>{pickup.pickup_date} · {pickup.pickup_time}</p>
                </div>
              </div>
              {(pickup.estimated_weight || pickup.actual_weight) && (
                <>
                  <div className="h-px" style={{ background: "rgba(26,46,28,0.06)" }} />
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 flex-shrink-0" style={{ color: "#008751" }} />
                    <div>
                      <p style={{ color: "#5a6e5c", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em" }}>WEIGHT</p>
                      <p style={{ color: "#1a2e1c", fontSize: "0.875rem", fontWeight: 500 }}>
                        {pickup.actual_weight ? `${pickup.actual_weight} kg collected` : `~${pickup.estimated_weight} kg estimated`}
                      </p>
                    </div>
                  </div>
                </>
              )}
              {pickup.notes && (
                <>
                  <div className="h-px" style={{ background: "rgba(26,46,28,0.06)" }} />
                  <div>
                    <p style={{ color: "#5a6e5c", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", marginBottom: "0.3rem" }}>NOTES</p>
                    <p style={{ color: "#1a2e1c", fontSize: "0.82rem", lineHeight: 1.6 }}>{pickup.notes}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Photo */}
          {pickup.photo_url && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(26,46,28,0.08)" }}>
              <div className="px-4 py-3" style={{ background: "#1a2e1c" }}>
                <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.65rem", letterSpacing: "0.08em", fontWeight: 600 }}>WASTE PHOTO</p>
              </div>
              <img src={pickup.photo_url} alt="Waste" className="w-full object-cover" style={{ maxHeight: "220px" }} />
            </div>
          )}

          {/* Price */}
          {pickup.price && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: "#e8f0e4", border: "1px solid rgba(0,135,81,0.15)" }}>
              <div>
                <p style={{ color: "#5a6e5c", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em" }}>AMOUNT DUE ON PICKUP</p>
                <p style={{ fontFamily: "var(--font-display)", color: "#008751", fontWeight: 800, fontSize: "1.3rem", marginTop: "0.1rem" }}>
                  {formatNaira(pickup.price)}
                </p>
              </div>
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: "#1a2e1c", color: "#85c48a" }}>
                Cash on pickup 💵
              </span>
            </div>
          )}

          {/* Directions link */}
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup.address + ", Nigeria")}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: "#1a2e1c", color: "#f7f5f0", textDecoration: "none" }}>
            📍 Get directions to this address
            <ArrowUpRight className="w-4 h-4 ml-auto" />
          </a>

          {/* Agent assignment */}
          <AgentAssign pickup={pickup} onAssigned={onAssigned} />

          {/* Booking reference */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "#f7f5f0" }}>
            <p style={{ color: "#5a6e5c", fontSize: "0.75rem" }}>Ref: <span style={{ color: "#1a2e1c", fontWeight: 600, fontFamily: "monospace" }}>{pickup.id.slice(0, 8).toUpperCase()}</span></p>
            <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>Booked {new Date(pickup.created_at).toLocaleDateString("en-NG")}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {/* For urgent pickups, require an agent before starting */}
            {pickup.source === "urgent" && !pickup.agent_name && pickup.status === "scheduled" && (
              <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "#fff3cd", border: "1px solid rgba(245,158,11,0.25)" }}>
                <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                <div>
                  <p style={{ color: "#856404", fontWeight: 600, fontSize: "0.82rem" }}>Assign an agent first</p>
                  <p style={{ color: "rgba(133,100,4,0.7)", fontSize: "0.72rem", marginTop: "0.1rem" }}>This urgent pickup cannot be started until a driver is assigned.</p>
                </div>
              </div>
            )}
            {pickup.status === "scheduled" && !(pickup.source === "urgent" && !pickup.agent_name) && (
              <button onClick={() => { onStart(pickup.id); onClose(); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors hover:opacity-80"
                style={{ background: "rgba(245,158,11,0.12)", color: "#856404", border: "1px solid rgba(245,158,11,0.2)" }}>
                Mark In Progress
              </button>
            )}
            {(pickup.status === "scheduled" || pickup.status === "in_progress") && !(pickup.source === "urgent" && !pickup.agent_name) && (
              <button onClick={() => { onComplete(pickup); onClose(); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors hover:opacity-90"
                style={{ background: "#008751", color: "#fff" }}>
                <CheckCircle className="w-3.5 h-3.5" /> Complete Pickup
              </button>
            )}
            {pickup.status === "scheduled" && (
              <button onClick={() => { onCancel(pickup.id); onClose(); }}
                className="px-4 py-2.5 rounded-xl text-xs font-medium transition-colors hover:opacity-80"
                style={{ background: "#fde8e8", color: "#c0392b" }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const formatNaira = (amount: number) => "₦" + amount.toLocaleString("en-NG");

function ConfirmModal({ pickup, onClose, onConfirm, loading }: {
  pickup: Pickup; onClose: () => void;
  onConfirm: (id: string, weight: number) => void; loading: boolean;
}) {
  const [weight, setWeight] = useState(pickup.estimated_weight?.toString() ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(10,22,11,0.6)" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "#fff", boxShadow: "0 8px 24px rgba(10,22,11,0.25)" }}>
        <div className="px-6 py-5" style={{ background: "#1a2e1c" }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.7rem", letterSpacing: "0.08em" }}>CONFIRM COLLECTION</p>
              <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 700, fontSize: "1rem", marginTop: "0.2rem" }}>{pickup.waste_type}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="rounded-xl p-4 mb-5" style={{ background: "#f7f5f0" }}>
            <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.85rem" }}>{pickup.profiles?.full_name || "User " + pickup.user_id.slice(0,6).toUpperCase()}</p>
            <p style={{ color: "#5a6e5c", fontSize: "0.78rem", marginTop: "0.2rem" }}>{pickup.address}</p>
            <p style={{ color: "#5a6e5c", fontSize: "0.78rem" }}>{pickup.pickup_date} · {pickup.pickup_time}</p>
          </div>
          <div className="flex flex-col gap-1.5 mb-5">
            <label style={{ color: "#1a2e1c", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em" }}>ACTUAL WEIGHT COLLECTED (kg)</label>
            <input type="number" min="0" step="0.1" placeholder="e.g. 12.5"
              value={weight} onChange={e => setWeight(e.target.value)}
              style={{ background: "#f0ece4", border: "1.5px solid transparent", borderRadius: "12px", color: "#1a2e1c", fontSize: "0.9rem", padding: "12px 16px", outline: "none", width: "100%", fontFamily: "var(--font-body)" }}
              onFocus={e => (e.target.style.borderColor = "#008751")}
              onBlur={e => (e.target.style.borderColor = "transparent")} />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f0ece4", color: "#5a6e5c" }}>Cancel</button>
            <button disabled={loading || !weight} onClick={() => onConfirm(pickup.id, parseFloat(weight))}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ background: "#008751", color: "#fff" }}>
              {loading ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Mark Complete</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentsManager({ pickups, subs }: { pickups: any[]; subs: any[] }) {
  const [agents, setAgents] = useState<{ id: string; name: string; phone: string; notes?: string | null; created_at: string }[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<"subscriptions" | "urgent" | null>(null);

  useEffect(() => {
    supabase.from("agents").select("*").order("name").then(({ data }) => setAgents(data ?? []));
  }, []);

  const addAgent = async () => {
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name) { toast.error("Enter the agent's name."); return; }
    setSaving(true);
    const { data, error } = await supabase.from("agents").insert({ name, phone: phone || null, notes: form.notes.trim() || null }).select().single();
    if (error) { toast.error("Could not save agent: " + error.message); setSaving(false); return; }
    setAgents(prev => [...prev, data]);
    setForm({ name: "", phone: "", notes: "" });
    toast.success(`${name} added to the roster.`);
    setSaving(false);
  };

  const removeAgent = async (id: string) => {
    setRemoving(id);
    await supabase.from("agents").delete().eq("id", id);
    setAgents(prev => prev.filter(a => a.id !== id));
    setRemoving(null);
    toast.success("Agent removed.");
  };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const isBasicDay = today === "Saturday";
  const isCommercialDay = today === "Wednesday" || today === "Friday";
  const isPickupDay = isBasicDay || isCommercialDay;

  // Subscription manifest — comes from the subscriptions table (active subscribers),
  // NOT from the pickups table. Subscription pickups are never individually inserted
  // into the pickups table — they're recurring based on plan type and day of week.
  // Filter by today's pickup day: Basic on Saturdays, Commercial on Wed & Friday.
  const activeSubscribers = subs.filter(s => s.status === "active" && s.manifest_status === "green");
  const todaysSubs = isBasicDay
    ? activeSubscribers.filter(s => s.plan_type === "basic")
    : isCommercialDay
      ? activeSubscribers.filter(s => s.plan_type === "commercial")
      : activeSubscribers; // non-pickup day → show all so admin can still print

  // Urgent manifest — these ARE individual rows in the pickups table
  const isUrgent = (p: any) => p.source === "urgent" || (!p.source && p.price === 8000);
  const scheduledUrgent = pickups.filter(p => p.status === "scheduled" && isUrgent(p));

  const PrintManifest = ({ items, title, isSubManifest }: { items: any[]; title: string; isSubManifest?: boolean }) => (
    <div className="fixed inset-0 z-50 bg-white overflow-auto p-8" id="print-area">
      <style>{`@media print { body * { visibility: hidden; } #print-area, #print-area * { visibility: visible; } #print-area { position: absolute; top: 0; left: 0; width: 100%; } .no-print { display: none !important; } }`}</style>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6 no-print">
          <button onClick={() => setPrintMode(null)} className="px-4 py-2 rounded-lg text-sm" style={{ background: "#f0ece4", color: "#1a2e1c" }}>← Back</button>
          <button onClick={() => window.print()} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "#0e1f0f", color: "#fff" }}>🖨️ Print</button>
        </div>
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0e1f0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 14 }}>🌿</span>
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: "1.1rem" }}>EcoWaste Uyo</p>
              <p style={{ fontSize: "0.75rem", color: "#666" }}>Collection Manifest</p>
            </div>
          </div>
          <p style={{ fontWeight: 700, fontSize: "1.2rem", marginTop: 12 }}>{title}</p>
          <p style={{ fontSize: "0.8rem", color: "#666" }}>Printed: {new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <p style={{ fontSize: "0.8rem", color: "#666" }}>Total stops: {items.length}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {items.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center", padding: "2rem" }}>
              {isSubManifest ? "No active subscribers for today's pickup day." : "No urgent pickups scheduled."}
            </p>
          ) : items.map((item, i) => {
            const customerName = item.profiles?.full_name ?? "Customer";
            const phone = item.profiles?.phone ?? null;
            const address = isSubManifest
              ? (item.profiles?.address ?? "Address not on file")
              : (item.address ?? "—");
            const detail = isSubManifest
              ? `${(item.plan_type ?? "basic").charAt(0).toUpperCase() + (item.plan_type ?? "basic").slice(1)} Plan · ${item.pickups_per_week ?? 1}x/week`
              : `${item.waste_type ?? "General Waste"}${item.pickup_time ? " · " + item.pickup_time : ""}`;
            return (
              <div key={item.id} style={{ padding: "12px 0", borderBottom: "1px solid #e5e5e5", display: "grid", gridTemplateColumns: "24px 1fr", gap: "12px", alignItems: "start" }}>
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#666", paddingTop: 2 }}>{i + 1}.</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{customerName}</p>
                  <p style={{ fontSize: "0.82rem", marginTop: 2 }}>{address}</p>
                  <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: "0.75rem", color: "#555", flexWrap: "wrap" }}>
                    {phone && <span>📞 {phone}</span>}
                    <span>{isSubManifest ? "📋" : "🗑️"} {detail}</span>
                    {!isSubManifest && <span style={{ color: "#c0392b", fontWeight: 700 }}>⚡ URGENT</span>}
                  </div>
                  {item.agent_name && <p style={{ fontSize: "0.72rem", color: "#008751", marginTop: 3, fontWeight: 600 }}>Assigned: {item.agent_name}</p>}
                  <div style={{ marginTop: 8, borderTop: "1px dashed #ccc", paddingTop: 6, display: "flex", gap: 24 }}>
                    <span style={{ fontSize: "0.72rem", color: "#888" }}>Bins collected: ☐</span>
                    <span style={{ fontSize: "0.72rem", color: "#888" }}>Signature: _______________</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: "2px solid black" }}>
          <p style={{ fontSize: "0.75rem", color: "#666" }}>Agent name: _________________________ &nbsp;&nbsp; Date: _____________</p>
        </div>
      </div>
    </div>
  );

  if (printMode) return <PrintManifest
    items={printMode === "subscriptions" ? todaysSubs : scheduledUrgent}
    title={printMode === "subscriptions"
      ? `Subscription Pickups — ${today}${isBasicDay ? " (Basic Plan)" : isCommercialDay ? " (Commercial Plan)" : " (All Plans)"}`
      : `Urgent Pickups — ${today}`}
    isSubManifest={printMode === "subscriptions"}
  />;

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1.1rem", fontWeight: 700 }}>Agent Roster</h2>
        <p style={{ color: "#9ba89a", fontSize: "0.78rem", marginTop: "0.2rem", lineHeight: 1.6 }}>
          Record your drivers and collectors here. Assign them to pickups for tracking purposes — no login account needed.
        </p>
      </div>

      {/* Print manifests */}
      <div className="rounded-2xl p-5" style={{ background: "#0e1f0f" }}>
        <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.65rem", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>PRINT PICKUP MANIFESTS</p>
        {isPickupDay ? (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl" style={{ background: "rgba(74,222,128,0.1)" }}>
            <span>📅</span>
            <p style={{ color: "#4ade80", fontSize: "0.75rem", fontWeight: 600 }}>
              Today is {today} — {isBasicDay ? "Basic plan pickup day" : "Commercial plan pickup day"}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl" style={{ background: "rgba(247,245,240,0.06)" }}>
            <span>ℹ️</span>
            <p style={{ color: "rgba(247,245,240,0.45)", fontSize: "0.72rem" }}>Basic pickups: Saturday · Commercial: Wednesday &amp; Friday</p>
          </div>
        )}
        <p style={{ color: "rgba(247,245,240,0.6)", fontSize: "0.75rem", lineHeight: 1.6, marginBottom: "1rem" }}>
          Print a hardcopy to hand to your drivers. Includes address, phone, waste type and a signature field.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setPrintMode("subscriptions")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-90" style={{ background: "#008751", color: "#fff", cursor: "pointer" }}>
              🖨️ Subscriptions ({todaysSubs.length})
            </button>
            <button onClick={() => setPrintMode("urgent")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-90" style={{ background: "#c0392b", color: "#fff", cursor: "pointer" }}>
              ⚡ Urgent ({scheduledUrgent.length})
            </button>
        </div>
      </div>

      {/* Add agent form */}
      <div className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
        <p style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 600, fontSize: "0.9rem", marginBottom: "1rem" }}>Add Agent</p>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label style={{ color: "#1a2e1c", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em" }}>FULL NAME *</label>
              <input placeholder="e.g. Emeka Okafor" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{ background: "#f0ece4", border: "1.5px solid transparent", borderRadius: "10px", color: "#1a2e1c", fontSize: "0.85rem", padding: "10px 14px", outline: "none" }}
                onFocus={e => (e.target.style.borderColor = "#008751")} onBlur={e => (e.target.style.borderColor = "transparent")} />
            </div>
            <div className="flex flex-col gap-1">
              <label style={{ color: "#1a2e1c", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em" }}>PHONE NUMBER</label>
              <input placeholder="+234 801 234 5678" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                style={{ background: "#f0ece4", border: "1.5px solid transparent", borderRadius: "10px", color: "#1a2e1c", fontSize: "0.85rem", padding: "10px 14px", outline: "none" }}
                onFocus={e => (e.target.style.borderColor = "#008751")} onBlur={e => (e.target.style.borderColor = "transparent")} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ color: "#1a2e1c", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em" }}>NOTES <span style={{ color: "#9ba89a", fontWeight: 400 }}>(optional)</span></label>
            <input placeholder="e.g. Truck driver, Zone B" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ background: "#f0ece4", border: "1.5px solid transparent", borderRadius: "10px", color: "#1a2e1c", fontSize: "0.85rem", padding: "10px 14px", outline: "none" }}
              onFocus={e => (e.target.style.borderColor = "#008751")} onBlur={e => (e.target.style.borderColor = "transparent")} />
          </div>
          <button onClick={addAgent} disabled={saving} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-90 disabled:opacity-60" style={{ background: "#0e1f0f", color: "#fff" }}>
            {saving ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "+ Add to roster"}
          </button>
        </div>
      </div>

      {/* Roster list */}
      <div>
        <p style={{ color: "#9ba89a", fontSize: "0.72rem", fontWeight: 600, marginBottom: "0.6rem", letterSpacing: "0.04em" }}>
          {agents.length} {agents.length === 1 ? "AGENT" : "AGENTS"} ON ROSTER
        </p>
        {agents.length === 0 ? (
          <div className="rounded-2xl py-10 flex flex-col items-center text-center px-6" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
            <span style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👷</span>
            <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.875rem" }}>No agents yet</p>
            <p style={{ color: "#9ba89a", fontSize: "0.78rem", marginTop: "0.25rem" }}>Add your first driver or collector above.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
            {agents.map((agent, i) => (
              <div key={agent.id} className="flex items-center gap-3 px-5 py-4 transition-colors"
                style={{ borderBottom: i < agents.length - 1 ? "1px solid rgba(26,46,28,0.06)" : "none", opacity: removing === agent.id ? 0.4 : 1 }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#e8f0e4" }}>
                  <span style={{ color: "#008751", fontWeight: 700, fontSize: "1rem", fontFamily: "var(--font-display)" }}>
                    {(agent.name ?? "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.875rem" }}>{agent.name}</p>
                  <div className="flex items-center gap-3">
                    {agent.phone && <p style={{ color: "#9ba89a", fontSize: "0.72rem" }}>{agent.phone}</p>}
                    {agent.notes && <p style={{ color: "#9ba89a", fontSize: "0.72rem" }}>· {agent.notes}</p>}
                  </div>
                </div>
                <button onClick={() => removeAgent(agent.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80" style={{ background: "#fde8e8", color: "#c0392b" }}>
                  <X className="w-3 h-3" /> Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiptViewerModal({ payment, onClose, onApprove, onReject }: { payment: any; onClose: () => void; onApprove: () => void; onReject: () => void }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const decided = payment.status !== "pending";

  const handle = async (action: "approve" | "reject") => {
    setBusy(action);
    if (action === "approve") await onApprove(); else await onReject();
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0" style={{ background: "rgba(10,22,11,0.65)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "#fff" }}>
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: "#1a2e1c" }}>
          <div>
            <p style={{ color: "rgba(247,245,240,0.5)", fontSize: "0.65rem", letterSpacing: "0.08em" }}>BANK TRANSFER RECEIPT</p>
            <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 700, fontSize: "1rem", marginTop: "0.2rem" }}>
              {payment.profiles?.full_name ?? "Unknown"}
            </p>
            <p style={{ color: "rgba(247,245,240,0.45)", fontSize: "0.75rem", marginTop: "0.1rem" }}>{payment.profiles?.phone ?? "No phone on file"}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: "rgba(247,245,240,0.6)" }} /></button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {payment.receipt_url ? (
            <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
              <img src={payment.receipt_url} alt="Receipt" className="w-full max-h-72 object-contain rounded-xl" style={{ background: "#f0ece4" }} />
            </a>
          ) : (
            <div className="w-full h-32 rounded-xl flex items-center justify-center" style={{ background: "#f0ece4" }}>
              <span style={{ color: "#5a6e5c", fontSize: "0.8rem" }}>No receipt image</span>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "#e8f0e4" }}>
            <span style={{ color: "#5a6e5c", fontSize: "0.78rem" }}>Amount claimed</span>
            <span style={{ fontFamily: "var(--font-display)", color: "#008751", fontWeight: 800, fontSize: "1.1rem" }}>
              ₦{Number(payment.amount).toLocaleString("en-NG")}
            </span>
          </div>

          {payment.korapay_reference && (
            <div className="flex items-center justify-between text-xs" style={{ color: "#5a6e5c" }}>
              <span>Reference given</span>
              <span style={{ color: "#1a2e1c", fontWeight: 600 }}>{payment.korapay_reference}</span>
            </div>
          )}

          {decided ? (
            <div className="px-4 py-3 rounded-xl text-center text-sm font-semibold"
              style={{ background: payment.status === "success" ? "#d4e8d5" : "#fde8e8", color: payment.status === "success" ? "#1a2e1c" : "#c0392b" }}>
              {payment.status === "success" ? "✅ Confirmed" : "❌ Rejected"}
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => handle("reject")} disabled={busy !== null}
                className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-60" style={{ background: "#f0ece4", color: "#c0392b" }}>
                {busy === "reject" ? "…" : "Reject"}
              </button>
              <button onClick={() => handle("approve")} disabled={busy !== null}
                className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-60" style={{ background: "#008751", color: "#fff" }}>
                {busy === "approve" ? "…" : "Approve & activate"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SubscriptionDetailModal({ sub, onClose }: { sub: any; onClose: () => void; onSaved: (updated: any) => void }) {
  const name    = sub.profiles?.full_name ?? "Unknown";
  const email   = sub.profiles?.email ?? null;
  const phone   = sub.profiles?.phone ?? null;
  const address = sub.profiles?.address ?? null;
  const isActive = sub.manifest_status === "green";

  const rows = [
    { label: "Email",           value: email },
    { label: "Phone",           value: phone },
    { label: "Address",         value: address },
    { label: "Plan",            value: sub.plan_type ? sub.plan_type.charAt(0).toUpperCase() + sub.plan_type.slice(1) + " Plan" : null },
    { label: "Pickups / week",  value: sub.pickups_per_week ? `${sub.pickups_per_week}x per week` : null },
    { label: "Monthly rate",    value: sub.price ? "₦" + Number(sub.price).toLocaleString("en-NG") + " / month" : null },
    { label: "Last payment",    value: sub.last_payment_date ?? null },
    { label: "Next billing",    value: sub.next_billing_date ?? null },
    { label: "Payment method",  value: sub.payment_method ? sub.payment_method.replace("_", " ") : null },
  ].filter(r => r.value);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: "rgba(10,22,11,0.6)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "#fff", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: "#0e1f0f" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-base"
              style={{ background: isActive ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)", color: isActive ? "#4ade80" : "#f87171", fontFamily: "var(--font-display)" }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-display)", color: "#f7f5f0", fontWeight: 700, fontSize: "1rem" }}>{name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: isActive ? "#4ade80" : "#f87171" }} />
                <p style={{ color: "rgba(247,245,240,0.45)", fontSize: "0.7rem" }}>
                  {isActive ? "Active subscriber" : "Payment overdue"}
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: "rgba(247,245,240,0.08)" }}>
            <X className="w-4 h-4" style={{ color: "rgba(247,245,240,0.5)" }} />
          </button>
        </div>

        {/* Detail rows */}
        <div className="px-6 py-5 flex flex-col gap-0">
          {rows.map((row, i) => (
            <div key={row.label} className="flex items-start justify-between py-3 gap-4"
              style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(26,46,28,0.07)" : "none" }}>
              <span style={{ color: "#9ba89a", fontSize: "0.75rem", flexShrink: 0, minWidth: "100px" }}>{row.label}</span>
              <span style={{ color: "#1a2e1c", fontSize: "0.82rem", fontWeight: 500, textAlign: "right", textTransform: row.label === "Payment method" ? "capitalize" : "none" as any }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Subscription status banner */}
        {!isActive && (
          <div className="mx-6 mb-4 px-4 py-3 rounded-xl" style={{ background: "#fde8e8" }}>
            <p style={{ color: "#c0392b", fontWeight: 600, fontSize: "0.78rem" }}>🔴 House is RED on driver manifest</p>
            <p style={{ color: "rgba(192,57,43,0.75)", fontSize: "0.72rem", marginTop: "0.2rem", lineHeight: 1.5 }}>
              Payment overdue. Approve a transfer receipt from the Payments section to restore their service.
            </p>
          </div>
        )}

        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-medium" style={{ background: "#f0ece4", color: "#1a2e1c" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<Pickup | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"route" | "pickups" | "analytics" | "agents" | "billing">("billing");
  const [viewPickup, setViewPickup] = useState<Pickup | null>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [cleanouts, setCleanouts] = useState<any[]>([]);
  const [quoting, setQuoting] = useState<any | null>(null);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [viewSub, setViewSub] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [viewReceipt, setViewReceipt] = useState<any | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [urgentPickups, setUrgentPickups] = useState<any[]>([]);
  const [billingSection, setBillingSection] = useState<"subs"|"payments"|"urgent"|"cleanouts"|"referrals">("subs");
  const [referrals, setReferrals] = useState<any[]>([]);
  const [billingSearch, setBillingSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all"|"success"|"pending"|"rejected">("all");
  const [cleanoutAgents, setCleanoutAgents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("agents").select("id, name").order("name").then(({ data }) => setCleanoutAgents(data ?? []));
  }, []);

  const fetchBilling = async () => {
    // Self-healing: flip any subscription whose billing date has passed
    // unpaid to past_due/red, in case the daily cron hasn't run yet.
    // Wrapped in try/catch so a missing function (if schema.sql hasn't been
    // re-run yet to create flag_overdue_subscriptions) doesn't abort the
    // entire fetch — we still want the subscription list to load.
    try {
      const { error: rpcErr } = await supabase.rpc("flag_overdue_subscriptions");
      if (rpcErr) console.warn("[fetchBilling] flag_overdue_subscriptions:", rpcErr.message);
    } catch (e) {
      console.warn("[fetchBilling] flag_overdue_subscriptions not available:", e);
    }

    const [{ data: subsData, error: subsErr }, { data: cleanoutData, error: cleanoutErr }, { data: paymentsData, error: paymentsErr }, { data: urgentData }] = await Promise.all([
      supabase.from("subscriptions").select("*").neq("status", "cancelled"),
      supabase.from("bulk_cleanouts").select("*").order("created_at", { ascending: false }),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("pickups").select("*").eq("source", "urgent").order("created_at", { ascending: false }),
    ]);

    if (subsErr) { console.error("[fetchBilling] subscriptions:", subsErr); toast.error("Couldn't load subscriptions: " + subsErr.message); }
    if (cleanoutErr) { console.error("[fetchBilling] bulk_cleanouts:", cleanoutErr); toast.error("Couldn't load clean-outs: " + cleanoutErr.message); }
    if (paymentsErr) { console.error("[fetchBilling] payments:", paymentsErr); toast.error("Couldn't load payments: " + paymentsErr.message); }

    const userIds = [...new Set([...(subsData ?? []), ...(cleanoutData ?? []), ...(paymentsData ?? []), ...(urgentData ?? [])].map((r: any) => r.user_id))];
    let profilesMap: Record<string, { full_name: string | null; phone: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesErr } = await supabase.from("profiles").select("id, full_name, phone, address, email").in("id", userIds);
      if (profilesErr) console.error("[fetchBilling] profiles:", profilesErr);
      profilesMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, { full_name: p.full_name, phone: p.phone, address: p.address, email: p.email }]));
    }
    const withProfile = (r: any) => ({ ...r, profiles: profilesMap[r.user_id] ?? { full_name: null, phone: null } });

    setSubs((subsData ?? []).map(withProfile));
    setCleanouts((cleanoutData ?? []).map(withProfile));
    setPayments((paymentsData ?? []).map(withProfile));
    setUrgentPickups((urgentData ?? []).map(withProfile));

    const { data: referralsData, error: referralsErr } = await supabase
      .from("referrals")
      .select("id, status, created_at, reward_applied_at, referrer:profiles!referrer_id(full_name, email), referred:profiles!referred_id(full_name, email)")
      .order("created_at", { ascending: false });
    if (referralsErr) console.error("[fetchBilling] referrals:", referralsErr);
    setReferrals(referralsData ?? []);

    setBillingLoading(false);
  };

  // Admin confirms a manual bank transfer after checking the uploaded receipt
  const approvePayment = async (payment: any) => {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    const todayDate = new Date();
    const today = todayDate.toISOString().split("T")[0];
    // Push the next billing date a month out from *today* (the approval date),
    // not from whenever the subscription row was first created — otherwise a
    // bank transfer approved after the original due date would activate the
    // house GREEN only for the auto-expire job to immediately flip it back to
    // RED on its next run, since next_billing_date would already be in the past.
    const nextBillingDate = new Date(todayDate);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    const nextBilling = nextBillingDate.toISOString().split("T")[0];

    const { error: paymentErr } = await supabase.from("payments").update({
      status: "success", verified_by: adminUser?.id ?? null, verified_at: new Date().toISOString(),
    }).eq("id", payment.id);
    if (paymentErr) console.error("[approvePayment] payments update failed:", paymentErr);

    if (payment.subscription_id) {
      const { error: subErr } = await supabase.from("subscriptions").update({
        status: "active", manifest_status: "green", last_payment_date: today, next_billing_date: nextBilling,
      }).eq("id", payment.subscription_id);
      if (subErr) {
        console.error("[approvePayment] subscriptions update failed:", subErr);
        toast.error(`Payment marked confirmed, but activating the subscription failed (${subErr.message}). Check admin write access on the subscriptions table.`);
      } else {
        setSubs(prev => prev.map(s => s.id === payment.subscription_id ? { ...s, status: "active", manifest_status: "green", last_payment_date: today, next_billing_date: nextBilling } : s));
      }
    }

    await supabase.from("notifications").insert({
      user_id: payment.user_id,
      title: "Payment confirmed ✅",
      message: `Your bank transfer of ₦${Number(payment.amount).toLocaleString("en-NG")} has been verified. Your house is GREEN and back on the route.`,
      type: "success",
    });

    setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, status: "success" } : p));
    setViewReceipt(null);
    toast.success("Payment approved — subscriber is GREEN again.");
  };

  const rejectPayment = async (payment: any) => {
    await supabase.from("payments").update({ status: "rejected" }).eq("id", payment.id);
    await supabase.from("notifications").insert({
      user_id: payment.user_id,
      title: "Receipt could not be verified ⚠️",
      message: "We couldn't confirm your bank transfer from the receipt provided. Please re-upload a clearer photo or contact support.",
      type: "warning",
    });
    setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, status: "rejected" } : p));
    setViewReceipt(null);
    toast.success("Payment rejected — customer notified.");
  };

  const sendQuote = async (cleanout: any) => {
    const amount = parseFloat(quoteAmount);
    if (!amount) { toast.error("Enter a quote amount."); return; }
    await supabase.from("bulk_cleanouts").update({ status: "quoted", quote_amount: amount }).eq("id", cleanout.id);
    await supabase.from("notifications").insert({
      user_id: cleanout.user_id,
      title: "Your clean-out quote is ready 💰",
      message: `We've reviewed your request at ${cleanout.address}. Quote: ${"₦" + amount.toLocaleString("en-NG")}. Pay to confirm dispatch.`,
      type: "info",
    });
    setCleanouts(prev => prev.map(c => c.id === cleanout.id ? { ...c, status: "quoted", quote_amount: amount } : c));
    setQuoting(null);
    setQuoteAmount("");
    toast.success("Quote sent to customer.");
  };

  const fetchPickups = async () => {
    try {
      // Step 1: wait for session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // Step 2: verify admin by email (is_admin checked via RLS)
      if (session.user.email !== "admin@admin.com") {
        setLoading(false);
        return;
      }

      // Step 3: fetch pickups
      const { data: pickupsData, error: pickupsError } = await supabase
        .from("pickups")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("Pickups fetched:", pickupsData?.length, pickupsError);
      if (pickupsError) { console.error("Pickups error:", pickupsError); setLoading(false); return; }

      // Step 3: fetch profiles separately to avoid join RLS issues
      const userIds = [...new Set((pickupsData ?? []).map(p => p.user_id))];
      let profilesMap: Record<string, { full_name: string | null; phone: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, phone, address, email")
          .in("id", userIds);

        console.log("Profiles fetched:", profilesData?.length, profilesError);
        if (profilesData) {
          profilesMap = Object.fromEntries(profilesData.map(p => [p.id, { full_name: p.full_name, phone: p.phone }]));
        }
      }

      // Step 4: merge
      const merged = (pickupsData ?? []).map(p => ({
        ...p,
        profiles: profilesMap[p.user_id] ?? { full_name: null, phone: null },
      }));

      setPickups(merged);
    } catch (err) {
      console.error("fetchPickups error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Wait for Supabase to restore session from storage, then fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchPickups();
        fetchBilling();
      } else {
        // Session not ready yet — wait for it
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            fetchPickups();
            fetchBilling();
            subscription.unsubscribe();
          }
        });
      }
    });
  }, []);

  const handleRefresh = () => { setRefreshing(true); fetchPickups(); };

  const handleConfirm = async (id: string, weight: number) => {
    setConfirming(true);
    const { error } = await supabase.from("pickups").update({ status: "completed", actual_weight: weight }).eq("id", id);
    if (!error) {
      const pickup = pickups.find(p => p.id === id);
      if (pickup) {
        await supabase.from("recycling_records").insert({ user_id: pickup.user_id, pickup_id: id, material_type: pickup.waste_type, weight_kg: weight });
        await supabase.from("notifications").insert({ user_id: pickup.user_id, title: "Pickup Completed ✅", message: `Your ${pickup.waste_type} pickup on ${pickup.pickup_date} has been completed. ${weight}kg collected — great work for the environment!`, type: "success" });
      }
      setPickups(prev => prev.map(p => p.id === id ? { ...p, status: "completed", actual_weight: weight } : p));
    }
    setConfirming(false);
    setSelected(null);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await supabase.from("pickups").update({ status }).eq("id", id);
    setPickups(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const handleAgentAssigned = (id: string, agent: string) => {
    setPickups(prev => prev.map(p => p.id === id ? { ...p, agent_name: agent } : p));
  };

  const handleSignOut = async () => { await signOut(); navigate("/login"); };

  const exportCSV = () => {
    const headers = ["Reference", "User", "Phone", "Waste Type", "Address", "Date", "Time", "Status", "Assigned Agent", "Est. Weight (kg)", "Actual Weight (kg)", "Booked On"];
    const rows = pickups.map(p => [
      p.id.slice(0, 8).toUpperCase(),
      p.profiles?.full_name ?? "Unknown",
      p.profiles?.phone ?? "",
      p.waste_type,
      p.address,
      p.pickup_date,
      p.pickup_time,
      p.status,
      p.agent_name ?? "Unassigned",
      p.estimated_weight ?? "",
      p.actual_weight ?? "",
      new Date(p.created_at).toLocaleDateString("en-NG"),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecowaste-pickups-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derived data
  const scheduled = pickups.filter(p => p.status === "scheduled").length;
  const inProgress = pickups.filter(p => p.status === "in_progress").length;
  const completed = pickups.filter(p => p.status === "completed").length;
  const cancelled = pickups.filter(p => p.status === "cancelled").length;
  const totalUsers = new Set(pickups.map(p => p.user_id)).size;
  const totalWeight = pickups.reduce((s, p) => s + (p.actual_weight ?? p.estimated_weight ?? 0), 0);
  const completionRate = pickups.length > 0 ? Math.round((completed / pickups.length) * 100) : 0;

  // Analytics data
  const monthlyData = MONTHS.map((month, idx) => ({
    month, pickups: pickups.filter(p => new Date(p.created_at).getMonth() === idx).length,
    completed: pickups.filter(p => new Date(p.created_at).getMonth() === idx && p.status === "completed").length,
  }));

  const wasteTypeData = Object.entries(
    pickups.reduce((acc, p) => { acc[p.waste_type] = (acc[p.waste_type] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Filtered pickups
  const filtered = pickups.filter(p => {
    const matchStatus = filter === "all" || p.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || p.waste_type.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || (p.profiles?.full_name ?? "").toLowerCase().includes(q) || (p.profiles?.phone ?? "").includes(q) || p.pickup_date.includes(q);
    return matchStatus && matchSearch;
  });

  const stats = [
    { label: "Total Bookings", value: pickups.length, sub: "all time", icon: Package, bg: "#e8f0e4", ic: "#008751", trend: "+12%" },
    { label: "Scheduled", value: scheduled, sub: "awaiting pickup", icon: Clock, bg: "#fff3cd", ic: "#856404", trend: null },
    { label: "In Progress", value: inProgress, sub: "being collected", icon: TrendingUp, bg: "#dce8dd", ic: "#2d5230", trend: null },
    { label: "Completed", value: completed, sub: `${completionRate}% rate`, icon: CheckCircle, bg: "#d4e8d5", ic: "#1a2e1c", trend: `${completionRate}%` },
    { label: "Total Users", value: totalUsers, sub: "registered", icon: Users, bg: "#f0ece4", ic: "#5a6e5c", trend: null },
    { label: "Waste Collected", value: `${totalWeight.toFixed(0)} kg`, sub: "total weight", icon: BarChart3, bg: "#e8f0e4", ic: "#008751", trend: null },
  ];

  // Subscription / billing analytics — the "Core Engine"
  const activeSubs = subs.filter(s => s.status === "active");
  const pastDueSubs = subs.filter(s => s.status === "past_due");
  const mrr = activeSubs.reduce((sum, s) => sum + (s.price ?? 0), 0);
  const pendingDebts = pastDueSubs.reduce((sum, s) => sum + (s.price ?? 0), 0);
  const basicCount = activeSubs.filter(s => s.plan_type === "basic").length;
  const commercialCount = activeSubs.filter(s => s.plan_type === "commercial").length;

  if (loading) return (
    <div className="min-h-svh flex items-center justify-center" style={{ background: "#f7f5f0" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#008751] border-t-transparent animate-spin" />
        <p style={{ color: "rgba(133,196,138,0.6)", fontSize: "0.82rem" }}>Loading admin dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-svh" style={{ background: "#f7f5f0", fontFamily: "var(--font-body)", animation: "fadeIn 0.3s ease" }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Nigerian flag strip */}
      <div className="fixed top-0 left-0 right-0 h-0.5 flex z-50">
        <div className="flex-1" style={{ background: "#008751" }} />
        <div className="flex-1" style={{ background: "#ffffff" }} />
        <div className="flex-1" style={{ background: "#008751" }} />
      </div>

      {/* Top bar */}
      <div className="sticky top-0.5 z-40" style={{ background: "#fff", borderBottom: "1px solid rgba(26,46,28,0.09)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">

          {/* Brand + actions */}
          <div className="flex items-center justify-between py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#0e1f0f" }}>
                <Leaf className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <span style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 800, fontSize: "0.9rem" }}>EcoWaste</span>
                <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#e8f0e4", color: "#2d5230", letterSpacing: "0.05em" }}>ADMIN</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[#f0ece4]" style={{ color: "#5a6e5c", border: "1px solid rgba(26,46,28,0.1)" }}>
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button onClick={handleRefresh} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[#f0ece4]">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} style={{ color: "#5a6e5c" }} />
              </button>
              <button onClick={handleSignOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[#f0ece4]" style={{ color: "#5a6e5c", border: "1px solid rgba(26,46,28,0.1)" }}>
                <LogOut className="w-3 h-3" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>

          {/* Tab nav — scrollable on mobile */}
          <div className="flex gap-0 -mb-px overflow-x-auto scrollbar-hide" style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}>
            {[
              { key: "route", label: "Today's Route" },
              { key: "billing", label: "Subscriptions" },
              { key: "pickups", label: "Urgent Pickups" },
              { key: "analytics", label: "Analytics" },
              { key: "agents", label: "Agents" },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className="px-4 py-3 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors border-b-2"
                style={{
                  color: activeTab === tab.key ? "#1a2e1c" : "#9ba89a",
                  borderBottomColor: activeTab === tab.key ? "#008751" : "transparent",
                  background: "transparent",
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5 sm:py-6">

        {(() => {
          // ── Today's Route: everything actually happening today, one list ──
          const todayLong = new Date().toLocaleDateString("en-US", { weekday: "long" });
          const isBasicDay = todayLong === "Saturday";
          const isCommercialDay = todayLong === "Wednesday" || todayLong === "Friday";
          const todayShort = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

          const activeSubscribers = subs.filter(s => s.status === "active" && s.manifest_status === "green");
          const routeSubs = isBasicDay
            ? activeSubscribers.filter(s => s.plan_type === "basic")
            : isCommercialDay
              ? activeSubscribers.filter(s => s.plan_type === "commercial")
              : [];
          const routeUrgent = urgentPickups.filter(p => p.pickup_date === todayShort && (p.status === "scheduled" || p.status === "in_progress"));
          const routeCleanouts = cleanouts.filter(c => c.status === "dispatched");

          const routeItems = [
            ...routeSubs.map(s => ({
              id: s.id, kind: "sub" as const,
              name: s.profiles?.full_name ?? "Customer",
              address: s.profiles?.address ?? "No address on file",
              phone: s.profiles?.phone ?? null,
              detail: `${s.plan_type === "basic" ? "Basic" : "Commercial"} Plan pickup`,
              agent: null as string | null,
            })),
            ...routeUrgent.map(p => ({
              id: p.id, kind: "urgent" as const,
              name: p.profiles?.full_name ?? "Customer",
              address: p.address ?? "No address on file",
              phone: p.profiles?.phone ?? null,
              detail: `Urgent · ${p.waste_type ?? "General Waste"}${p.pickup_time ? " · " + p.pickup_time : ""}`,
              agent: p.agent_name ?? null,
            })),
            ...routeCleanouts.map(c => ({
              id: c.id, kind: "cleanout" as const,
              name: c.profiles?.full_name ?? "Customer",
              address: c.address ?? "No address on file",
              phone: c.profiles?.phone ?? null,
              detail: `Bulk clean-out · ${c.quote_amount ? "₦" + c.quote_amount.toLocaleString("en-NG") : ""}`,
              agent: c.agent_name ?? null,
            })),
          ].sort((a, b) => a.address.localeCompare(b.address));

          const kindMeta: Record<string, { icon: string; label: string; color: string }> = {
            sub: { icon: "📋", label: "Subscription", color: "#008751" },
            urgent: { icon: "⚡", label: "Urgent", color: "#c0392b" },
            cleanout: { icon: "📦", label: "Clean-out", color: "#92400e" },
          };

        return (<>
        {/* Minimal section header — changes per tab */}
        <div className="mb-6">
          <h1 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1.25rem", fontWeight: 700 }}>
            {activeTab === "route" ? "Today's Route" : activeTab === "billing" ? "Subscribers" : activeTab === "pickups" ? "Urgent Pickups" : activeTab === "analytics" ? "Analytics" : "Agents"}
          </h1>
          <p style={{ color: "#9ba89a", fontSize: "0.75rem", marginTop: "0.15rem" }}>
            {activeTab === "route" ? `${todayLong} · ${routeItems.length} stops (${routeSubs.length} subscription, ${routeUrgent.length} urgent, ${routeCleanouts.length} clean-out)` :
             activeTab === "billing" ? `${subs.length} subscribers · ${pastDueSubs.length} past due` :
             activeTab === "pickups" ? `${pickups.length} total · ${pickups.filter(p => p.status === "scheduled").length} scheduled` :
             activeTab === "analytics" ? "Platform performance overview" :
             "Manage driver and collector accounts"}
          </p>
        </div>

        {/* TODAY'S ROUTE TAB */}
        {activeTab === "route" && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
            {routeItems.length === 0 ? (
              <p className="px-5 py-10 text-center" style={{ color: "#9ba89a", fontSize: "0.85rem" }}>
                {isBasicDay || isCommercialDay ? "No stops scheduled for today yet." : "No subscription pickups scheduled today — check Urgent Pickups and Clean-outs tabs for anything else."}
              </p>
            ) : routeItems.map((item, i) => {
              const meta = kindMeta[item.kind];
              return (
                <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: i < routeItems.length - 1 ? "1px solid rgba(26,46,28,0.06)" : "none" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#f7f5f0" }}>
                    <span style={{ fontSize: "0.95rem" }}>{meta.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p style={{ color: "#1a2e1c", fontWeight: 500, fontSize: "0.82rem" }}>{item.name}</p>
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, color: meta.color, background: `${meta.color}14`, padding: "1px 7px", borderRadius: "9999px" }}>{meta.label}</span>
                    </div>
                    <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }} className="truncate">{item.address}</p>
                    <p style={{ color: "#9ba89a", fontSize: "0.68rem", marginTop: "0.1rem" }}>{item.detail}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {item.phone && <p style={{ color: "#5a6e5c", fontSize: "0.7rem" }}>📞 {item.phone}</p>}
                    {item.agent ? (
                      <p style={{ color: "#008751", fontSize: "0.7rem", fontWeight: 600, marginTop: "0.15rem" }}>👷 {item.agent}</p>
                    ) : item.kind !== "sub" ? (
                      <p style={{ color: "#c0392b", fontSize: "0.68rem", fontWeight: 600, marginTop: "0.15rem" }}>Unassigned</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>);
        })()}

        {/* PICKUPS TAB */}
        {activeTab === "pickups" && (
          <>
            {/* Search + Filter bar */}
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#5a6e5c" }} />
                <input
                  placeholder="Search by name, waste type, address, date..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.12)", borderRadius: "12px", color: "#1a2e1c", fontSize: "0.85rem", padding: "11px 14px 11px 38px", width: "100%", outline: "none", fontFamily: "var(--font-body)" }}
                  onFocus={e => (e.target.style.borderColor = "#008751")}
                  onBlur={e => (e.target.style.borderColor = "rgba(26,46,28,0.12)")} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#5a6e5c" }} />
                {["all", "scheduled", "in_progress", "completed", "cancelled"].map(f => {
                  const labels: Record<string, string> = { all: "All", scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" };
                  const count = f === "all" ? pickups.length : pickups.filter(p => p.status === f).length;
                  return (
                    <button key={f} onClick={() => setFilter(f)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 transition-colors"
                      style={{ background: filter === f ? "#1a2e1c" : "#fff", color: filter === f ? "#fff" : "#5a6e5c", border: `1px solid ${filter === f ? "#1a2e1c" : "rgba(26,46,28,0.1)"}` }}>
                      {labels[f]}
                      <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                        style={{ background: filter === f ? "rgba(255,255,255,0.2)" : "rgba(133,196,138,0.1)" }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pickups list */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(26,46,28,0.07)" }}>
                <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "0.95rem", fontWeight: 600 }}>
                  {filter === "all" ? "All Pickups" : STATUS_STYLES[filter]?.label ?? filter}
                  <span className="ml-2 text-sm font-normal" style={{ color: "#5a6e5c" }}>({filtered.length})</span>
                </h2>
                <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>Click any row to view details</p>
              </div>

              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(133,196,138,0.1)" }}>
                    <Trash2 className="w-5 h-5" style={{ color: "rgba(133,196,138,0.4)" }} />
                  </div>
                  <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.9rem" }}>No pickups found</p>
                  <p style={{ color: "#5a6e5c", fontSize: "0.78rem", marginTop: "0.3rem" }}>
                    {search ? "Try a different search term." : "Nothing in this category yet."}
                  </p>
                </div>
              ) : (
                filtered.map((pickup, i) => {
                  const dotColor = WASTE_COLORS[pickup.waste_type] || "#008751";
                  const statusStyle = STATUS_STYLES[pickup.status] || STATUS_STYLES.scheduled;
                  return (
                    <div key={pickup.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-4 transition-colors hover:bg-[#f7f5f0] cursor-pointer"
                      style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(26,46,28,0.06)" : "none" }}
                      onClick={() => setViewPickup(pickup)}>

                      {/* Photo or icon */}
                      <div className="flex-shrink-0">
                        {pickup.photo_url ? (
                          <div className="w-10 h-10 rounded-xl overflow-hidden border-2"
                            style={{ borderColor: "rgba(0,135,81,0.3)" }}>
                            <img src={pickup.photo_url} alt="waste" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: `${dotColor}22` }}>
                            <Trash2 className="w-4 h-4" style={{ color: dotColor }} />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.875rem" }}>{pickup.waste_type}</p>
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                            style={{ background: statusStyle.bg + "22", color: statusStyle.dot, border: `1px solid ${statusStyle.dot}33` }}>
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: statusStyle.dot }} />
                            {statusStyle.label}
                          </span>
                          {pickup.photo_url && <span style={{ color: "#85c48a", fontSize: "0.7rem" }}>📷</span>}
                        </div>
                        <p style={{ color: "#5a6e5c", fontSize: "0.75rem" }} className="truncate">{pickup.address}</p>
                        <p style={{ color: "#5a6e5c", fontSize: "0.72rem", marginTop: "0.1rem" }}>
                          👤 {pickup.profiles?.full_name || pickup.profiles?.phone || "User " + pickup.user_id.slice(0,6).toUpperCase()} · 📞 {pickup.profiles?.phone ?? "—"}
                        </p>
                      </div>

                      {/* Date/weight */}
                      <div className="text-right flex-shrink-0 hidden sm:block">
                        <p style={{ color: "#1a2e1c", fontSize: "0.8rem", fontWeight: 500 }}>{pickup.pickup_date}</p>
                        <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>{pickup.pickup_time}</p>
                        {pickup.actual_weight && <p style={{ color: "#85c48a", fontSize: "0.7rem", fontWeight: 600 }}>{pickup.actual_weight}kg ✓</p>}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {pickup.status === "scheduled" && (
                          pickup.source === "urgent" && !pickup.agent_name ? (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#fff3cd", color: "#856404", border: "1px solid rgba(245,158,11,0.2)" }}>
                              Assign agent first
                            </span>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleStatusChange(pickup.id, "in_progress"); }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                              style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
                              Start
                            </button>
                          )
                        )}
                        {(pickup.status === "scheduled" || pickup.status === "in_progress") && (
                          pickup.source === "urgent" && !pickup.agent_name ? null : (
                            <button onClick={(e) => { e.stopPropagation(); setSelected(pickup); }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors hover:opacity-90"
                              style={{ background: "#008751", color: "#fff" }}>
                              <CheckCircle className="w-3.5 h-3.5" /> Complete
                            </button>
                          )
                        )}
                        {pickup.status === "scheduled" && (
                          <button onClick={(e) => { e.stopPropagation(); handleStatusChange(pickup.id, "cancelled"); }}
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-900/20" title="Cancel">
                            <X className="w-4 h-4" style={{ color: "#c0392b" }} />
                          </button>
                        )}
                        {(pickup.status === "completed" || pickup.status === "cancelled") && (
                          <span className="text-xs px-2 py-1 rounded-lg" style={{ color: "#5a6e5c", background: "#f0ece4" }}>
                            {pickup.status === "completed" ? "Done ✓" : "Cancelled"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly chart */}
            <div className="rounded-2xl p-6 lg:col-span-2" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
              <h3 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1rem", fontWeight: 600, marginBottom: "0.2rem" }}>Pickup Activity</h3>
              <p style={{ color: "#5a6e5c", fontSize: "0.75rem", marginBottom: "1.5rem" }}>Monthly bookings vs completions this year</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#008751" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#008751" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#85c48a" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#85c48a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "rgba(133,196,138,0.5)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(26,46,28,0.1)", borderRadius: "10px", color: "#1a2e1c", fontSize: "0.78rem" }} cursor={{ stroke: "rgba(133,196,138,0.2)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="pickups" name="Booked" stroke="#008751" strokeWidth={2} fill="url(#grad1)" dot={false} activeDot={{ r: 4, fill: "#008751" }} />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#85c48a" strokeWidth={2} fill="url(#grad2)" dot={false} activeDot={{ r: 4, fill: "#85c48a" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Waste type breakdown */}
            <div className="rounded-2xl p-6" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
              <h3 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1rem", fontWeight: 600, marginBottom: "0.2rem" }}>Waste Types</h3>
              <p style={{ color: "#5a6e5c", fontSize: "0.75rem", marginBottom: "1.5rem" }}>Breakdown by category</p>
              {wasteTypeData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <PieChart width={130} height={130}>
                    <Pie data={wasteTypeData} cx={60} cy={60} innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                      {wasteTypeData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                  <div className="flex flex-col gap-2">
                    {wasteTypeData.map((d, idx) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>{d.name}</span>
                        <span style={{ color: "#1a2e1c", fontSize: "0.72rem", fontWeight: 600, marginLeft: "auto" }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ color: "#5a6e5c", fontSize: "0.82rem" }}>No data yet</p>
              )}
            </div>

            {/* Key metrics */}
            <div className="rounded-2xl p-6" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
              <h3 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "1rem", fontWeight: 600, marginBottom: "0.2rem" }}>Key Metrics</h3>
              <p style={{ color: "#5a6e5c", fontSize: "0.75rem", marginBottom: "1.5rem" }}>Platform performance</p>
              <div className="flex flex-col gap-4">
                {[
                  { label: "Completion Rate", value: `${completionRate}%`, pct: completionRate },
                  { label: "Cancellation Rate", value: `${pickups.length > 0 ? Math.round((cancelled / pickups.length) * 100) : 0}%`, pct: pickups.length > 0 ? Math.round((cancelled / pickups.length) * 100) : 0 },
                  { label: "Total Waste Diverted", value: `${totalWeight.toFixed(0)} kg`, pct: Math.min((totalWeight / 1000) * 100, 100) },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between mb-1.5">
                      <span style={{ color: "#5a6e5c", fontSize: "0.78rem" }}>{m.label}</span>
                      <span style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "0.9rem" }}>{m.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "rgba(133,196,138,0.1)" }}>
                      <div className="h-full rounded-full transition-colors" style={{ width: `${m.pct}%`, background: "linear-gradient(to right, #008751, #85c48a)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AGENTS TAB */}
        {activeTab === "agents" && (
          <AgentsManager pickups={pickups} subs={subs} />
        )}

        {/* BILLING TAB */}
        {activeTab === "billing" && (
          <div className="flex flex-col gap-6">

            {/* MRR summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "MRR", value: "₦" + mrr.toLocaleString("en-NG"), color: "#008751" },
                { label: "Pending debts", value: "₦" + pendingDebts.toLocaleString("en-NG"), color: "#c0392b" },
                { label: "Basic subscribers", value: basicCount, color: "#1a2e1c" },
                { label: "Commercial", value: commercialCount, color: "#1a2e1c" },
              ].map(s => (
                <div key={s.label} className="rounded-2xl px-4 py-3" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                  <p style={{ color: "#9ba89a", fontSize: "0.65rem", letterSpacing: "0.05em" }}>{s.label.toUpperCase()}</p>
                  <p style={{ fontFamily: "var(--font-display)", color: s.color, fontWeight: 800, fontSize: "1.25rem", marginTop: "0.2rem" }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Section nav — big clickable buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: "subs", label: "Subscriber List", count: subs.length, icon: "👥", color: "#008751", bg: "#e8f0e4" },
                { key: "payments", label: "Payments", count: payments.length, icon: "💳", color: "#1a2e1c", bg: "#f0ece4" },
                { key: "urgent", label: "Urgent Pickups", count: urgentPickups.length, icon: "⚡", color: "#c0392b", bg: "#fde8e8" },
                { key: "cleanouts", label: "Bulk Clean-outs", count: cleanouts.length, icon: "📦", color: "#5a6e5c", bg: "#f0ece4" },
                { key: "referrals", label: "Referrals", count: referrals.length, icon: "🎁", color: "#008751", bg: "#e8f0e4" },
              ].map(sec => (
                <button key={sec.key} onClick={() => { setBillingSection(sec.key as any); setBillingSearch(""); setPaymentFilter("all"); }}
                  className="flex flex-col items-start p-4 rounded-2xl text-left transition-colors hover:scale-[0.98]"
                  style={{ background: billingSection === sec.key ? "#0e1f0f" : "#fff", border: `1.5px solid ${billingSection === sec.key ? "#0e1f0f" : "rgba(26,46,28,0.08)"}`, cursor: "pointer" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: billingSection === sec.key ? "rgba(247,245,240,0.1)" : sec.bg }}>
                    <span style={{ fontSize: "1.1rem" }}>{sec.icon}</span>
                  </div>
                  <p style={{ color: billingSection === sec.key ? "#f7f5f0" : "#1a2e1c", fontWeight: 700, fontSize: "0.82rem" }}>{sec.label}</p>
                  <p style={{ color: billingSection === sec.key ? "rgba(247,245,240,0.45)" : "#9ba89a", fontSize: "0.7rem", marginTop: "0.15rem" }}>{sec.count} total</p>
                </button>
              ))}
            </div>

            {/* ── Subscriber List ── */}
            {billingSection === "subs" && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(26,46,28,0.07)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "0.95rem", fontWeight: 700 }}>Subscriber List</h2>
                    <button onClick={() => { setBillingLoading(true); fetchBilling(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#f0ece4", color: "#1a2e1c", cursor: "pointer" }}>
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>
                  <input placeholder="Search by name or email…" value={billingSearch} onChange={e => setBillingSearch(e.target.value)}
                    style={{ width: "100%", background: "#f7f5f0", border: "1px solid rgba(26,46,28,0.1)", borderRadius: "10px", padding: "8px 12px", fontSize: "0.8rem", outline: "none", color: "#1a2e1c" }} />
                </div>
                {billingLoading ? (
                  <div className="flex items-center justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-[#008751] border-t-transparent animate-spin" /></div>
                ) : (() => {
                  const filtered = subs.filter(s => !billingSearch || (s.profiles?.full_name ?? "").toLowerCase().includes(billingSearch.toLowerCase()) || (s.profiles?.email ?? "").toLowerCase().includes(billingSearch.toLowerCase()));
                  return filtered.length === 0 ? (
                    <p className="px-5 py-8 text-center" style={{ color: "#9ba89a", fontSize: "0.85rem" }}>{billingSearch ? "No subscribers match your search." : "No subscribers yet."}</p>
                  ) : (
                    <div>
                      {filtered.map((s, i) => (
                        <div key={s.id} onClick={() => setViewSub(s)} className="flex items-center gap-3 px-5 py-4 hover:bg-[#fafaf8] transition-colors" style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(26,46,28,0.06)" : "none", cursor: "pointer" }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                            style={{ background: s.manifest_status === "green" ? "#e8f0e4" : "#fde8e8", color: s.manifest_status === "green" ? "#008751" : "#c0392b", fontFamily: "var(--font-display)" }}>
                            {(s.profiles?.full_name ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.85rem" }}>{s.profiles?.full_name ?? "Unknown"}</p>
                            <p style={{ color: "#9ba89a", fontSize: "0.72rem" }} className="truncate">{s.profiles?.email ?? "No email"}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span style={{ padding: "2px 8px", borderRadius: "9999px", fontSize: "0.65rem", fontWeight: 700, background: s.manifest_status === "green" ? "#d4e8d5" : "#fde8e8", color: s.manifest_status === "green" ? "#1a2e1c" : "#c0392b" }}>
                              {s.manifest_status === "green" ? "Active" : "Overdue"}
                            </span>
                            <span style={{ color: "#9ba89a" }}>›</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Payments ── */}
            {billingSection === "payments" && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(26,46,28,0.07)" }}>
                  <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem" }}>Payments</h2>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {["all","success","pending","rejected"].map(f => (
                      <button key={f} onClick={() => setPaymentFilter(f as any)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                        style={{ background: paymentFilter === f ? "#0e1f0f" : "#f0ece4", color: paymentFilter === f ? "#fff" : "#5a6e5c", cursor: "pointer", textTransform: "capitalize" }}>
                        {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                  <input placeholder="Search by name…" value={billingSearch} onChange={e => setBillingSearch(e.target.value)}
                    style={{ width: "100%", background: "#f7f5f0", border: "1px solid rgba(26,46,28,0.1)", borderRadius: "10px", padding: "8px 12px", fontSize: "0.8rem", outline: "none", color: "#1a2e1c" }} />
                </div>
                {(() => {
                  const filtered = payments.filter(p =>
                    (paymentFilter === "all" || p.status === paymentFilter) &&
                    (!billingSearch || (p.profiles?.full_name ?? "").toLowerCase().includes(billingSearch.toLowerCase()))
                  );
                  return filtered.length === 0 ? (
                    <p className="px-5 py-8 text-center" style={{ color: "#9ba89a", fontSize: "0.85rem" }}>No payments match your filter.</p>
                  ) : (
                    filtered.map((p, i) => (
                      <div key={p.id} onClick={() => p.channel === "bank_transfer" && setViewReceipt(p)}
                        className="flex items-center gap-4 px-5 py-4 transition-colors"
                        style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(26,46,28,0.06)" : "none", cursor: p.channel === "bank_transfer" ? "pointer" : "default" }}
                        onMouseEnter={e => { if (p.channel === "bank_transfer") (e.currentTarget as HTMLElement).style.background = "#fafaf8"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: p.channel === "korapay" ? "#e8f0e4" : "#f0ece4" }}>
                          <span style={{ fontSize: "0.9rem" }}>{p.channel === "korapay" ? "💳" : "🏦"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ color: "#1a2e1c", fontWeight: 500, fontSize: "0.85rem" }}>{p.profiles?.full_name ?? "Unknown"}</p>
                          <p style={{ color: "#9ba89a", fontSize: "0.72rem" }}>{p.channel === "korapay" ? "Korapay" : "Bank transfer"} · {p.purpose.replace("_", " ")} · {new Date(p.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.85rem" }}>₦{Number(p.amount).toLocaleString("en-NG")}</p>
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "1px 7px", borderRadius: "9999px", background: p.status === "success" ? "#d4e8d5" : p.status === "pending" ? "#fff3cd" : "#fde8e8", color: p.status === "success" ? "#1a2e1c" : p.status === "pending" ? "#856404" : "#c0392b" }}>
                            {p.status === "success" ? "CONFIRMED" : p.status === "pending" ? "REVIEW →" : "REJECTED"}
                          </span>
                        </div>
                      </div>
                    ))
                  );
                })()}
              </div>
            )}

            {/* ── Urgent Pickups ── */}
            {billingSection === "urgent" && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(26,46,28,0.07)" }}>
                  <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem" }}>⚡ Urgent Pickups</h2>
                  <input placeholder="Search by name or address…" value={billingSearch} onChange={e => setBillingSearch(e.target.value)}
                    style={{ width: "100%", background: "#f7f5f0", border: "1px solid rgba(26,46,28,0.1)", borderRadius: "10px", padding: "8px 12px", fontSize: "0.8rem", outline: "none", color: "#1a2e1c" }} />
                </div>
                {(() => {
                  const filtered = urgentPickups.filter(p => !billingSearch || (p.profiles?.full_name ?? "").toLowerCase().includes(billingSearch.toLowerCase()) || (p.address ?? "").toLowerCase().includes(billingSearch.toLowerCase()));
                  return filtered.length === 0 ? (
                    <p className="px-5 py-8 text-center" style={{ color: "#9ba89a", fontSize: "0.85rem" }}>No urgent pickups yet.</p>
                  ) : (
                    filtered.map((p, i) => (
                      <div key={p.id} onClick={() => setViewPickup(p)}
                        className="flex items-center gap-3 px-5 py-4 hover:bg-[#fafaf8] transition-colors"
                        style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(26,46,28,0.06)" : "none", cursor: "pointer" }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#fde8e8" }}>
                          <span style={{ fontWeight: 700, color: "#c0392b", fontFamily: "var(--font-display)", fontSize: "0.9rem" }}>{(p.profiles?.full_name ?? "?").charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ color: "#1a2e1c", fontWeight: 600, fontSize: "0.85rem" }}>{p.profiles?.full_name ?? "Unknown"}</p>
                          <p style={{ color: "#9ba89a", fontSize: "0.72rem" }}>{p.pickup_date} · {p.pickup_time}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span style={{ padding: "2px 8px", borderRadius: "9999px", fontSize: "0.65rem", fontWeight: 700,
                            background: p.status === "completed" ? "#d4e8d5" : p.status === "in_progress" ? "#fff3cd" : "#e8f0e4",
                            color: p.status === "completed" ? "#1a2e1c" : p.status === "in_progress" ? "#856404" : "#2d5230" }}>
                            {p.status.replace("_", " ")}
                          </span>
                          <span style={{ color: "#9ba89a" }}>›</span>
                        </div>
                      </div>
                    ))
                  );
                })()}
              </div>
            )}

            {/* ── Bulk Clean-outs ── */}
            {billingSection === "cleanouts" && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(26,46,28,0.07)" }}>
                  <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem" }}>📦 Bulk Clean-out Requests</h2>
                  <input placeholder="Search by name or address…" value={billingSearch} onChange={e => setBillingSearch(e.target.value)}
                    style={{ width: "100%", background: "#f7f5f0", border: "1px solid rgba(26,46,28,0.1)", borderRadius: "10px", padding: "8px 12px", fontSize: "0.8rem", outline: "none", color: "#1a2e1c" }} />
                </div>
                {(() => {
                  const filtered = cleanouts.filter(c => !billingSearch || (c.profiles?.full_name ?? "").toLowerCase().includes(billingSearch.toLowerCase()) || (c.address ?? "").toLowerCase().includes(billingSearch.toLowerCase()));
                  return filtered.length === 0 ? (
                    <p className="px-5 py-8 text-center" style={{ color: "#9ba89a", fontSize: "0.85rem" }}>No clean-out requests yet.</p>
                  ) : (
                    filtered.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(26,46,28,0.06)" : "none" }}>
                        {c.photo_url
                          ? <img src={c.photo_url} alt="junk" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                          : <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f0ece4" }}>📦</div>}
                        <div className="flex-1 min-w-0">
                          <p style={{ color: "#1a2e1c", fontWeight: 500, fontSize: "0.85rem" }}>{c.profiles?.full_name ?? "Unknown"}</p>
                          <p style={{ color: "#9ba89a", fontSize: "0.72rem" }} className="truncate">{c.description} — {c.address}</p>
                        </div>
                        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
                          {c.status === "pending_quote" ? (
                            quoting?.id === c.id ? (
                              <div className="flex items-center gap-2">
                                <input type="number" placeholder="₦ amount" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)}
                                  className="w-24 px-2 py-1.5 rounded-lg text-xs" style={{ background: "#f0ece4", border: "none", outline: "none" }} />
                                <button onClick={() => sendQuote(c)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#008751", color: "#fff", cursor: "pointer" }}>Send</button>
                              </div>
                            ) : (
                              <button onClick={() => setQuoting(c)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#0e1f0f", color: "#f7f5f0", cursor: "pointer" }}>Send quote</button>
                            )
                          ) : (
                            (() => {
                              const adminStatusMap: Record<string, { bg: string; color: string; label: string }> = {
                                quoted:     { bg: "#fff8e6", color: "#92400e", label: `Quoted ₦${c.quote_amount?.toLocaleString("en-NG")}` },
                                paid:       { bg: "#d4e8d5", color: "#1a2e1c", label: `Paid ₦${c.quote_amount?.toLocaleString("en-NG")}` },
                                dispatched: { bg: "#dce8dd", color: "#2d5230", label: "Agent dispatched" },
                                completed:  { bg: "#d4e8d5", color: "#008751", label: "Completed ✓" },
                                declined:   { bg: "#fde8e8", color: "#c0392b", label: "Declined" },
                              };
                              const s = adminStatusMap[c.status] ?? { bg: "#e8f0e4", color: "#2d5230", label: c.status };
                              return (
                                <span style={{ padding: "2px 10px", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 600, background: s.bg, color: s.color }}>
                                  {s.label}
                                </span>
                              );
                            })()
                          )}
                          {(c.status === "paid" || c.status === "dispatched") && (
                            <BulkCleanoutAgentAssign
                              cleanout={c}
                              agents={cleanoutAgents}
                              onAssigned={(id, agent, status) => setCleanouts(prev => prev.map(item => item.id === id ? { ...item, agent_name: agent, status } : item))}
                            />
                          )}
                        </div>
                      </div>
                    ))
                  );
                })()}
              </div>
            )}

            {/* ── Referrals ── */}
            {billingSection === "referrals" && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(26,46,28,0.07)" }}>
                  <h2 style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontSize: "0.95rem", fontWeight: 700 }}>🎁 Referrals</h2>
                  <p style={{ color: "#9ba89a", fontSize: "0.72rem", marginTop: "0.2rem" }}>
                    {referrals.filter(r => r.status === "rewarded").length} rewarded · {referrals.filter(r => r.status === "pending").length} pending (referred but not yet subscribed)
                  </p>
                </div>
                {referrals.length === 0 ? (
                  <p className="px-5 py-8 text-center" style={{ color: "#9ba89a", fontSize: "0.85rem" }}>No referrals yet.</p>
                ) : referrals.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-3.5" style={{ borderBottom: i < referrals.length - 1 ? "1px solid rgba(26,46,28,0.06)" : "none" }}>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: "#1a2e1c", fontWeight: 500, fontSize: "0.82rem" }}>
                        {r.referrer?.full_name ?? "Unknown"} <span style={{ color: "#9ba89a", fontWeight: 400 }}>referred</span> {r.referred?.full_name ?? "Unknown"}
                      </p>
                      <p style={{ color: "#9ba89a", fontSize: "0.7rem" }}>{new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <span style={{ padding: "2px 10px", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 600, background: r.status === "rewarded" ? "#d4e8d5" : "#fff8e6", color: r.status === "rewarded" ? "#1a2e1c" : "#92400e" }}>
                      {r.status === "rewarded" ? "₦500 owed to referrer" : "Pending first payment"}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>

      {/* Pickup detail modal */}
      {viewPickup && (
        <PickupDetailModal
          pickup={viewPickup}
          onClose={() => setViewPickup(null)}
          onComplete={(p) => { setSelected(p); setViewPickup(null); }}
          onStart={(id) => { handleStatusChange(id, "in_progress"); }}
          onCancel={(id) => { handleStatusChange(id, "cancelled"); }}
          onAssigned={handleAgentAssigned}
        />
      )}

      {/* Subscription detail/edit modal */}
      {viewSub && (
        <SubscriptionDetailModal
          sub={viewSub}
          onClose={() => setViewSub(null)}
          onSaved={() => setViewSub(null)}
        />
      )}

      {/* Receipt viewer — approve/reject a bank transfer */}
      {viewReceipt && (
        <ReceiptViewerModal
          payment={viewReceipt}
          onClose={() => setViewReceipt(null)}
          onApprove={() => approvePayment(viewReceipt)}
          onReject={() => rejectPayment(viewReceipt)}
        />
      )}

      {/* Photo lightbox */}
      {photoPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setPhotoPreview(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPhotoPreview(null)} className="absolute -top-10 right-0 p-2 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
            <img src={photoPreview} alt="Waste pickup" className="w-full rounded-2xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}

      {selected && <ConfirmModal pickup={selected} onClose={() => setSelected(null)} onConfirm={handleConfirm} loading={confirming} />}
    </div>
  );
}