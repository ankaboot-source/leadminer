-- Finding #4 (audit 2026-09-09): scheduled edge-function invocations must
-- always authenticate.
--
-- History:
--   20260226142941 created public.invoke_edge_function(TEXT) which POSTed to
--     edge functions with NO Authorization header, and pointed the
--     passive-cron-job at it. With verify_jwt enabled the platform rejected
--     every nightly call (401 before reaching the function).
--   20260304160000 added private.invoke_edge_function(TEXT, JSONB) that reads
--     project_url + service_role_key from vault and sends
--     `Authorization: Bearer <service_role_key>` + `apikey`, and rescheduled
--     passive-cron-job / weekly-passive-mining-reports onto it.
--
-- The unauthenticated public variant is obsolete but was left behind, so any
-- future cron/workflow that calls it silently reverts to the broken behavior.
-- Drop it; the authenticated private.invoke_edge_function is the single path.

DROP FUNCTION IF EXISTS public.invoke_edge_function(TEXT);
DROP FUNCTION IF EXISTS public.invoke_edge_function(TEXT, JSONB);
