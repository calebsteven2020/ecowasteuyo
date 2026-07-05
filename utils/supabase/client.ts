import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "./info";

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

export type { Session, User } from "@supabase/supabase-js";
