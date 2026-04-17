-- Add gateway_names to SMS campaign overview by joining selected_gateway_ids with sms_fleet_gateways
-- This allows the frontend to display which specific gateways were used instead of just "fleet"

CREATE OR REPLACE FUNCTION public.get_sms_campaigns_overview()
RETURNS TABLE (
  id UUID,
  sender_name TEXT,
  provider TEXT,
  recipient_count BIGINT,
  sent_count BIGINT,
  failed_count BIGINT,
  click_count BIGINT,
  unsubscribe_count BIGINT,
  status TEXT,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  use_short_links BOOLEAN,
  fleet_mode_enabled BOOLEAN,
  selected_gateway_ids UUID[],
  gateway_names TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.id,
    sc.sender_name,
    sc.provider,
    sc.recipient_count,
    sc.sent_count,
    sc.failed_count,
    sc.click_count,
    sc.unsubscribe_count,
    sc.status::TEXT,
    sc.created_at,
    sc.started_at,
    sc.completed_at,
    sc.use_short_links,
    sc.fleet_mode_enabled,
    sc.selected_gateway_ids,
    COALESCE(
      ARRAY(
        SELECT g.name
        FROM unnest(sc.selected_gateway_ids) AS gid(id)
        JOIN private.sms_fleet_gateways g ON g.id = gid.id
        ORDER BY g.name
      ),
      ARRAY[]::TEXT[]
    ) AS gateway_names
  FROM private.sms_campaigns sc
  WHERE sc.user_id = auth.uid()
  ORDER BY sc.created_at DESC;
END;
$$;