-- Function to increment gateway sent counters atomically
CREATE OR REPLACE FUNCTION private.increment_gateway_sent_count(
  p_gateway_id UUID,
  p_count INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE private.sms_fleet_gateways
  SET 
    sent_today = sent_today + p_count,
    sent_this_month = sent_this_month + p_count,
    updated_at = NOW()
  WHERE id = p_gateway_id;
END;
$$;

-- Function to batch increment multiple gateways
CREATE OR REPLACE FUNCTION private.batch_increment_gateway_counts(
  p_gateway_ids UUID[],
  p_counts INTEGER[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_gateway_ids, 1) LOOP
    PERFORM private.increment_gateway_sent_count(p_gateway_ids[i], p_counts[i]);
  END LOOP;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION private.increment_gateway_sent_count(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION private.batch_increment_gateway_counts(UUID[], INTEGER[]) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION private.increment_gateway_sent_count(UUID, INTEGER) IS
  'Atomically increments sent_today and sent_this_month counters for a gateway. Used after successful SMS sends in fleet mode.';

COMMENT ON FUNCTION private.batch_increment_gateway_counts(UUID[], INTEGER[]) IS
  'Batch version of increment_gateway_sent_count. Increments counters for multiple gateways in a single transaction.';