-- Move increment_gateway_sent_count_atomic to private schema
-- PostgREST only exposes private + graphql_public schemas; calls to
-- public schema return HTTP 406 (PGRST106 "Invalid schema: public"),
-- which breaks per-recipient quota tracking in sms-campaigns-process.

ALTER FUNCTION public.increment_gateway_sent_count_atomic(uuid, integer)
  SET SCHEMA private;

-- Re-establish security posture identical to original
ALTER FUNCTION private.increment_gateway_sent_count_atomic(uuid, integer)
  SECURITY DEFINER
  SET search_path = '';