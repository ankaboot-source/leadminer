-- Function to get SMS campaign overview
CREATE OR REPLACE FUNCTION private.get_sms_campaigns_overview()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  sender_name TEXT,
  sender_phone TEXT,
  provider TEXT,
  status private.sms_campaign_status,
  recipient_count INTEGER,
  sent_count INTEGER,
  failed_count INTEGER,
  click_count INTEGER,
  unsubscribe_count INTEGER,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.sender_name,
    c.sender_phone,
    c.provider,
    c.status,
    c.recipient_count,
    c.sent_count,
    c.failed_count,
    COALESCE(
      (SELECT COUNT(*) FROM private.sms_campaign_link_clicks cl 
       WHERE cl.campaign_id = c.id),
      0
    )::INTEGER AS click_count,
    COALESCE(
      (SELECT COUNT(*) FROM private.sms_campaign_unsubscribes u 
       WHERE u.campaign_id = c.id),
      0
    )::INTEGER AS unsubscribe_count,
    c.created_at,
    c.started_at,
    c.completed_at
  FROM private.sms_campaigns c
  WHERE c.user_id = auth.uid()
  ORDER BY c.created_at DESC;
END;
$$;