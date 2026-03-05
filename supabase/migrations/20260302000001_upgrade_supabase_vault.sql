-- Upgrade supabase_vault extension to recommended version
-- Fixes Supabase database linter warning: extension_versions_outdated
-- https://supabase.com/docs/guides/database/database-linter?lint=0022_extension_versions_outdated

ALTER EXTENSION supabase_vault UPDATE TO '0.3.1';
