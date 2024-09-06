-- Order by occurrence, recency, updated_at

DROP FUNCTION get_contacts_table;
CREATE OR REPLACE FUNCTION get_contacts_table(userid uuid) RETURNS TABLE (
	source TEXT,
	email TEXT,
	name TEXT,
	status TEXT,
	image TEXT,
	address TEXT,
	alternate_names TEXT[],
	same_as TEXT[],
	given_name TEXT,
	family_name TEXT,
	job_title TEXT,
	works_for TEXT,
	recency timestamp with time zone,
	seniority timestamp with time zone,
	occurrence INTEGER,
	sender INTEGER,
	recipient INTEGER,
	conversations INTEGER,
	replied_conversations INTEGER,
	tags TEXT []
) AS $$
BEGIN
  RETURN QUERY WITH ExportedContacts AS (
    SELECT
      p.source as source_col,
      p.email as email_col,
      p.name as name_col,
      p.status as status_col,
      p.image as image_col,
      p.address as address_col,
      p.alternate_names as alternate_names_col,
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
      ROW_NUMBER() OVER (
        PARTITION BY p.email
      ) AS rn
    FROM
      persons p
    INNER JOIN
      refinedpersons rp ON rp.email = p.email
    LEFT JOIN
      organizations o ON o.id = p.works_for
    WHERE
      p.user_id = get_contacts_table.userid
    ORDER BY 
      rp.occurrence DESC, rp.recency DESC
	  )
  SELECT
    source_col AS source,
    email_col AS email,
    name_col AS name,
    status_col AS status,
    image_col as image,
    address_col as address,
    alternate_names_col as alternate_names,
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
    tags_col AS tags
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION get_contacts_table_by_emails;
CREATE OR REPLACE FUNCTION get_contacts_table_by_emails(userid uuid, emails TEXT []) RETURNS TABLE (
	source TEXT,
	email TEXT,
	name TEXT,
	status TEXT,
	image TEXT,
	address TEXT,
	alternate_names TEXT[],
	same_as TEXT[],
	given_name TEXT,
	family_name TEXT,
	job_title TEXT,
	works_for TEXT,
	recency TIMESTAMP WITH TIME ZONE,
	seniority TIMESTAMP WITH TIME ZONE,
	occurrence INTEGER,
	sender INTEGER,
	recipient INTEGER,
	conversations INTEGER,
	replied_conversations INTEGER,
	tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY WITH ExportedContacts AS (
    SELECT
      p.source as source_col,
      p.email as email_col,
      p.name as name_col,
      p.status as status_col,
      p.image as image_col,
      p.address as address_col,
      p.alternate_names as alternate_names_col,
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
      ROW_NUMBER() OVER (
      PARTITION BY p.email
      ) AS rn
    FROM
      persons p
    INNER JOIN
      refinedpersons rp ON rp.email = p.email
    LEFT JOIN
      organizations o ON o.id = p.works_for
    WHERE
      p.user_id = get_contacts_table_by_emails.userid
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
    address_col as address,
    alternate_names_col as alternate_names,
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
    tags_col AS tags
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$ LANGUAGE plpgsql;