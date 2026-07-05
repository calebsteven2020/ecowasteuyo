-- ============================================================
-- EcoWaste Nigeria — Supabase Database Schema
-- Run this ONCE in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xhsqygawsgsnpfwemczi/sql/new
-- ============================================================

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_agent BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Pickups
CREATE TABLE IF NOT EXISTS pickups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  waste_type TEXT NOT NULL,
  address TEXT NOT NULL,
  pickup_date TEXT NOT NULL,
  pickup_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  estimated_weight NUMERIC,
  actual_weight NUMERIC,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pickups ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE pickups ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE pickups ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'one_off'
  CHECK (source IN ('one_off','subscription','urgent','bulk_cleanout'));

-- Backfill: any pickup with price = 8000 that has no source set is an urgent pickup
UPDATE pickups SET source = 'urgent' WHERE price = 8000 AND (source IS NULL OR source = 'one_off');

-- Payments purposes: add urgent_pickup to the allowed values
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN ('subscription','express_pickup','bulk_cleanout','urgent_pickup'));

-- 3. Recycling records (auto-computed impact columns)
CREATE TABLE IF NOT EXISTS recycling_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_id UUID REFERENCES pickups(id) ON DELETE SET NULL,
  material_type TEXT NOT NULL,
  weight_kg NUMERIC NOT NULL DEFAULT 0,
  co2_saved_kg NUMERIC GENERATED ALWAYS AS (weight_kg * 0.8) STORED,
  trees_equivalent NUMERIC GENERATED ALWAYS AS (weight_kg / 10.0) STORED,
  water_saved_litres NUMERIC GENERATED ALWAYS AS (weight_kg * 2.5) STORED,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Subscriptions — recurring Basic/Commercial plans (the "Core Engine")
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic','commercial')),
  price NUMERIC NOT NULL,                 -- ₦3,000–₦5,000 (basic) or ₦10,000–₦20,000 (commercial)
  pickups_per_week INTEGER NOT NULL DEFAULT 1, -- 1 for Basic, 3 for Commercial
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','past_due','pending','cancelled')), -- pending = bank transfer awaiting receipt review
  manifest_status TEXT NOT NULL DEFAULT 'green'
    CHECK (manifest_status IN ('green','red')),   -- red = payment failed/unverified, truck bypasses house
  trash_ready BOOLEAN NOT NULL DEFAULT FALSE,     -- "Trash is Ready" toggle for tonight's pickup
  payment_method TEXT DEFAULT 'korapay' CHECK (payment_method IN ('korapay','bank_transfer')),
  billing_day INTEGER NOT NULL DEFAULT 1,         -- always charged on the 1st of the month
  last_payment_date DATE,
  next_billing_date DATE NOT NULL DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month')::DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_sub_per_user ON subscriptions(user_id) WHERE status <> 'cancelled';

-- 6. Express pickups — the on-demand, pay-per-pickup add-on for subscribers
CREATE TABLE IF NOT EXISTS express_pickups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 1500,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','assigned','completed','cancelled')),
  notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 7. Bulk clean-outs — one-time dispatch + custom quote for non-subscribers
CREATE TABLE IF NOT EXISTS bulk_cleanouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_quote'
    CHECK (status IN ('pending_quote','quoted','paid','dispatched','completed','declined')),
  quote_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Agents — driver/collector roster created by the admin.
