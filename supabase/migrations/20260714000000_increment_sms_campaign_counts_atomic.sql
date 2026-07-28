-- Increment SMS campaign sent/failed counts atomically per-recipient
-- This gives users real-time visibility into delivery progress while a campaign is processing

-- Drop existing function first for idempotency
DROP FUNCTION IF EXISTS private.increment_sms_campaign_counts_atomic(UUID, INTEGER, INTEGER);

-- Atomically increment sent_count and/or failed_count on a campaign row
-- Returns TRUE if updated, FALSE if campaign is in a terminal status (completed/failed/cancelled)
-- or if the campaign row was not found.
CREATE OR REPLACE FUNCTION private.increment_sms_campaign_counts_atomic(
  p_campaign_id UUID,
  p_sent_increment INTEGER DEFAULT 0,
  p_failed_increment INTEGER DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_current_status private.sms_campaign_status;
  v_current_sent_count INTEGER;
  v_current_failed_count INTEGER;
  v_new_sent_count INTEGER;
  v_new_failed_count INTEGER;
BEGIN
  -- Lock the row for update to prevent concurrent modifications
  SELECT status, sent_count, failed_count
    INTO v_current_status, v_current_sent_count, v_current_failed_count
    FROM private.sms_campaigns
   WHERE id = p_campaign_id
   FOR UPDATE;

  -- Check if campaign exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Guard: do not update counters on terminal campaigns
  IF v_current_status IN ('completed', 'failed', 'cancelled') THEN
    RETURN FALSE;
  END IF;

  -- Compute new totals, ensure they don't go negative
  v_new_sent_count   := GREATEST(0, v_current_sent_count   + p_sent_increment);
  v_new_failed_count := GREATEST(0, v_current_failed_count + p_failed_increment);

  -- Atomic increment
  UPDATE private.sms_campaigns
  SET
    sent_count   = v_new_sent_count,
    failed_count = v_new_failed_count
  WHERE id = p_campaign_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION private.increment_sms_campaign_counts_atomic(UUID, INTEGER, INTEGER) IS
  'Atomically increment sent_count and/or failed_count for an SMS campaign. Returns TRUE on success, FALSE if campaign not found or in a terminal status. Uses FOR UPDATE lock to prevent race conditions.';