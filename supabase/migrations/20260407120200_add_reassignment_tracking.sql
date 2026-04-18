-- Add columns to track reassignments for gateway failure tolerance
ALTER TABLE private.sms_campaign_recipient_gateways
  ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_gateway_id UUID REFERENCES private.sms_fleet_gateways(id) ON DELETE SET NULL;

-- Add index for querying reassignments
CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipient_gateways_reassigned 
  ON private.sms_campaign_recipient_gateways(campaign_id, reassigned_at) 
  WHERE reassigned_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN private.sms_campaign_recipient_gateways.reassigned_at IS
  'Timestamp when recipient was reassigned to a different gateway due to failure';

COMMENT ON COLUMN private.sms_campaign_recipient_gateways.original_gateway_id IS
  'Original gateway before reassignment occurred';