-- NOTE: password is stored in plaintext purely so the admin can click an
-- agent and recover the credentials they handed out. This table is only
-- readable by admins (see RLS below) — it is not used for authentication
-- itself (that's handled by Supabase Auth); it's a credentials reference.
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Payments — records every Korapay charge and bank-transfer receipt
-- (this is what powers the admin's "incoming payments" view)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  express_pickup_id UUID REFERENCES express_pickups(id) ON DELETE SET NULL,
  bulk_cleanout_id UUID REFERENCES bulk_cleanouts(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL DEFAULT 'subscription'
    CHECK (purpose IN ('subscription','express_pickup','bulk_cleanout')),
  amount NUMERIC NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('korapay','bank_transfer')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','success','failed','rejected')),
  korapay_reference TEXT,           -- Korapay's transaction reference, for reconciliation
  receipt_url TEXT,                 -- uploaded proof-of-transfer image (bank_transfer channel)
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- admin who confirmed a bank transfer
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DB-level backstop against duplicate Korapay records: if the widget's
-- onSuccess callback ever fires twice despite the client-side guard (e.g. a
-- race on a very fast double event), the second insert for the same
-- reference is rejected outright instead of creating a duplicate row.
-- Only applies to non-null references, so manual/bank-transfer rows
-- (which don't always have one) aren't affected.
CREATE UNIQUE INDEX IF NOT EXISTS payments_korapay_reference_unique
  ON payments (korapay_reference) WHERE korapay_reference IS NOT NULL;

-- ── Triggers ──────────────────────────────────────────────────

-- Auto-create profile + welcome notification on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Wrapped in its own block so a profile insert failure never aborts
  -- the auth.users transaction (which surfaces as "Database error saving
  -- new user"). If this fails we log a warning and move on — the agent
  -- creation code will upsert the profile row explicitly afterwards.
  BEGIN
    INSERT INTO profiles (id, full_name, email, is_agent, is_admin)
      VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'is_agent')::boolean, FALSE),
        (NEW.email = 'admin@admin.com')
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        email     = COALESCE(EXCLUDED.email,     profiles.email),
        is_agent  = EXCLUDED.is_agent,
        is_admin  = profiles.is_admin OR EXCLUDED.is_admin;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: profile upsert failed for %: %', NEW.id, SQLERRM;
  END;

  -- Same: notification insert failure must not abort user creation.
  BEGIN
    INSERT INTO notifications (user_id, title, message, type)
      VALUES (
        NEW.id,
        'Welcome to EcoWaste Uyo! 🌿',
        'Your account is ready. Subscribe for weekly pickups and help build a cleaner Uyo.',
        'success'
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: notification insert failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS pickups_updated_at ON pickups;
CREATE TRIGGER pickups_updated_at
  BEFORE UPDATE ON pickups FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS bulk_cleanouts_updated_at ON bulk_cleanouts;
CREATE TRIGGER bulk_cleanouts_updated_at
  BEFORE UPDATE ON bulk_cleanouts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycling_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE express_pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_cleanouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ── Admin/agent check helpers ───────────────────────────────────
-- These run as SECURITY DEFINER, which executes with the privileges of the
-- function owner (the table owner) rather than the calling user — so the
-- SELECT inside them does NOT re-trigger RLS on profiles. Using plain
-- "EXISTS (SELECT 1 FROM profiles WHERE ...)" directly inside a policy
-- attached to profiles itself caused "infinite recursion detected in policy
-- for relation profiles": evaluating that policy ran the subquery, which
-- re-evaluated the same policy, forever. Routing every admin/agent check
-- through these functions instead fixes that table and prevents the same
-- recursion risk on every other table whose policies check profiles too.
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Mirrors the frontend's AdminRoute check exactly (src/app/routes.tsx:
  -- "user.email === ADMIN_EMAIL || profile.is_admin === true"). Without the
  -- email fallback here too, someone let into /admin purely by matching
  -- admin@admin.com (whose profiles.is_admin happened to still be false —
  -- e.g. the account was created after the last time the one-time UPDATE
  -- near the bottom of this file ran) would see the admin dashboard render,
  -- but every RLS-gated query (subscriptions, payments, bulk_cleanouts...)
  -- would silently return zero rows — exactly the "subscribed user shows
  -- nothing on the admin board" symptom, with no error to point at why.
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()), FALSE
  ) OR COALESCE(
    (SELECT email = 'admin@admin.com' FROM auth.users WHERE id = auth.uid()), FALSE
  );
$$;
GRANT EXECUTE ON FUNCTION is_admin_user() TO authenticated;

CREATE OR REPLACE FUNCTION is_agent_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_agent FROM profiles WHERE id = auth.uid()), FALSE);
$$;
GRANT EXECUTE ON FUNCTION is_agent_user() TO authenticated;

