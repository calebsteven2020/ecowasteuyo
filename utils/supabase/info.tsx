// Values now come from .env (see .env.example for what's required) instead
// of being hardcoded here. Vite only exposes env vars prefixed VITE_, and
// only at build time — see .env.example for why that's fine for these two
// specifically (anon key is RLS-protected, not a real secret).

export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!projectId || !publicAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_PROJECT_ID or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in real values (Supabase dashboard → Project Settings → API)."
  );
}