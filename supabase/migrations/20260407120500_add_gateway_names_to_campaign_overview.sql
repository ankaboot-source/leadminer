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

-- Also update the unified overview to include gateway_names
CREATE OR REPLACE FUNCTION public.get_unified_campaigns_overview()
RETURNS TABLE (
  id UUID,
  channel TEXT,
  sender_name TEXT,
  sender_email TEXT,
  provider TEXT,
  subject TEXT,
  status TEXT,
  total_recipients BIGINT,
  recipient_count BIGINT,
  attempted BIGINT,
  delivered BIGINT,
  sent_count BIGINT,
  hard_bounced BIGINT,
  soft_bounced BIGINT,
  failed_other BIGINT,
  failed_count BIGINT,
  opened BIGINT,
  open_count BIGINT,
  clicked BIGINT,
  click_count BIGINT,
  unsubscribed BIGINT,
  unsubscribe_count BIGINT,
  delivery_rate NUMERIC,
  opening_rate NUMERIC,
  clicking_rate NUMERIC,
  unsubscribe_rate NUMERIC,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sender_daily_limit BIGINT,
  total_batches BIGINT,
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
  -- Email campaigns
  SELECT 
    ec.id,
    'email'::TEXT AS channel,
    ec.sender_name,
    ec.sender_email,
    NULL::TEXT AS provider,
    ec.subject,
    ec.status::TEXT,
    ec.total_recipients,
    ec.recipient_count,
    ec.attempted,
    ec.delivered,
    NULL::BIGINT AS sent_count,
    ec.hard_bounced,
    ec.soft_bounced,
    ec.failed_other,
    NULL::BIGINT AS failed_count,
    ec.opened,
    ec.open_count,
    ec.clicked,
    ec.click_count,
    ec.unsubscribed,
    ec.unsubscribe_count,
    ec.delivery_rate,
    ec.opening_rate,
    ec.clicking_rate,
    ec.unsubscribe_rate,
    ec.created_at,
    ec.started_at,
    ec.completed_at,
    ec.sender_daily_limit,
    ec.total_batches,
    NULL::BOOLEAN AS use_short_links,
    NULL::BOOLEAN AS fleet_mode_enabled,
    NULL::UUID[] AS selected_gateway_ids,
    NULL::TEXT[] AS gateway_names
  FROM private.email_campaigns ec
  WHERE ec.user_id = auth.uid()
  
  UNION ALL
  
  -- SMS campaigns
  SELECT 
    sc.id,
    'sms'::TEXT AS channel,
    sc.sender_name,
    NULL::TEXT AS sender_email,
    sc.provider,
    NULL::TEXT AS subject,
    sc.status::TEXT,
    NULL::BIGINT AS total_recipients,
    sc.recipient_count,
    NULL::BIGINT AS attempted,
    sc.sent_count AS delivered,
    sc.sent_count,
    NULL::BIGINT AS hard_bounced,
    NULL::BIGINT AS soft_bounced,
    sc.failed_count AS failed_other,
    sc.failed_count,
    NULL::BIGINT AS opened,
    sc.click_count AS open_count,
    sc.click_count AS clicked,
    sc.click_count,
    sc.unsubscribe_count AS unsubscribed,
    sc.unsubscribe_count,
    CASE 
      WHEN sc.recipient_count > 0 
      THEN ROUND((sc.sent_count::NUMERIC / sc.recipient_count) * 100, 2)
      ELSE 0
    END AS delivery_rate,
    0::NUMERIC AS opening_rate,
    0::NUMERIC AS clicking_rate,
    CASE 
      WHEN sc.recipient_count > 0 
      THEN ROUND((sc.unsubscribe_count::NUMERIC / sc.recipient_count) * 100, 2)
      ELSE 0
    END AS unsubscribe_rate,
    sc.created_at,
    sc.started_at,
    sc.completed_at,
    NULL::BIGINT AS sender_daily_limit,
    NULL::BIGINT AS total_batches,
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
  
  ORDER BY created_at DESC;
END;
$$;