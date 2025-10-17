-- mining_id
ALTER TABLE private.persons
ADD COLUMN mining_id text;

-- Update get_contacts_table()
DROP FUNCTION private.get_contacts_table;
CREATE  FUNCTION private.get_contacts_table(user_id uuid) RETURNS TABLE(source text, email text, name text, status text, image text, location text[], alternate_name text[], alternate_email text[], telephone text[], same_as text[], given_name text, family_name text, job_title text, works_for text, recency timestamptz, seniority timestamptz, occurrence integer, temperature integer, sender integer, recipient integer, conversations integer, replied_conversations integer, tags text[], updated_at timestamptz, created_at timestamptz, mining_id text)
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
BEGIN
  RETURN QUERY WITH ExportedContacts AS (
    SELECT
      p.source as source_col,
      p.email as email_col,
      p.name as name_col,
      p.status as status_col,
      p.image as image_col,
      p.location as location_col,
      p.alternate_name as alternate_name_col,
      p.alternate_email as alternate_email_col,
      p.telephone as telephone_col,
      p.same_as as same_as_col,
      p.given_name as given_name_col,
      p.family_name as family_name_col,
      p.job_title as job_title_col,
      o.name as works_for_col,
      rp.recency as recency_col,
      rp.seniority as seniority_col,
      rp.occurrence as occurrence_col,
      rp.temperature as temperature_col,
      rp.sender as sender_col,
      rp.recipient as recipient_col,
      rp.conversations as conversations_col,
      rp.replied_conversations as replied_conversations_col,
      rp.tags as tags_col,
      p.updated_at as updated_at_col,
      p.created_at as created_at_col,
      p.mining_id as mining_id_col,  -- Add mining_id from persons
      ROW_NUMBER() OVER (
        PARTITION BY p.email
      ) AS rn
    FROM
      private.persons p
    INNER JOIN
      private.refinedpersons rp ON rp.email = p.email
    LEFT JOIN
      private.organizations o ON o.id = p.works_for
    WHERE
      p.user_id = get_contacts_table.user_id
    ORDER BY 
      rp.temperature DESC, rp.occurrence DESC, rp.recency DESC
	  )
  SELECT
    source_col AS source,
    email_col AS email,
    name_col AS name,
    status_col AS status,
    image_col as image,
    location_col as location,
    alternate_name_col as alternate_name,
    alternate_email_col as alternate_email,
    telephone_col as telephone,
    same_as_col as same_as,
    given_name_col as given_name,
    family_name_col as family_name,
    job_title_col as job_title,
    works_for_col as works_for,
    recency_col AS recency,
    seniority_col AS seniority,
    occurrence_col AS occurrence,
	temperature_col AS temperature,
    sender_col AS sender,
    recipient_col AS recipient,
    conversations_col AS conversations,
    replied_conversations_col AS replied_conversations,
    tags_col AS tags,
    updated_at_col AS updated_at,
    created_at_col AS created_at,
    mining_id_col AS mining_id  -- Include mining_id in final output
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$;

