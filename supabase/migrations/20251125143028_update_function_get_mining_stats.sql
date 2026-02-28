DROP FUNCTION IF EXISTS private.get_mining_stats(text);

CREATE FUNCTION private.get_mining_stats(mining_id text)
RETURNS TABLE(
  user_id UUID,
  source text,
  total_contacts_mined BIGINT,
  total_reachable BIGINT, 
  total_with_phone BIGINT,
  total_with_company BIGINT,
  total_with_location BIGINT
) AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get the user_id first
  SELECT pt.user_id INTO user_id 
  FROM private.tasks pt
  WHERE pt.details->>'miningId' = $1
    AND pt.status = 'done'
  ORDER BY pt.started_at DESC
  LIMIT 1;

  -- Return the statistics
  RETURN QUERY
  SELECT 
    user_id,
    (SELECT p.source FROM private.persons p WHERE p.mining_id = $1 LIMIT 1) AS source,
    COUNT(*) AS total_contacts_mined,
    COUNT(*) FILTER (WHERE contacts.status = 'VALID') AS total_reachable,
    COUNT(contacts.telephone) AS total_with_phone,
    COUNT(*) FILTER (WHERE contacts.job_title IS NOT NULL OR contacts.works_for IS NOT NULL) AS total_with_company,
    COUNT(*) FILTER (WHERE contacts.locations IS NOT NULL AND contacts.locations <> '') AS total_with_location
  FROM private.get_contacts_table(user_id) AS contacts
  WHERE contacts.mining_id = $1;
END;
$$ LANGUAGE plpgsql;
