-- 2. Recreate persons table & add RLS
DROP TABLE "public"."persons" CASCADE;
CREATE TABLE "public"."persons" (
    "name" text null,
    "email" text not null,
    "user_id" uuid not null,
    "url" text null,
    "image" text null,
    "address" text null,
    "alternate_names" text[] null,
    "same_as" text[] null,
    "given_name" text null,
    "family_name" text null,
    "job_title" text null,
    "works_for" uuid null,
    "identifiers" text[] null,
    "status" text null,
    "created_at" timestamp without time zone not null default now(),
    "source" text not null,
    "updated_at" timestamp without time zone not null default now(),
    "verification_details" json null,
    PRIMARY KEY (email, user_id, source)
);

-- Add trigger to auto update "updated_at"
CREATE TRIGGER handle_updated_at BEFORE
UPDATE ON public.persons FOR EACH 
ROW EXECUTE FUNCTION moddatetime('updated_at');

-- Add RLS to table persons
alter table "public"."persons" enable row level security;

create policy "Enable select for users based on user_id"
on "public"."persons"
as permissive
for select
to public
using ((select auth.uid()) = user_id);

create policy "Enable update for users based on user_id"
on "public"."persons"
as permissive
for update
to public
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- 3. Re-establish real-time
BEGIN;
    DROP publication IF EXISTS supabase_realtime;
    CREATE publication supabase_realtime WITH (publish = 'insert,update,delete');
COMMIT;
ALTER publication supabase_realtime ADD TABLE public.persons;

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
        ORDER BY rp.recency DESC
      ) AS rn
    FROM
      persons p
    INNER JOIN
      refinedpersons rp ON rp.email = p.email
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
        ORDER BY rp.recency DESC
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