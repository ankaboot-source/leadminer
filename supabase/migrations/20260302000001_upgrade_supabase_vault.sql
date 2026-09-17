-- Upgrade supabase_vault extension to recommended version
-- Fixes Supabase database linter warning: extension_versions_outdated
-- https://supabase.com/docs/guides/database/database-linter?lint=0022_extension_versions_outdated
--
-- Conditional: fresh stacks already ship a current vault, and forcing the
-- update there can fail (e.g. pgaudit internal error on newer images).
-- Only update when the installed version is actually older than the target.

DO $$
DECLARE
  v_installed text;
BEGIN
  SELECT extversion INTO v_installed
  FROM pg_extension
  WHERE extname = 'supabase_vault';

  IF v_installed IS NULL THEN
    CREATE EXTENSION supabase_vault WITH SCHEMA vault;
    SELECT extversion INTO v_installed
    FROM pg_extension
    WHERE extname = 'supabase_vault';
  END IF;

  IF string_to_array(v_installed, '.')::int[] < string_to_array('0.3.1', '.')::int[] THEN
    ALTER EXTENSION supabase_vault UPDATE TO '0.3.1';
  ELSE
    RAISE NOTICE 'supabase_vault version % is current, skipping update', v_installed;
  END IF;
END
$$;
