ALTER TABLE private.persons
    ADD COLUMN alternate_email text[];

ALTER TABLE private.pointsofcontact
    ADD COLUMN plus_address text;

DROP FUNCTION private.get_contacts_table;
CREATE FUNCTION private.get_contacts_table(user_id uuid) RETURNS TABLE(source text, email text, name text, status text, image text, location text[], alternate_name text[], alternate_email text[], same_as text[], given_name text, family_name text, job_title text, works_for text, recency timestamp with time zone, seniority timestamp with time zone, occurrence integer, sender integer, recipient integer, conversations integer, replied_conversations integer, tags text[], updated_at timestamp without time zone, created_at timestamp without time zone)
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
      p.same_as as same_as_col,
      p.given_name as given_name_col,
      p.family_name as family_name_col,
      p.job_title as job_title_col,
      o.name as works_for_col,
      rp.recency as recency_col,
      rp.seniority as seniority_col,
      rp.occurrence as occurrence_col,
      rp.sender as sender_col,
      rp.recipient as recipient_col,
      rp.conversations as conversations_col,
      rp.replied_conversations as replied_conversations_col,
      rp.tags as tags_col,
      p.updated_at as updated_at_col,
      p.created_at as created_at_col,
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
      rp.occurrence DESC, rp.recency DESC
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
    same_as_col as same_as,
    given_name_col as given_name,
    family_name_col as family_name,
    job_title_col as job_title,
    works_for_col as works_for,
    recency_col AS recency,
    seniority_col AS seniority,
    occurrence_col AS occurrence,
    sender_col AS sender,
    recipient_col AS recipient,
    conversations_col AS conversations,
    replied_conversations_col AS replied_conversations,
    tags_col AS tags,
	updated_at_col AS updated_at,
	created_at_col AS created_at
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$;

DROP FUNCTION private.get_contacts_table_by_emails;
CREATE FUNCTION private.get_contacts_table_by_emails(user_id uuid, emails text[]) RETURNS TABLE(source text, email text, name text, status text, image text, location text[], alternate_name text[], alternate_email text[], same_as text[], given_name text, family_name text, job_title text, works_for text, recency timestamp with time zone, seniority timestamp with time zone, occurrence integer, sender integer, recipient integer, conversations integer, replied_conversations integer, tags text[], updated_at timestamp without time zone, created_at timestamp without time zone)
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
      p.same_as as same_as_col,
      p.given_name as given_name_col,
      p.family_name as family_name_col,
      p.job_title as job_title_col,
      o.name as works_for_col,
      rp.recency as recency_col,
      rp.seniority as seniority_col,
      rp.occurrence as occurrence_col,
      rp.sender as sender_col,
      rp.recipient as recipient_col,
      rp.conversations as conversations_col,
      rp.replied_conversations as replied_conversations_col,
      rp.tags as tags_col,
      p.updated_at as updated_at_col,
      p.created_at as created_at_col,
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
      rp.occurrence DESC, rp.recency DESC
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
    same_as_col as same_as,
    given_name_col as given_name,
    family_name_col as family_name,
    job_title_col as job_title,
    works_for_col as works_for,
    recency_col AS recency,
    seniority_col AS seniority,
    occurrence_col AS occurrence,
    sender_col AS sender,
    recipient_col AS recipient,
    conversations_col AS conversations,
    replied_conversations_col AS replied_conversations,
    tags_col AS tags,
	updated_at_col AS updated_at,
	created_at_col AS created_at
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$;
