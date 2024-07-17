-- Add persons data to get_contacts_table functions
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
      pr.email as source_col,
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
        ORDER BY rp.recency DESC
      ) AS rn
    FROM
      persons p
    INNER JOIN
      refinedpersons rp ON rp.email = p.email
    INNER JOIN
      public.profiles pr ON pr.user_id = p.user_id
    LEFT JOIN
		  organizations o ON o.id = p.works_for
    WHERE
      p.user_id = get_contacts_table.userid
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
      pr.email as source_col,
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
        ORDER BY rp.recency DESC
      ) AS rn
    FROM
      persons p
    INNER JOIN
      refinedpersons rp ON rp.email = p.email
    INNER JOIN
      public.profiles pr ON pr.user_id = p.user_id
    LEFT JOIN
		  organizations o ON o.id = p.works_for
    WHERE
      p.user_id = get_contacts_table_by_emails.userid
    AND
      p.email = ANY(get_contacts_table_by_emails.emails)
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

CREATE FUNCTION update_contact_by_email(
	user_id uuid,
    email TEXT,
    given_name TEXT DEFAULT NULL,
    family_name TEXT DEFAULT NULL,
    alternate_names TEXT[] DEFAULT NULL,
    address TEXT DEFAULT NULL,
    works_for TEXT DEFAULT NULL,
    job_title TEXT DEFAULT NULL,
    same_as TEXT[] DEFAULT NULL,
    image TEXT DEFAULT NULL
)
RETURNS VOID
AS
$$
DECLARE
    organization_id uuid;
BEGIN
    IF works_for IS NOT NULL THEN
        SELECT id INTO organization_id
        FROM organizations
        WHERE name = works_for
        LIMIT 1;
        
        IF NOT FOUND THEN
            INSERT INTO organizations (name)
            VALUES (works_for)
            RETURNING id INTO organization_id;
        END IF;
    END IF;
    UPDATE persons p
    SET
        given_name = update_contact_by_email.given_name,
        family_name = update_contact_by_email.family_name,
        alternate_names = update_contact_by_email.alternate_names,
        address = update_contact_by_email.address,
        works_for = organization_id,
        job_title = update_contact_by_email.job_title,
        same_as = update_contact_by_email.same_as,
        image = update_contact_by_email.image
    WHERE p.email = update_contact_by_email.email
		AND p.user_id = update_contact_by_email.user_id;
END;
$$
LANGUAGE plpgsql;

-- Add RLS: Enable read access for all users and insert for authenticated users only
create policy "Enable insert for authenticated users only" on "public"."organizations" as permissive for insert to authenticated with check (true);
create policy "Enable read access for all users" on "public"."organizations" as permissive for select to authenticated using (true);