DROP POLICY IF EXISTS "users_own_profile" ON profiles;
CREATE POLICY "users_own_profile" ON profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin_manage_profiles" ON profiles;
CREATE POLICY "admin_manage_profiles" ON profiles FOR ALL
  USING (is_admin_user());

DROP POLICY IF EXISTS "users_own_pickups" ON pickups;
CREATE POLICY "users_own_pickups" ON pickups FOR ALL USING (auth.uid() = user_id);

-- Agents could never see pickups assigned to them, and admins could only see
-- pickups via the service-role edge function — there was no RLS policy at
-- all granting read/write access to anyone but the pickup's own customer.
-- This is what made "assign agent" silently invisible on the agent's own
-- dashboard: the row existed and was assigned correctly, but the agent's
-- own browser session was blocked from ever selecting it.
DROP POLICY IF EXISTS "staff_access_pickups" ON pickups;
CREATE POLICY "staff_access_pickups" ON pickups FOR ALL
  USING (
    is_admin_user()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_agent = TRUE
        AND p.full_name IS NOT NULL
        AND lower(trim(p.full_name)) = lower(trim(pickups.agent_name))
    )
  );

DROP POLICY IF EXISTS "users_own_recycling" ON recycling_records;
CREATE POLICY "users_own_recycling" ON recycling_records FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_notifications" ON notifications;
CREATE POLICY "users_own_notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- Subscriptions: residents/shops manage their own plan; agents+admins need read access
-- to build the daily manifest (green/red houses on their route).
DROP POLICY IF EXISTS "users_own_subscriptions" ON subscriptions;
CREATE POLICY "users_own_subscriptions" ON subscriptions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_read_subscriptions" ON subscriptions;
CREATE POLICY "staff_read_subscriptions" ON subscriptions FOR SELECT
  USING (is_agent_user() OR is_admin_user());

-- Admins also need to WRITE subscriptions (e.g. approving a bank-transfer
-- payment activates the row) — staff_read_subscriptions above only covers
-- SELECT, so without this, admin writes were being silently blocked by RLS.
DROP POLICY IF EXISTS "admin_manage_subscriptions" ON subscriptions;
CREATE POLICY "admin_manage_subscriptions" ON subscriptions FOR ALL
  USING (is_admin_user());

DROP POLICY IF EXISTS "users_own_express_pickups" ON express_pickups;
CREATE POLICY "users_own_express_pickups" ON express_pickups FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_read_express_pickups" ON express_pickups;
CREATE POLICY "staff_read_express_pickups" ON express_pickups FOR SELECT
  USING (is_agent_user() OR is_admin_user());

DROP POLICY IF EXISTS "admin_manage_express_pickups" ON express_pickups;
CREATE POLICY "admin_manage_express_pickups" ON express_pickups FOR ALL
  USING (is_admin_user());

DROP POLICY IF EXISTS "users_own_bulk_cleanouts" ON bulk_cleanouts;
CREATE POLICY "users_own_bulk_cleanouts" ON bulk_cleanouts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_read_bulk_cleanouts" ON bulk_cleanouts;
CREATE POLICY "staff_read_bulk_cleanouts" ON bulk_cleanouts FOR SELECT
  USING (is_agent_user() OR is_admin_user());

DROP POLICY IF EXISTS "admin_manage_bulk_cleanouts" ON bulk_cleanouts;
CREATE POLICY "admin_manage_bulk_cleanouts" ON bulk_cleanouts FOR ALL
  USING (is_admin_user());

-- Agents roster: admin-only (also readable by agents themselves isn't needed —
-- the agent app looks up pickups by name, not this table).
DROP POLICY IF EXISTS "admin_manage_agents" ON agents;
CREATE POLICY "admin_manage_agents" ON agents FOR ALL
  USING (is_admin_user());

