-- Logical JSON backup of all application data (no Docker / pg_dump required).
-- Usage: supabase db query --linked -f scripts/backup-db.sql --output json > backups/<name>.json
SELECT jsonb_build_object(
  'taken_at',    now(),
  'restaurants', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.restaurants t),
  'menus',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.menus t),
  'categories',  (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.categories t),
  'dishes',      (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.dishes t),
  'menu_stats',  (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.menu_stats t),
  'orders',      (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.orders t),
  'uploads',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.uploads t),
  'policies',    (SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM pg_policies p WHERE p.schemaname = 'public'),
  'functions',   (SELECT coalesce(jsonb_agg(jsonb_build_object(
                      'name', pr.proname,
                      'definition', pg_get_functiondef(pr.oid))), '[]'::jsonb)
                  FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
                  WHERE n.nspname = 'public')
) AS backup;
