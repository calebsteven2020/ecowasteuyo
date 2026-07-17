export const APK_DOWNLOAD_URL = "https://xhsqygawsgsnpfwemczi.supabase.co/storage/v1/object/public/downloads/ecowaste-uyo.apk";

// The email treated as admin when profiles.is_admin isn't set for that
// account yet — a bootstrap/fallback path used across Home.tsx, Login.tsx,
// AdminDashboard.tsx, and routes.tsx. Previously hardcoded as the literal
// string "admin@admin.com" in ~6 separate places; centralized here so
// there's one source of truth. Keep this in sync with the ADMIN_EMAIL
// secret set on the edge function (`supabase secrets set ADMIN_EMAIL=...`)
// — see supabase/functions/server/index.ts.
//
// Note: like everything else read via import.meta.env.VITE_*, this value
// is compiled into the public browser bundle — it's a convenience for
// keeping the identifier in one place and out of git diffs, not a secret.
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "admin@admin.com";