-- Payments: customers create/read their own; admins read & verify everyone's.
DROP POLICY IF EXISTS "users_own_payments" ON payments;
CREATE POLICY "users_own_payments" ON payments FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_manage_payments" ON payments;
CREATE POLICY "admin_manage_payments" ON payments FOR ALL
  USING (is_admin_user());

-- ── One-time data fix: backfill email into profiles for existing users ──
-- The email column was added after the table was created, so existing rows
-- have NULL. This pulls the email from auth.users and writes it across.
UPDATE profiles SET email = u.email
FROM auth.users u WHERE profiles.id = u.id AND profiles.email IS NULL;

-- ── One-time data fix: heal agent accounts broken by the is_agent bug above ──
-- (any account created through "Add Agent" before this fix has is_agent=false
-- and could never reach /agent — this brings them in line with the agents table)
UPDATE profiles SET is_agent = TRUE
WHERE id IN (SELECT u.id FROM auth.users u JOIN agents a ON a.email = u.email);

-- ── One-time data fix: make sure the admin login is actually flagged admin ──
-- (RLS policies above check profiles.is_admin, so this must be true for
-- admin@admin.com or the admin dashboard will silently see empty tables)
UPDATE profiles SET is_admin = TRUE
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@admin.com');

-- ── Auto-expiry: when a subscription's billing date passes unpaid, ─────────
-- automatically flip it to past_due/red so the driver's manifest bypasses
-- the house, with no admin action needed.
-- next_billing_date is now set to exactly 1 month from the subscription/payment
-- date (e.g. subscribe June 18 → next_billing_date = July 18), so the check
-- below is already correct: if today > next_billing_date and still active, overdue.
CREATE OR REPLACE FUNCTION flag_overdue_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, user_id FROM subscriptions
    WHERE status = 'active' AND manifest_status = 'green' AND next_billing_date < CURRENT_DATE
  LOOP
    UPDATE subscriptions SET status = 'past_due', manifest_status = 'red' WHERE id = r.id;
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      r.user_id,
      'Payment overdue ⚠️',
      'Your billing date has passed without a payment. Your house is now marked RED — the truck will bypass you until you pay.',
      'warning'
    );
  END LOOP;
END;
$$;

-- Let any authenticated user trigger this (it only ever flips already-overdue
-- rows, so it's safe to call from the client as a self-healing check whenever
-- the app loads a subscription/manifest list — see fetchBilling, fetchManifest,
-- and the Subscriptions page).
GRANT EXECUTE ON FUNCTION flag_overdue_subscriptions() TO authenticated;

-- Best-effort: also run it automatically once a day via pg_cron, if your
-- Supabase project has the pg_cron extension enabled (Database → Extensions).
-- This block is wrapped so it won't break the rest of schema.sql if pg_cron
-- isn't available on your plan.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('flag-overdue-subscriptions')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'flag-overdue-subscriptions');
    PERFORM cron.schedule('flag-overdue-subscriptions', '0 1 * * *', 'SELECT flag_overdue_subscriptions();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron present but schedule failed for some other reason — ignore,
  -- the client-side self-healing calls still cover this.
  NULL;
END $$;

-- ── Storage ───────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
  VALUES ('pickup-photos', 'pickup-photos', true)
  ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('receipts', 'receipts', true)
  ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "auth_upload_receipts" ON storage.objects;
CREATE POLICY "auth_upload_receipts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "public_read_receipts" ON storage.objects;
CREATE POLICY "public_read_receipts" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "auth_upload_photos" ON storage.objects;
CREATE POLICY "auth_upload_photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pickup-photos');

DROP POLICY IF EXISTS "public_read_photos" ON storage.objects;
CREATE POLICY "public_read_photos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'pickup-photos');

DROP POLICY IF EXISTS "owner_delete_photos" ON storage.objects;
CREATE POLICY "owner_delete_photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pickup-photos' AND auth.uid()::text = (storage.foldername(name))[1]);