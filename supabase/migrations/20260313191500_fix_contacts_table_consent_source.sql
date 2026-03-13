-- Recreate contacts RPCs to read consent from persons.
--
-- Why this exists:
-- A previous migration file was edited after some environments had already applied it.
-- Those environments still have RPC definitions referencing rp.consent_status.
-- After dropping consent columns from refinedpersons, RPC calls fail with:
-- "column rp.consent_status does not exist".

DROP FUNCTION IF EXISTS private.get_contacts_table(uuid);
CREATE FUNCTION private.get_contacts_table(user_id uuid)
RETURNS TABLE(
  source text,
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
  SELECT DISTINCT ON (p.email)
    p.source,
    p.email,
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
    o.name,
    rp.recency,
    rp.seniority,
    rp.occurrence,
    rp.temperature,
    rp.sender,
    rp.recipient,
    rp.conversations,
    rp.replied_conversations,
    rp.tags,
    p.updated_at::timestamptz,
    p.created_at::timestamptz,
    p.mining_id
  FROM private.persons p
  INNER JOIN private.refinedpersons rp
    ON rp.email = p.email
    AND rp.user_id = p.user_id
  LEFT JOIN private.organizations o
    ON o.id = p.works_for
  WHERE p.user_id = get_contacts_table.user_id
  ORDER BY p.email, rp.temperature DESC, rp.occurrence DESC, rp.recency DESC;
END;
$$;

DROP FUNCTION IF EXISTS private.get_contacts_table_by_emails(uuid, text[]);
CREATE FUNCTION private.get_contacts_table_by_emails(user_id uuid, emails text[])
RETURNS TABLE(
  source text,
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
  WITH requested_emails AS (
    SELECT UNNEST(get_contacts_table_by_emails.emails) AS email
  )
  SELECT DISTINCT ON (p.email)
    p.source,
    p.email,
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
    o.name,
    rp.recency,
    rp.seniority,
    rp.occurrence,
    rp.temperature,
    rp.sender,
    rp.recipient,
    rp.conversations,
    rp.replied_conversations,
    rp.tags,
    p.updated_at::timestamptz,
    p.created_at::timestamptz,
    p.mining_id
  FROM requested_emails re
  INNER JOIN private.persons p
    ON p.email = re.email
  INNER JOIN private.refinedpersons rp
    ON rp.email = p.email
    AND rp.user_id = p.user_id
  LEFT JOIN private.organizations o
    ON o.id = p.works_for
  WHERE p.user_id = get_contacts_table_by_emails.user_id
  ORDER BY p.email, rp.temperature DESC, rp.occurrence DESC, rp.recency DESC;
END;
$$;
