-- Fix Supabase linter warning: function_search_path_mutable
-- https://supabase.com/docs/guides/database/database-linter?lint=0011
--
-- SECURITY DEFINER functions created since last fix (20260302000000) that are
-- missing search_path entirely, or using 'public' instead of ''.

-- invoke_edge_function(TEXT) — public schema
-- Created in 20260226142941 without search_path.
-- 20260304160000 created private.invoke_edge_function (with search_path='')
-- but never dropped the public one.
DO $$
BEGIN
  ALTER FUNCTION public.invoke_edge_function(TEXT) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- private.increment_gateway_sent_count(UUID, INTEGER)
-- Created in 20260407120000 without search_path
DO $$
BEGIN
  ALTER FUNCTION private.increment_gateway_sent_count(UUID, INTEGER) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- private.batch_increment_gateway_counts(UUID[], INTEGER[])
-- Created in 20260407120000 without search_path
DO $$
BEGIN
  ALTER FUNCTION private.batch_increment_gateway_counts(UUID[], INTEGER[]) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- public.get_sms_campaigns_overview()
-- Latest version in 20260418100000 uses SET search_path = public (should be '')
DO $$
BEGIN
  ALTER FUNCTION public.get_sms_campaigns_overview() SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- public.get_unified_campaigns_overview()
-- Latest version in 20260418100000 uses SET search_path = public (should be '')
DO $$
BEGIN
  ALTER FUNCTION public.get_unified_campaigns_overview() SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
