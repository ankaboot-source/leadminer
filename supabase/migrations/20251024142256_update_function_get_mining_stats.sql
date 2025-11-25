
-- Get user_id from tasks, because there could be a mining with no new contacts
CREATE OR REPLACE FUNCTION private.get_mining_stats(mining_id text)
RETURNS TABLE(
  user_id UUID,
  source text,
  total_contacts_mined BIGINT,
  total_reachable BIGINT, 
  total_with_phone BIGINT,
  total_with_company BIGINT
) AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get the user_id first
  SELECT p.user_id INTO user_id 
  FROM private.tasks p
  WHERE p.details->>'miningId' = $1
    AND p.status = 'done'
  LIMIT 1;

  -- Return the statistics
  RETURN QUERY
  SELECT 
    user_id,
    (SELECT p.source FROM private.persons p WHERE p.mining_id = $1 LIMIT 1) AS source,
    COUNT(*) AS total_contacts_mined,
    COUNT(*) FILTER (WHERE status = 'VALID') AS total_reachable,
    COUNT(telephone) AS total_with_phone,
    COUNT(*) FILTER (WHERE job_title IS NOT NULL OR works_for IS NOT NULL) AS total_with_company
  FROM private.get_contacts_table(user_id) AS contacts
  WHERE contacts.mining_id = $1;
END;
$$ LANGUAGE plpgsql;