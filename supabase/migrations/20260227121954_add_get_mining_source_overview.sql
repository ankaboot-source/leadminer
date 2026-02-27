CREATE OR REPLACE FUNCTION private.get_mining_source_overview(user_id uuid)
RETURNS TABLE(
  source_email text,
  total_contacts bigint,
  last_mining_date timestamptz,
  total_from_last_mining bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH source_emails AS (
    SELECT DISTINCT source FROM private.persons p
    WHERE p.user_id = get_mining_source_overview.user_id AND source IS NOT NULL
  ),
  last_mining AS (
    SELECT 
      p.source,
      p.mining_id,
      MAX(p.created_at) as mining_date
    FROM private.persons p
    WHERE p.user_id = get_mining_source_overview.user_id AND p.source IS NOT NULL
    GROUP BY p.source, p.mining_id
  ),
  latest_minings AS (
    SELECT 
      source,
      mining_id,
      mining_date,
      ROW_NUMBER() OVER (PARTITION BY source ORDER BY mining_date DESC) as rn
    FROM last_mining
  ),
  total_per_source AS (
    SELECT 
      source,
      COUNT(*)::bigint as total_contacts
    FROM private.persons p
    WHERE p.user_id = get_mining_source_overview.user_id AND source IS NOT NULL
    GROUP BY source
  ),
  last_mining_counts AS (
    SELECT 
      lm.source,
      COUNT(p.email)::bigint as total_from_last_mining
    FROM latest_minings lm
    JOIN private.persons p ON p.mining_id = lm.mining_id AND p.source = lm.source
    WHERE lm.rn = 1
    GROUP BY lm.source
  )
  SELECT 
    se.source::text,
    COALESCE(tps.total_contacts, 0)::bigint,
    lm.mining_date,
    COALESCE(lmc.total_from_last_mining, 0)::bigint
  FROM source_emails se
  LEFT JOIN total_per_source tps ON tps.source = se.source
  LEFT JOIN latest_minings lm ON lm.source = se.source AND lm.rn = 1
  LEFT JOIN last_mining_counts lmc ON lmc.source = se.source;
END;
$$;
