-- Add persons data to get_contacts_table functions

DROP FUNCTION get_contacts_table;
CREATE OR REPLACE FUNCTION get_contacts_table(userid uuid)
RETURNS TABLE (
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
)
AS
$$
BEGIN
	RETURN QUERY
	SELECT
		pr.email as source,
		p.email,
		p.name,
		p.status,
		p.image,
		p.address,
		p.alternate_names,
		p.same_as,
		p.given_name,
		p.family_name,
		p.job_title,
		o.name as works_for,
		rp.recency,
		rp.seniority,
		rp.occurrence,
		rp.sender,
		rp.recipient,
		rp.conversations,
		rp.replied_conversations,
		rp.tags
	FROM 
		persons p
	INNER JOIN 
		refinedpersons rp ON rp.email = p.email
	INNER JOIN
		public.profiles pr ON pr.user_id = p.user_id
	LEFT JOIN
		organizations o ON o.id = p.works_for
	WHERE 
		p.user_id = get_contacts_table.userid;
END;
$$
LANGUAGE plpgsql;

DROP FUNCTION get_contacts_table_by_emails;
CREATE OR REPLACE FUNCTION get_contacts_table_by_emails(userid uuid, emails TEXT[])
RETURNS TABLE (
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
)
AS
$$
BEGIN
	RETURN QUERY
	SELECT
		pr.email as source,
		p.email,
		p.name,
		p.status,
		p.image,
		p.address,
		p.alternate_names,
		p.same_as,
		p.given_name,
		p.family_name,
		p.job_title,
		o.name as works_for,
		rp.recency,
		rp.seniority,
		rp.occurrence,
		rp.sender,
		rp.recipient,
		rp.conversations,
		rp.replied_conversations,
		rp.tags
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
		AND p.email = ANY(get_contacts_table_by_emails.emails);
END;
$$
LANGUAGE plpgsql;


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


-- Add RLS: Enable update for users based on user_id
create policy "Enable update for users based on user_id" on "public"."persons" as permissive for update to public using ((( SELECT auth.uid() AS uid) = user_id))with check ((( SELECT auth.uid() AS uid) = user_id));

-- Add RLS: Enable read access for all users and insert for authenticated users only
create policy "Enable insert for authenticated users only" on "public"."organizations" as permissive for insert to authenticated with check (true);
create policy "Enable read access for all users" on "public"."organizations" as permissive for select to authenticated using (true);