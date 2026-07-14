import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, User, Session } from "../../../utils/supabase/client";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  is_admin?: boolean;
  is_agent?: boolean;
  referral_code?: string | null;
  referred_by?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, profile: null, loading: true,
  signOut: async () => {}, refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) setProfile(data);

    // If they arrived via a referral link (?ref=CODE, stashed by Login.tsx),
    // record it now that we know who they actually are. Only once — a
    // referred person can't be re-attributed to a different referrer.
    if (data && !data.referred_by) {
      let refCode: string | null = null;
      try { refCode = localStorage.getItem("ew_referral_code"); } catch {}
      if (refCode) {
        const { error } = await supabase.rpc("record_referral", { p_code: refCode, p_referred_id: userId });
        if (!error) {
          try { localStorage.removeItem("ew_referral_code"); } catch {}
        } else {
          console.error("[AuthContext] record_referral:", error);
        }
      }
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);