DROP FUNCTION private.get_contacts_table_by_emails;
CREATE FUNCTION private.get_contacts_table_by_emails(user_id uuid, emails text[]) RETURNS TABLE(source text, email text, name text, status text, image text, location text[], alternate_name text[], alternate_email text[], telephone text[], same_as text[], given_name text, family_name text, job_title text, works_for text, recency timestamptz, seniority timestamptz, occurrence integer, temperature integer, sender integer, recipient integer, conversations integer, replied_conversations integer, tags text[], updated_at timestamptz, created_at timestamptz, mining_id text)
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
BEGIN
  RETURN QUERY WITH ExportedContacts AS (
    SELECT
      p.source as source_col,
      p.email as email_col,
      p.name as name_col,
      p.status as status_col,
      p.image as image_col,
      p.location as location_col,
      p.alternate_name as alternate_name_col,
      P.alternate_email as alternate_email_col,
      p.telephone as telephone_col,
      p.same_as as same_as_col,
      p.given_name as given_name_col,
      p.family_name as family_name_col,
      p.job_title as job_title_col,
      o.name as works_for_col,
      rp.recency as recency_col,
      rp.seniority as seniority_col,
      rp.occurrence as occurrence_col,
      rp.temperature as temperature_col,
      rp.sender as sender_col,
      rp.recipient as recipient_col,
      rp.conversations as conversations_col,
      rp.replied_conversations as replied_conversations_col,
      rp.tags as tags_col,
      p.updated_at as updated_at_col,
      p.created_at as created_at_col,
      p.mining_id as mining_id_col,  -- Add mining_id from persons
      ROW_NUMBER() OVER (
      PARTITION BY p.email
      ) AS rn
    FROM
      private.persons p
    INNER JOIN
      private.refinedpersons rp ON rp.email = p.email
    LEFT JOIN
      private.organizations o ON o.id = p.works_for
    WHERE
      p.user_id = get_contacts_table_by_emails.user_id
    AND
      p.email = ANY(get_contacts_table_by_emails.emails)
	ORDER BY 
      rp.temperature DESC, rp.occurrence DESC, rp.recency DESC
  )
  SELECT
    source_col AS source,
    email_col AS email,
    name_col AS name,
    status_col AS status,
    image_col as image,
    location_col as location,
    alternate_name_col as alternate_name,
    alternate_email_col as alternate_email,
    telephone_col as telephone,
    same_as_col as same_as,
    given_name_col as given_name,
    family_name_col as family_name,
    job_title_col as job_title,
    works_for_col as works_for,
    recency_col AS recency,
    seniority_col AS seniority,
    occurrence_col AS occurrence,  -- Fixed: was missing this column
    temperature_col AS temperature,
    sender_col AS sender,
    recipient_col AS recipient,
    conversations_col AS conversations,
    replied_conversations_col AS replied_conversations,
    tags_col AS tags,
    updated_at_col AS updated_at,
    created_at_col AS created_at,
    mining_id_col AS mining_id  -- Include mining_id in final output
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$;

-- Create get_mining_stats()
CREATE OR REPLACE FUNCTION get_mining_stats(user_id UUID, mining_id text)
RETURNS TABLE(
  total_contacts_mined BIGINT,
  total_reachable BIGINT, 
  total_with_phone BIGINT,
  total_with_company BIGINT
) AS $$
  SELECT 
    COUNT(*) as total_contacts_mined,
    COUNT(*) FILTER (WHERE status = 'VALID') as total_reachable,
    COUNT(telephone) as total_with_phone,
    COUNT(*) FILTER (WHERE job_title IS NOT NULL OR works_for IS NOT NULL) as total_with_company
  FROM private.get_contacts_table($1)
  WHERE mining_id = $2;
$$ LANGUAGE sql;



-- fix get_distinct_or_exclude_from_array():
-- "code": "42804",
-- "details": "text[] versus anyarray",
-- "message": "arguments declared "anyarray" are not all alike"

CREATE OR REPLACE FUNCTION private.get_distinct_or_exclude_from_array(
    input_array text[],
    exclude_array text[] DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN (
        SELECT array_agg(original_value ORDER BY ord)
        FROM (
            SELECT
                unnested AS original_value,
                lower(trim(unnested)) AS normalized_value,
                MIN(array_position(input_array, unnested)) AS ord
            FROM unnest(input_array) unnested
            WHERE unnested IS NOT NULL
            GROUP BY normalized_value, original_value
        ) dedup
        WHERE exclude_array IS NULL
           OR NOT EXISTS (
                SELECT 1
                FROM unnest(exclude_array) e
                WHERE e IS NOT NULL
                  AND (lower(trim(e)) = normalized_value OR normalized_value LIKE '%' || lower(trim(e)) || '%')
            )
    );
END;
$$;