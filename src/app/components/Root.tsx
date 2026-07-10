import { Outlet, useLocation, useNavigate } from "react-router";
import { Leaf, LayoutDashboard, Calendar, Clock, LogOut, Bell, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "../../../utils/supabase/client";

export function Root() {
  const location = useLocation();
  const hideHeader = location.pathname === "/login" || location.pathname === "/" || location.pathname.startsWith("/admin");
  return (
    <div className="min-h-dvh bg-background">
      {!hideHeader && <Header />}
      <main><Outlet /></main>
    </div>
  );
}

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").select("id", { count: "exact" }).eq("user_id", user.id).eq("read", false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [user]);

  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/book-pickup", label: "Book Pickup", icon: Calendar },
    { href: "/history", label: "History", icon: Clock },
  ];

  return (
    <header className="sticky top-0 z-40" style={{ background: "rgba(247,245,240,0.94)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(26,46,28,0.1)", fontFamily: "var(--font-body)" }}>
      {/* Nigerian flag strip */}
      <div className="h-0.5 flex">
        <div className="flex-1" style={{ background: "#008751" }} />
        <div className="flex-1 bg-white" />
        <div className="flex-1" style={{ background: "#008751" }} />
      </div>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-15 py-3">
        <a href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#1a2e1c" }}>
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span style={{ fontFamily: "var(--font-display)", color: "#1a2e1c", fontWeight: 700, fontSize: "1rem" }}>
            EcoWaste <span style={{ color: "#008751", fontWeight: 400, fontSize: "0.8rem" }}>Uyo</span>
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = location.pathname === href;
            return (
              <a key={href} href={href} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm transition-all"
                style={{ color: active ? "#1a2e1c" : "#5a6e5c", background: active ? "#e8f0e4" : "transparent", fontWeight: active ? 500 : 400 }}>
                <Icon className="w-3.5 h-3.5" />{label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/notifications")} className="relative p-2 rounded-full hover:bg-[#e8f0e4] transition-colors">
            <Bell className="w-4 h-4" style={{ color: "#1a2e1c" }} />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] flex items-center justify-center text-white font-bold" style={{ background: "#c0392b" }}>{unread}</span>}
          </button>
          <button onClick={() => navigate("/profile")} className="p-2 rounded-full hover:bg-[#e8f0e4] transition-colors">
            <User className="w-4 h-4" style={{ color: "#1a2e1c" }} />
          </button>
          <div className="hidden sm:block text-right ml-1">
            <p style={{ color: "#1a2e1c", fontWeight: 500, fontSize: "0.82rem" }}>{name}</p>
            <p style={{ color: "#5a6e5c", fontSize: "0.72rem" }}>{user?.email}</p>
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm ml-1 transition-all hover:opacity-80" style={{ background: "#1a2e1c", color: "#f7f5f0" }}>
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
