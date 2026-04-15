-- Add pagination support for contacts table
-- Functions for lazy loading with limit/offset

-- Function to get total contacts count for a user
DROP FUNCTION IF EXISTS private.get_contacts_count(uuid);
CREATE FUNCTION private.get_contacts_count(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  count integer;
BEGIN
  SELECT COUNT(DISTINCT p.email)::integer INTO count
  FROM private.persons p
  INNER JOIN private.refinedpersons rp
    ON rp.email = p.email
    AND rp.user_id = p.user_id
  WHERE p.user_id = get_contacts_count.user_id;

  RETURN COALESCE(count, 0);
END;
$$;

-- Function to get paginated contacts with limit and offset
DROP FUNCTION IF EXISTS private.get_contacts_page(uuid, integer, integer);
CREATE FUNCTION private.get_contacts_page(
  user_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
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
  WHERE p.user_id = get_contacts_page.user_id
  ORDER BY p.email, rp.temperature DESC, rp.occurrence DESC, rp.recency DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;