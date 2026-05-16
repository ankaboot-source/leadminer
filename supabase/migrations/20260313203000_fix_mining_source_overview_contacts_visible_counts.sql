CREATE OR REPLACE FUNCTION private.get_mining_source_overview(user_id uuid)
RETURNS TABLE(
  source_email text,
  total_contacts bigint,
  last_mining_date timestamptz,
  total_from_last_mining bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH source_emails AS (
    SELECT DISTINCT p.source
    FROM private.persons p
    WHERE p.user_id = get_mining_source_overview.user_id
      AND p.source IS NOT NULL
  ),
  visible_contacts AS (
    SELECT c.source, c.email, c.mining_id
    FROM private.get_contacts_table(get_mining_source_overview.user_id) c
    WHERE c.source IS NOT NULL
  ),
  last_mining AS (
    SELECT
      p.source,
      p.mining_id,
      MAX(p.created_at) AS mining_date
    FROM private.persons p
    WHERE p.user_id = get_mining_source_overview.user_id
      AND p.source IS NOT NULL
      AND p.mining_id IS NOT NULL
    GROUP BY p.source, p.mining_id
  ),
  latest_minings AS (
    SELECT
      lm.source,
      lm.mining_id,
      lm.mining_date,
      ROW_NUMBER() OVER (PARTITION BY lm.source ORDER BY lm.mining_date DESC) AS rn
    FROM last_mining lm
  ),
  total_per_source AS (
    SELECT
      vc.source,
      COUNT(DISTINCT vc.email)::bigint AS total_contacts
    FROM visible_contacts vc
    GROUP BY vc.source
  ),
  last_mining_counts AS (
    SELECT
      lm.source,
      COUNT(DISTINCT vc.email)::bigint AS total_from_last_mining
    FROM latest_minings lm
    LEFT JOIN visible_contacts vc
      ON vc.source = lm.source
      AND vc.mining_id = lm.mining_id
    WHERE lm.rn = 1
    GROUP BY lm.source
  )
  SELECT
    se.source::text,
    COALESCE(tps.total_contacts, 0)::bigint,
    lm.mining_date,
    COALESCE(lmc.total_from_last_mining, 0)::bigint
  FROM source_emails se
  LEFT JOIN total_per_source tps
    ON tps.source = se.source
  LEFT JOIN latest_minings lm
    ON lm.source = se.source
    AND lm.rn = 1
  LEFT JOIN last_mining_counts lmc
    ON lmc.source = se.source;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_mining_source_overview(user_id uuid)
RETURNS TABLE(
    source_email text,
    total_contacts bigint,
    last_mining_date timestamptz,
    total_from_last_mining bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    WITH
    -- All distinct source strings that appear for this user
    source_emails AS (
        SELECT DISTINCT p.source
        FROM private.persons p
        WHERE p.user_id = get_mining_source_overview.user_id
          AND p.source IS NOT NULL
    ),

    -- For each source, the latest mining_id and its timestamp
    latest_mining_per_source AS (
        SELECT
            p.source,
            p.mining_id,
            MAX(p.created_at) AS mining_date
        FROM private.persons p
        WHERE p.user_id = get_mining_source_overview.user_id
          AND p.source IS NOT NULL
          AND p.mining_id IS NOT NULL
        GROUP BY p.source, p.mining_id
        ORDER BY p.source, mining_date DESC
    ),
    -- Pick only the very latest mining_id per source
    latest_mining AS (
        SELECT DISTINCT ON (source)
            source,
            mining_id,
            mining_date
        FROM latest_mining_per_source
        ORDER BY source, mining_date DESC
    ),

    -- Visible contacts (merged) for this user
    visible_contacts AS (
        SELECT
            cv.email,
            unnest(cv.sources) AS src,
            cv.mining_ids
        FROM private.contacts_view cv
        WHERE cv.user_id = get_mining_source_overview.user_id
    ),

    -- Total visible contacts per source
    total_per_source AS (
        SELECT
            vc.src AS source,
            COUNT(DISTINCT vc.email)::bigint AS total_contacts
        FROM visible_contacts vc
        WHERE vc.src IS NOT NULL
        GROUP BY vc.src
    ),

    -- Count of visible contacts that contain the latest mining_id for that source
    last_mining_counts AS (
        SELECT
            lm.source,
            COUNT(DISTINCT vc.email)::bigint AS total_from_last_mining
        FROM latest_mining lm
        JOIN visible_contacts vc
            ON vc.src = lm.source
            AND lm.mining_id = ANY(vc.mining_ids)
        WHERE lm.mining_id IS NOT NULL
        GROUP BY lm.source
    )

    SELECT
        se.source::text,
        COALESCE(tps.total_contacts, 0)::bigint,
        lm.mining_date,
        COALESCE(lmc.total_from_last_mining, 0)::bigint
    FROM source_emails se
    LEFT JOIN total_per_source tps ON tps.source = se.source
    LEFT JOIN latest_mining lm ON lm.source = se.source
    LEFT JOIN last_mining_counts lmc ON lmc.source = se.source;
END;
$$;