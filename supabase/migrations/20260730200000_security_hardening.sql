-- ============================================================================
-- SECURITY HARDENING MIGRATION — WebAR Menu (طلباتي)
-- Date: 2026-07-30
-- Ref: ENGINEERING_AUDIT_REPORT.md  #1, #5
--
-- WHAT THIS FIXES
--  1. CRITICAL: public.exec_sql(text) was SECURITY DEFINER with default PUBLIC
--     EXECUTE grant. Any holder of the anon key could run arbitrary SQL
--     (`rpc('exec_sql', { sql: 'drop table restaurants' })`) => full DB takeover.
--  2. SECURITY DEFINER functions had a mutable search_path (schema hijack risk).
--  3. "Admin full access" policies used `auth.jwt() ->> 'role' = 'admin'`, a claim
--     Supabase never issues => policies were dead code, admin writes only worked
--     because the service_role key bypasses RLS.
--  4. `user_profiles` table referenced by functions/src/routes/auth.js did not
--     exist => every login/-me/-signup call threw 42P01.
--  5. `menu_stats` had RLS enabled with zero policies (advisor: rls_enabled_no_policy).
--  6. anon role still held INSERT/UPDATE/DELETE grants (defense-in-depth).
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. REMOVE ARBITRARY SQL EXECUTION RPC  (CRITICAL)
-- ============================================================================
DROP FUNCTION IF EXISTS public.exec_sql(text) CASCADE;

-- ============================================================================
-- 2. USER PROFILES (required by /api/auth/*)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email         VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'staff'
                  CHECK (role IN ('owner', 'admin', 'manager', 'staff')),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_restaurant ON public.user_profiles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. ROLE HELPERS (SECURITY DEFINER to avoid RLS recursion on user_profiles)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(public.current_app_role() IN ('owner', 'admin', 'manager'), false);
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ============================================================================
-- 4. HARDEN REMAINING SECURITY DEFINER FUNCTIONS (pin search_path + grants)
-- ============================================================================
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_dish_views(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_menu_for_ar(uuid) SET search_path = public, pg_temp;

-- Public AR pages legitimately need these two; nothing else.
REVOKE ALL ON FUNCTION public.increment_dish_views(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_menu_for_ar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_dish_views(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_menu_for_ar(uuid) TO anon, authenticated, service_role;

-- ============================================================================
-- 5. REPLACE DEAD "auth.jwt() ->> 'role' = 'admin'" POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Admin full access restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Admin full access menus"       ON public.menus;
DROP POLICY IF EXISTS "Admin full access categories"  ON public.categories;
DROP POLICY IF EXISTS "Admin full access dishes"      ON public.dishes;
DROP POLICY IF EXISTS "Admin full access orders"      ON public.orders;
DROP POLICY IF EXISTS "Admin full access uploads"     ON public.uploads;

DROP POLICY IF EXISTS "Admins manage restaurants" ON public.restaurants;
CREATE POLICY "Admins manage restaurants" ON public.restaurants
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage menus" ON public.menus;
CREATE POLICY "Admins manage menus" ON public.menus
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories" ON public.categories
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage dishes" ON public.dishes;
CREATE POLICY "Admins manage dishes" ON public.dishes
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage orders" ON public.orders;
CREATE POLICY "Admins manage orders" ON public.orders
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage uploads" ON public.uploads;
CREATE POLICY "Admins manage uploads" ON public.uploads
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- menu_stats: was RLS-enabled with no policy at all
DROP POLICY IF EXISTS "Admins read menu stats" ON public.menu_stats;
CREATE POLICY "Admins read menu stats" ON public.menu_stats
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- user_profiles: a user reads own row; owners/admins manage their restaurant's users
DROP POLICY IF EXISTS "Users read own profile" ON public.user_profiles;
CREATE POLICY "Users read own profile" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Owners manage restaurant users" ON public.user_profiles;
CREATE POLICY "Owners manage restaurant users" ON public.user_profiles
    FOR ALL TO authenticated
    USING (public.current_app_role() IN ('owner', 'admin'))
    WITH CHECK (public.current_app_role() IN ('owner', 'admin'));

-- ============================================================================
-- 6. LEAST PRIVILEGE GRANTS (defense in depth: anon is read-only)
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL   ON public.user_profiles FROM anon;
REVOKE ALL   ON public.menu_stats    FROM anon;
REVOKE ALL   ON public.orders        FROM anon;
REVOKE ALL   ON public.uploads       FROM anon;

GRANT SELECT ON public.restaurants, public.menus, public.categories, public.dishes TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

-- Never let API roles create objects in public
REVOKE CREATE ON SCHEMA public FROM anon, authenticated;

-- updated_at trigger for user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

-- ============================================================================
-- VERIFICATION (run manually)
--   select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and proname='exec_sql';           -- expect 0 rows
--   select tablename, policyname from pg_policies where schemaname='public';
--   supabase db advisors --linked --type security
-- ============================================================================
