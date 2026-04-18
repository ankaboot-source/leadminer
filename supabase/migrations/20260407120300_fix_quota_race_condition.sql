-- Fix Use Case 8: Atomic quota check to prevent race conditions
-- This migration replaces the increment_gateway_sent_count function with atomic version

-- Drop the old function first
DROP FUNCTION IF EXISTS increment_gateway_sent_count(UUID, INTEGER);

-- Create new atomic function with quota validation
CREATE OR REPLACE FUNCTION increment_gateway_sent_count_atomic(
  p_gateway_id UUID,
  p_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_daily_limit INTEGER;
  v_sent_today INTEGER;
BEGIN
  -- Lock the row for update (prevents concurrent modifications)
  SELECT 
    daily_limit,
    sent_today
  INTO 
    v_daily_limit,
    v_sent_today
  FROM private.sms_fleet_gateways
  WHERE id = p_gateway_id
  FOR UPDATE;

  -- Check if gateway exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check quota (0 means unlimited)
  IF v_daily_limit > 0 AND (v_sent_today + p_count) > v_daily_limit THEN
    -- Quota would be exceeded
    RETURN FALSE;
  END IF;

  -- Atomic increment
  UPDATE private.sms_fleet_gateways
  SET 
    sent_today = sent_today + p_count,
    updated_at = NOW()
  WHERE id = p_gateway_id;

  RETURN TRUE;
END;
$$;

-- Add helper function to get current usage with remaining capacity
CREATE OR REPLACE FUNCTION get_gateway_current_usage(
  p_gateway_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  sent_today INTEGER,
  daily_limit INTEGER,
  remaining_capacity INTEGER,
  is_quota_exceeded BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.sent_today,
    g.daily_limit,
    CASE 
      WHEN g.daily_limit = 0 THEN -1  -- Unlimited
      ELSE GREATEST(0, g.daily_limit - g.sent_today)
    END as remaining_capacity,
    CASE 
      WHEN g.daily_limit > 0 AND g.sent_today >= g.daily_limit THEN TRUE
      ELSE FALSE
    END as is_quota_exceeded
  FROM private.sms_fleet_gateways g
  WHERE g.id = ANY(p_gateway_ids);
END;
$$;

-- Add comments
COMMENT ON FUNCTION increment_gateway_sent_count_atomic(UUID, INTEGER) IS
  'Atomically increment sent_today counter with quota validation. Returns TRUE if successful, FALSE if quota exceeded or gateway not found.';

COMMENT ON FUNCTION get_gateway_current_usage(UUID[]) IS
  'Get current usage and remaining capacity for multiple gateways. Returns -1 for remaining_capacity if unlimited.';