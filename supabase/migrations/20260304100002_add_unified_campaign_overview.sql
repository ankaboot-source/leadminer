-- Unified campaign overview that returns both email and SMS campaigns with channel field
CREATE OR REPLACE FUNCTION private.get_unified_campaigns_overview()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  channel TEXT,
  status TEXT,
  recipient_count INTEGER,
  sent_count INTEGER,
  failed_count INTEGER,
  click_count INTEGER,
  unsubscribe_count INTEGER,
  open_count INTEGER,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH 
    email_stats AS (
      SELECT
        r.campaign_id,
        COUNT(*) FILTER (WHERE r.send_status = 'sent')::INTEGER AS delivered,
        COUNT(*) FILTER (WHERE r.send_status IN ('sent', 'failed'))::INTEGER AS attempted
      FROM private.email_campaign_recipients r
      WHERE r.user_id = auth.uid()
      GROUP BY r.campaign_id
    ),
    email_opens AS (
      SELECT e.campaign_id, COUNT(DISTINCT e.recipient_id)::INTEGER AS opened
      FROM private.email_campaign_events e
      JOIN private.email_campaign_recipients r ON r.id = e.recipient_id
      WHERE e.event_type = 'open' AND r.user_id = auth.uid()
      GROUP BY e.campaign_id
    ),
    email_clicks AS (
      SELECT e.campaign_id, COUNT(DISTINCT e.recipient_id)::INTEGER AS clicked
      FROM private.email_campaign_events e
      JOIN private.email_campaign_recipients r ON r.id = e.recipient_id
      WHERE e.event_type = 'click' AND r.user_id = auth.uid()
      GROUP BY e.campaign_id
    ),
    email_unsubscribes AS (
      SELECT e.campaign_id, COUNT(DISTINCT e.recipient_id)::INTEGER AS unsubscribed
      FROM private.email_campaign_events e
      JOIN private.email_campaign_recipients r ON r.id = e.recipient_id
      WHERE e.event_type = 'unsubscribe' AND r.user_id = auth.uid()
      GROUP BY e.campaign_id
    ),
    email_link_clicks AS (
      SELECT e.campaign_id, COUNT(*)::INTEGER AS click_count
      FROM private.email_campaign_events e
      JOIN private.email_campaign_recipients r ON r.id = e.recipient_id
      WHERE e.event_type = 'click' AND e.url IS NOT NULL AND r.user_id = auth.uid()
      GROUP BY e.campaign_id
    ),
    sms_clicks AS (
      SELECT campaign_id, COUNT(*)::INTEGER AS click_count
      FROM private.sms_campaign_link_clicks
      GROUP BY campaign_id
    ),
    sms_unsubscribes AS (
      SELECT campaign_id, COUNT(*)::INTEGER AS unsubscribe_count
      FROM private.sms_campaign_unsubscribes
      GROUP BY campaign_id
    )
  SELECT 
    c.id,
    c.user_id,
    'email'::TEXT AS channel,
    c.status::TEXT,
    c.total_recipients AS recipient_count,
    COALESCE(es.delivered, 0) AS sent_count,
    (COALESCE(es.attempted, 0) - COALESCE(es.delivered, 0)) AS failed_count,
    COALESCE(elc.click_count, 0) AS click_count,
    COALESCE(eu.unsubscribed, 0) AS unsubscribe_count,
    COALESCE(eo.opened, 0) AS open_count,
    c.created_at,
    c.started_at,
    c.completed_at
  FROM private.email_campaigns c
  LEFT JOIN email_stats es ON es.campaign_id = c.id
  LEFT JOIN email_opens eo ON eo.campaign_id = c.id
  LEFT JOIN email_clicks ec ON ec.campaign_id = c.id
  LEFT JOIN email_unsubscribes eu ON eu.campaign_id = c.id
  LEFT JOIN email_link_clicks elc ON elc.campaign_id = c.id
  WHERE c.user_id = auth.uid()
  
  UNION ALL
  
  SELECT 
    s.id,
    s.user_id,
    'sms'::TEXT AS channel,
    s.status::TEXT,
    s.recipient_count,
    s.sent_count,
    s.failed_count,
    COALESCE(sc.click_count, 0) AS click_count,
    COALESCE(su.unsubscribe_count, 0) AS unsubscribe_count,
    NULL::INTEGER AS open_count,
    s.created_at,
    s.started_at,
    s.completed_at
  FROM private.sms_campaigns s
  LEFT JOIN sms_clicks sc ON sc.campaign_id = s.id
  LEFT JOIN sms_unsubscribes su ON su.campaign_id = s.id
  WHERE s.user_id = auth.uid()
  ORDER BY created_at DESC;
END;
$$;