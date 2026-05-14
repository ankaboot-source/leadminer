-- Merge contacts from multiple sources (IMAP + Google Contacts) into unified records.
--
-- Before: One row per (email, source) combination
-- After: One row per email with merged data
--
-- Key changes:
-- - source text → source text[] (array of all source values)
-- - Single-value fields: IMAP wins over Google Contacts
-- - Array fields: merge + deduplicate
-- - Stats fields: sum from all rows
-- - Timestamps: MAX

DROP FUNCTION IF EXISTS private.get_contacts_table(uuid);
CREATE FUNCTION private.get_contacts_table(user_id uuid)
RETURNS TABLE(
  source text[],
  email text,
  name text,
  status text,
  consent_status private.contact_consent_status,
  consent_changed_at timestamptz,
  image text,
  location text,
  location_normalized jsonb,
  alternate_name text[],
  alternate_email text[],
  telephone text[],
  same_as text[],
  given_name text,
  family_name text,
  job_title text,
  works_for text,
  recency timestamptz,
  seniority timestamptz,
  occurrence integer,
  temperature integer,
  sender integer,
  recipient integer,
  conversations integer,
  replied_conversations integer,
  tags text[],
  updated_at timestamptz,
  created_at timestamptz,
  mining_id text
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH
  all_persons AS (
    SELECT
      p.email,
      p.source,
      p.name,
      p.status,
      p.consent_status,
      p.consent_changed_at,
      p.image,
      p.location,
      p.location_normalized,
      p.alternate_name,
      p.alternate_email,
      p.telephone,
      p.same_as,
      p.given_name,
      p.family_name,
      p.job_title,
      p.works_for,
      p.updated_at,
      p.created_at,
      p.mining_id,
      rp.temperature,
      rp.occurrence,
      rp.recency,
      rp.seniority,
      rp.sender,
      rp.recipient,
      rp.conversations,
      rp.replied_conversations,
      rp.tags,
      CASE WHEN p.source NOT LIKE 'google-contacts:%' THEN 1 ELSE 2 END AS source_priority
    FROM private.persons p
    INNER JOIN private.refinedpersons rp
      ON rp.email = p.email
      AND rp.user_id = p.user_id
    WHERE p.user_id = get_contacts_table.user_id
  ),
  aggregated AS (
    SELECT
      email,
      array_remove_nulls(array_agg(DISTINCT source)) AS source,
      (
        SELECT ap.name FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.name IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS name,
      (
        SELECT ap.status FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.status IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS status,
      (
        SELECT ap.consent_status FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.consent_status IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS consent_status,
      (
        SELECT ap.consent_changed_at FROM all_persons ap
        WHERE ap.email = agg.email AND ap.consent_changed_at IS NOT NULL
        ORDER BY ap.source_priority ASC, ap.temperature DESC LIMIT 1
      ) AS consent_changed_at,
      (
        SELECT ap.image FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.image IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS image,
      (
        SELECT ap.location FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.location IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS location,
      (
        SELECT ap.location_normalized FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.location_normalized IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS location_normalized,
      (
        SELECT ap.given_name FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.given_name IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS given_name,
      (
        SELECT ap.family_name FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.family_name IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS family_name,
      (
        SELECT ap.job_title FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.job_title IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS job_title,
      (
        SELECT ap.works_for FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.works_for IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS works_for,
      (
        SELECT ap.mining_id FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.mining_id IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS mining_id,
      SUM(agg.occurrence) AS occurrence,
      SUM(agg.temperature) AS temperature,
      MAX(agg.recency) AS recency,
      MAX(agg.seniority) AS seniority,
      SUM(agg.sender) AS sender,
      SUM(agg.recipient) AS recipient,
      SUM(agg.conversations) AS conversations,
      SUM(agg.replied_conversations) AS replied_conversations,
      MAX(agg.updated_at) AS updated_at,
      MAX(agg.created_at) AS created_at
    FROM all_persons agg
    GROUP BY email
  ),
  -- Collect all array values per email using LATERAL unnest
  array_vals AS (
    SELECT DISTINCT ON (av.email, av.arr_type)
      av.email,
      av.arr_type,
      array_remove_nulls(array_agg(DISTINCT av.val) OVER (PARTITION BY av.email, av.arr_type)) AS vals
    FROM (
      SELECT email, 'alternate_name' AS arr_type, elem AS val FROM aggregated a CROSS JOIN LATERAL unnest(COALESCE(a.alternate_name, ARRAY[]::text[])) AS e(elem)
      UNION ALL
      SELECT email, 'alternate_email', elem FROM aggregated a CROSS JOIN LATERAL unnest(COALESCE(a.alternate_email, ARRAY[]::text[])) AS e(elem)
      UNION ALL
      SELECT email, 'telephone', elem FROM aggregated a CROSS JOIN LATERAL unnest(COALESCE(a.telephone, ARRAY[]::text[])) AS e(elem)
      UNION ALL
      SELECT email, 'same_as', elem FROM aggregated a CROSS JOIN LATERAL unnest(COALESCE(a.same_as, ARRAY[]::text[])) AS e(elem)
      UNION ALL
      SELECT email, 'tags', elem FROM aggregated a CROSS JOIN LATERAL unnest(COALESCE(a.tags, ARRAY[]::text[])) AS e(elem)
    ) AS av(elem)
    ORDER BY av.email, av.arr_type
  )
  SELECT
    a.source,
    a.email,
    a.name,
    a.status,
    a.consent_status,
    a.consent_changed_at,
    a.image,
    a.location,
    a.location_normalized,
    COALESCE((SELECT vals FROM array_vals v WHERE v.email = a.email AND v.arr_type = 'alternate_name'), ARRAY[]::text[]) AS alternate_name,
    COALESCE((SELECT vals FROM array_vals v WHERE v.email = a.email AND v.arr_type = 'alternate_email'), ARRAY[]::text[]) AS alternate_email,
    COALESCE((SELECT vals FROM array_vals v WHERE v.email = a.email AND v.arr_type = 'telephone'), ARRAY[]::text[]) AS telephone,
    COALESCE((SELECT vals FROM array_vals v WHERE v.email = a.email AND v.arr_type = 'same_as'), ARRAY[]::text[]) AS same_as,
    a.given_name,
    a.family_name,
    a.job_title,
    o.name AS works_for,
    a.recency,
    a.seniority,
    a.occurrence,
    a.temperature,
    a.sender,
    a.recipient,
    a.conversations,
    a.replied_conversations,
    COALESCE((SELECT vals FROM array_vals v WHERE v.email = a.email AND v.arr_type = 'tags'), ARRAY[]::text[]) AS tags,
    a.updated_at,
    a.created_at,
    a.mining_id
  FROM aggregated a
  LEFT JOIN private.organizations o ON o.id = a.works_for;
END;
$$;

DROP FUNCTION IF EXISTS private.get_contacts_table_by_emails(uuid, text[]);
CREATE FUNCTION private.get_contacts_table_by_emails(user_id uuid, emails text[])
RETURNS TABLE(
  source text[],
  email text,
  name text,
  status text,
  consent_status private.contact_consent_status,
  consent_changed_at timestamptz,
  image text,
  location text,
  location_normalized jsonb,
  alternate_name text[],
  alternate_email text[],
  telephone text[],
  same_as text[],
  given_name text,
  family_name text,
  job_title text,
  works_for text,
  recency timestamptz,
  seniority timestamptz,
  occurrence integer,
  temperature integer,
  sender integer,
  recipient integer,
  conversations integer,
  replied_conversations integer,
  tags text[],
  updated_at timestamptz,
  created_at timestamptz,
  mining_id text
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH
  requested_emails AS (
    SELECT UNNEST(get_contacts_table_by_emails.emails) AS email
  ),
  all_persons AS (
    SELECT
      p.email,
      p.source,
      p.name,
      p.status,
      p.consent_status,
      p.consent_changed_at,
      p.image,
      p.location,
      p.location_normalized,
      p.alternate_name,
      p.alternate_email,
      p.telephone,
      p.same_as,
      p.given_name,
      p.family_name,
      p.job_title,
      p.works_for,
      p.updated_at,
      p.created_at,
      p.mining_id,
      rp.temperature,
      rp.occurrence,
      rp.recency,
      rp.seniority,
      rp.sender,
      rp.recipient,
      rp.conversations,
      rp.replied_conversations,
      rp.tags,
      CASE WHEN p.source NOT LIKE 'google-contacts:%' THEN 1 ELSE 2 END AS source_priority
    FROM requested_emails re
    INNER JOIN private.persons p
      ON p.email = re.email
    INNER JOIN private.refinedpersons rp
      ON rp.email = p.email
      AND rp.user_id = p.user_id
    WHERE p.user_id = get_contacts_table_by_emails.user_id
  ),
  aggregated AS (
    SELECT
      email,
      array_remove_nulls(array_agg(DISTINCT source)) AS source,
      (
        SELECT ap.name FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.name IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS name,
      (
        SELECT ap.status FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.status IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS status,
      (
        SELECT ap.consent_status FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.consent_status IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS consent_status,
      (
        SELECT ap.consent_changed_at FROM all_persons ap
        WHERE ap.email = agg.email AND ap.consent_changed_at IS NOT NULL
        ORDER BY ap.source_priority ASC, ap.temperature DESC LIMIT 1
      ) AS consent_changed_at,
      (
        SELECT ap.image FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.image IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS image,
      (
        SELECT ap.location FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.location IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS location,
      (
        SELECT ap.location_normalized FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.location_normalized IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS location_normalized,
      (
        SELECT ap.given_name FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.given_name IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS given_name,
      (
        SELECT ap.family_name FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.family_name IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS family_name,
      (
        SELECT ap.job_title FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.job_title IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS job_title,
      (
        SELECT ap.works_for FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.works_for IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS works_for,
      (
        SELECT ap.mining_id FROM all_persons ap
        WHERE ap.email = agg.email AND ap.source_priority = 1 AND ap.mining_id IS NOT NULL
        ORDER BY ap.temperature DESC, ap.occurrence DESC LIMIT 1
      ) AS mining_id,
      SUM(agg.occurrence) AS occurrence,
      SUM(agg.temperature) AS temperature,
      MAX(agg.recency) AS recency,
      MAX(agg.seniority) AS seniority,
      SUM(agg.sender) AS sender,
      SUM(agg.recipient) AS recipient,
      SUM(agg.conversations) AS conversations,
      SUM(agg.replied_conversations) AS replied_conversations,
      MAX(agg.updated_at) AS updated_at,
      MAX(agg.created_at) AS created_at
    FROM all_persons agg
    GROUP BY email
  ),
  array_vals AS (
    SELECT DISTINCT ON (av.email, av.arr_type)
      av.email,
      av.arr_type,
      array_remove_nulls(array_agg(DISTINCT av.val) OVER (PARTITION BY av.email, av.arr_type)) AS vals
    FROM (
      SELECT email, 'alternate_name' AS arr_type, elem AS val FROM aggregated a CROSS JOIN LATERAL unnest(COALESCE(a.alternate_name, ARRAY[]::text[])) AS e(elem)
      UNION ALL
      SELECT email, 'alternate_email', elem FROM aggregated a CROSS JOIN LATERAL unnest(COALESCE(a.alternate_email, ARRAY[]::text[])) AS e(elem)
      UNION ALL
      SELECT email, 'telephone', elem FROM aggregated a CROSS JOIN LATERAL unnest(COALESCE(a.telephone, ARRAY[]::text[])) AS e(elem)
      UNION ALL
      SELECT email, 'same_as', elem FROM aggregated a CROSS JOIN LATERAL unnest(COALESCE(a.same_as, ARRAY[]::text[])) AS e(elem)
      UNION ALL
      SELECT email, 'tags', elem FROM aggregated a CROSS JOIN LATERAL unnest(COALESCE(a.tags, ARRAY[]::text[])) AS e(elem)
    ) AS av(elem)
    ORDER BY av.email, av.arr_type
  )
  SELECT
    a.source,
    a.email,
    a.name,
    a.status,
    a.consent_status,
    a.consent_changed_at,
    a.image,
    a.location,
    a.location_normalized,
    COALESCE((SELECT vals FROM array_vals v WHERE v.email = a.email AND v.arr_type = 'alternate_name'), ARRAY[]::text[]) AS alternate_name,
    COALESCE((SELECT vals FROM array_vals v WHERE v.email = a.email AND v.arr_type = 'alternate_email'), ARRAY[]::text[]) AS alternate_email,
    COALESCE((SELECT vals FROM array_vals v WHERE v.email = a.email AND v.arr_type = 'telephone'), ARRAY[]::text[]) AS telephone,
    COALESCE((SELECT vals FROM array_vals v WHERE v.email = a.email AND v.arr_type = 'same_as'), ARRAY[]::text[]) AS same_as,
    a.given_name,
    a.family_name,
    a.job_title,
    o.name AS works_for,
    a.recency,
    a.seniority,
    a.occurrence,
    a.temperature,
    a.sender,
    a.recipient,
    a.conversations,
    a.replied_conversations,
    COALESCE((SELECT vals FROM array_vals v WHERE v.email = a.email AND v.arr_type = 'tags'), ARRAY[]::text[]) AS tags,
    a.updated_at,
    a.created_at,
    a.mining_id
  FROM aggregated a
  LEFT JOIN private.organizations o ON o.id = a.works_for;
END;
$$;