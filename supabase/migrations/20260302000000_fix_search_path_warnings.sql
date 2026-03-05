-- Fix Supabase database linter warnings: function_search_path_mutable
-- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- Set empty search_path on all application functions to prevent
-- privilege escalation through search_path manipulation.

-- public schema functions
ALTER FUNCTION public.delete_old_pst_files() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.invoke_edge_function(text) SET search_path = '';

-- private schema functions
ALTER FUNCTION private.contact_temperature(
  integer, integer, integer, integer, timestamptz, timestamptz, timestamptz
) SET search_path = '';

ALTER FUNCTION private.contact_temperature_v2(
  integer, integer, integer, integer, timestamptz, timestamptz, timestamptz
) SET search_path = '';

ALTER FUNCTION private.contact_temperature_v3(
  integer, integer, integer, integer, timestamptz, timestamptz, timestamptz
) SET search_path = '';

ALTER FUNCTION private.contact_temperature_v4(
  integer, integer, integer, integer, timestamptz, timestamptz, timestamptz
) SET search_path = '';

ALTER FUNCTION private.contact_temperature_v5(
  integer, integer, integer, integer, timestamptz, timestamptz, timestamptz
) SET search_path = '';

ALTER FUNCTION private.contact_temperature_v6(
  integer, integer, integer, integer, timestamptz, timestamptz, timestamptz
) SET search_path = '';

ALTER FUNCTION private.contact_temperature_v7(
  integer, integer, integer, integer, timestamptz, timestamptz, timestamptz
) SET search_path = '';

ALTER FUNCTION private.contact_temperature_v8(
  integer, integer, integer, integer, timestamptz, timestamptz, timestamptz
) SET search_path = '';

ALTER FUNCTION private.contact_temperature_v9_clean(
  integer, integer, integer, integer, timestamptz, timestamptz, timestamptz
) SET search_path = '';

ALTER FUNCTION private.trg_set_contact_temperature() SET search_path = '';
ALTER FUNCTION private.get_mining_source_overview(uuid) SET search_path = '';
ALTER FUNCTION private.get_passive_mining_ids(date, date) SET search_path = '';
ALTER FUNCTION private.get_distinct_or_exclude_from_array(text[], text[]) SET search_path = '';
ALTER FUNCTION private.get_mining_stats(text) SET search_path = '';

-- Note: public.invoke_url is not owned by the application (likely extension-managed)
-- and is excluded from this fix to avoid conflicts.
