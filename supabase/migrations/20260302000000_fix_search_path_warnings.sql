-- Fix Supabase database linter warnings: function_search_path_mutable
-- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- Set empty search_path on all application functions to prevent
-- privilege escalation through search_path manipulation.

-- Only alter functions that exist in migrations and are owned by the application.

-- public schema functions (from migrations)
ALTER FUNCTION public.delete_old_pst_files() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Note: invoke_edge_function may not exist in all environments - using DO block to handle gracefully
DO $$
BEGIN
  ALTER FUNCTION public.invoke_edge_function(text) SET search_path = '';
EXCEPTION WHEN undefined_function THEN
  NULL; -- Function doesn't exist, skip
END $$;

-- private schema functions (only those defined in migrations)
ALTER FUNCTION private.trg_set_contact_temperature() SET search_path = '';
ALTER FUNCTION private.get_mining_source_overview(uuid) SET search_path = '';
ALTER FUNCTION private.get_passive_mining_ids(date, date) SET search_path = '';
ALTER FUNCTION private.get_distinct_or_exclude_from_array(text[], text[]) SET search_path = '';
ALTER FUNCTION private.get_mining_stats(text) SET search_path = '';

-- Note: 
-- - public.invoke_url is extension-managed, excluded
-- - contact_temperature_v* variants don't exist in migrations, excluded
-- - contact_temperature function may not be owned by app in all environments
