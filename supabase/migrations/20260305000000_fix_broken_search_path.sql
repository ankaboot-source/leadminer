-- Fix broken ALTER FUNCTION statements from migration 20260302000000
-- The previous migration tried to alter functions that don't exist or aren't owned

-- Drop the problematic functions if they exist (they're unused version variants)
DROP FUNCTION IF EXISTS private.contact_temperature_v2(integer, integer, integer, integer, timestamptz, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS private.contact_temperature_v3(integer, integer, integer, integer, timestamptz, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS private.contact_temperature_v4(integer, integer, integer, integer, timestamptz, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS private.contact_temperature_v5(integer, integer, integer, integer, timestamptz, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS private.contact_temperature_v6(integer, integer, integer, integer, timestamptz, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS private.contact_temperature_v7(integer, integer, integer, integer, timestamptz, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS private.contact_temperature_v8(integer, integer, integer, integer, timestamptz, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS private.contact_temperature_v9_clean(integer, integer, integer, integer, timestamptz, timestamptz, timestamptz);

-- Handle invoke_edge_function gracefully (may not exist in all environments)
DO $$
BEGIN
  ALTER FUNCTION public.invoke_edge_function(text) SET search_path = '';
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- Handle contact_temperature if it exists and is owned
DO $$
BEGIN
  ALTER FUNCTION private.contact_temperature(
    integer, integer, integer, integer, timestamptz, timestamptz, timestamptz
  ) SET search_path = '';
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;
