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
  v_user_id UUID;
BEGIN
  SELECT pt.user_id INTO v_user_id 
  FROM private.tasks pt
  WHERE pt.details->>'miningId' = $1
    AND pt.status = 'done'
  ORDER BY pt.started_at DESC
  LIMIT 1;

  RETURN QUERY
  SELECT 
    v_user_id,
    (SELECT p.source FROM private.persons p WHERE p.mining_id = $1 LIMIT 1) AS source,
    COUNT(*) AS total_contacts_mined,
    COUNT(*) FILTER (WHERE contacts.status = 'VALID') AS total_reachable,
    COUNT(contacts.telephone) AS total_with_phone,
    COUNT(*) FILTER (WHERE contacts.job_title IS NOT NULL OR contacts.works_for IS NOT NULL) AS total_with_company,
    COUNT(*) FILTER (WHERE contacts.location IS NOT NULL AND contacts.location <> '') AS total_with_location
  FROM private.get_contacts_table(v_user_id) AS contacts
  WHERE contacts.mining_id = $1;
END;
$$ LANGUAGE plpgsql SET search_path = '';
