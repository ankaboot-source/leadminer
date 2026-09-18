-- Harden private.get_mining_source_overview and scope it to one tenant.
--
-- Security: this function was SECURITY DEFINER, took a caller-supplied p_user_id,
-- and never compared it to auth.uid(). It was executable by PUBLIC/anon, so any
-- client could read another tenant's per-source contact counts (IDOR).
--
-- Fix: recreate it as SECURITY INVOKER so RLS scopes every read to the caller,
-- read via the user-scoped contacts function (no more all-tenant aggregation for
-- service-role callers), and revoke EXECUTE from PUBLIC/anon.

CREATE OR REPLACE FUNCTION private.get_mining_source_overview(p_user_id uuid)
RETURNS TABLE(
    source_email           text,
    total_contacts         bigint,
    total_email_contacts   bigint,
    total_phone_contacts   bigint,
    last_mining_date       timestamptz,
    total_from_last_mining bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH source_emails AS (
    SELECT DISTINCT p.source AS src
    FROM private.persons p
    WHERE p.user_id = p_user_id
      AND p.source IS NOT NULL
  ),
  latest_mining_per_source AS (
    SELECT
      p.source AS src,
      p.mining_id,
      MAX(p.created_at) AS mining_date
    FROM private.persons p
    WHERE p.user_id = p_user_id
      AND p.source IS NOT NULL
      AND p.mining_id IS NOT NULL
    GROUP BY p.source, p.mining_id
  ),
  latest_mining AS (
    SELECT DISTINCT ON (src)
      src,
      mining_id,
      mining_date
    FROM latest_mining_per_source
    ORDER BY src, mining_date DESC
  ),
  visible_contacts AS (
    SELECT
      cv.identifier,
      cv.email,
      unnest(cv.sources) AS src,
      cv.mining_id
    FROM private.get_contacts_view(p_user_id) cv
  ),
  total_per_source AS (
    SELECT
      vc.src,
      COUNT(DISTINCT vc.identifier)::bigint                                                       AS total_contacts,
      COUNT(DISTINCT vc.email)        FILTER (WHERE vc.email IS NOT NULL)::bigint               AS total_email_contacts,
      COUNT(DISTINCT vc.identifier)   FILTER (WHERE vc.email IS NULL)::bigint                   AS total_phone_contacts
    FROM visible_contacts vc
    WHERE vc.src IS NOT NULL
    GROUP BY vc.src
  ),
  last_mining_counts AS (
    SELECT
      lm.src,
      COUNT(DISTINCT vc.identifier)::bigint AS total_from_last_mining
    FROM latest_mining lm
    JOIN visible_contacts vc
      ON vc.src = lm.src
     AND lm.mining_id = vc.mining_id
    WHERE lm.mining_id IS NOT NULL
    GROUP BY lm.src
  )
  SELECT
    se.src::text,
    COALESCE(tps.total_contacts, 0)::bigint,
    COALESCE(tps.total_email_contacts, 0)::bigint,
    COALESCE(tps.total_phone_contacts, 0)::bigint,
    lm.mining_date,
    COALESCE(lmc.total_from_last_mining, 0)::bigint
  FROM source_emails se
  LEFT JOIN total_per_source   tps ON tps.src = se.src
  LEFT JOIN latest_mining      lm  ON lm.src = se.src
  LEFT JOIN last_mining_counts lmc ON lmc.src = se.src;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.get_mining_source_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_mining_source_overview(uuid) TO authenticated, service_role;