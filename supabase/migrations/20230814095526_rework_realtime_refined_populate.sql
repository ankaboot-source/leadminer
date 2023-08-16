-- This migration file introduces the following changes:

-- 1. Changes to table "refinedpersons", drop "name" and "status" && add created_at, updated_at trigger.

-- 2. Rebuild "persons" table without partitioning for real-time compatibility.

-- 3. Re-establish real-time publication for "persons" table.

-- 4. Create "refine_persons" function to refine and populate data in "persons" and "refinedpersons" tables.

-- 5. Create "get_contacts_table" function to merge data from "persons" and "refinedpersons".


-- 1. Drop the columns "name, status"
ALTER TABLE refinedpersons
    DROP COLUMN "name",
    DROP COLUMN "status",
    DROP COLUMN "created_at",
    DROP COLUMN "updated_at";

-- 1. Add the columns "created_at, updated_at"
ALTER TABLE refinedpersons
    ADD COLUMN "created_at" timestamp without time zone NOT NULL DEFAULT NOW(),
    ADD COLUMN "updated_at" timestamp without time zone NOT NULL DEFAULT NOW();

CREATE TRIGGER handle_updated_at BEFORE
UPDATE ON public.refinedpersons FOR EACH 
ROW EXECUTE FUNCTION moddatetime('updated_at');

-- 2. Recreate persons table & add RLS
DROP TABLE "public"."persons" CASCADE;
CREATE TABLE "public"."persons" (
    "name" text,
    "email" text,
    "user_id" uuid,
    "url" text,
    "image" text,
    "address" text,
    "alternate_names" text [],
    "same_as" text [],
    "given_name" text,
    "family_name" text,
    "job_title" text,
    "works_for" uuid,
    "identifiers" text[],
    "status" text not null default 'UNKNOWN'::text,
    "created_at" timestamp without time zone NOT NULL DEFAULT NOW(),
    "updated_at" timestamp without time zone NOT NULL DEFAULT NOW(),
    PRIMARY KEY (email, user_id)
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
using ((auth.uid() = user_id));

-- 3. Re-establish real-time
BEGIN;
    DROP publication IF EXISTS supabase_realtime;
    CREATE publication supabase_realtime WITH (publish = 'insert,update,delete');
COMMIT;
ALTER publication supabase_realtime ADD TABLE public.persons;

-- 3. Create "refine_persons" function
DROP function public.refined_persons;
CREATE OR REPLACE FUNCTION public.refine_persons(userid uuid) RETURNS void 
AS $$ 
DECLARE
    record_row record;
BEGIN
    FOR record_row IN (
        SELECT distinct
            subquery.person_email,
            first_value(name) over (partition by person_email order by total desc, source desc, recent_date desc) AS name,
            subquery.occurrence,
            subquery.recency,
            subquery.seniority,
            subquery.sender,
            subquery.recipient,
            subquery.conversations,
            subquery.replied_conversations,
            subquery.tags
        FROM (
            SELECT
                person_email,
                "from" as source,
                name,
                MAX(m.date) over grouped_by_email AS recency,
                MIN(m.date) over grouped_by_email AS seniority,
                MAX(m.date) over (partition by person_email, name) AS recent_date,
                COUNT(
                CASE
                    WHEN name is not null THEN 1
                END
                ) over (partition by person_email, name) AS total,
                COUNT(*) over grouped_by_email AS occurrence,
                COUNT(
                CASE
                    WHEN "from" OR "reply_to" THEN 1
                END
                ) over grouped_by_email AS sender,
                COUNT(
                CASE
                    WHEN "to" OR bcc OR cc THEN 1
                END
                ) over grouped_by_email AS recipient,
                COUNT(
                CASE
                    WHEN m.conversation THEN 1
                END
                ) over grouped_by_email AS conversations,
                COUNT(
                CASE
                    WHEN m.conversation and "from" THEN 1
                END
                ) over grouped_by_email AS replied_conversations,
                gt.tags as tags

            FROM pointsofcontact poc
            JOIN messages m ON poc.message_id = m.message_id
            JOIN get_grouped_tags_by_person(refine_persons.userid) gt on poc.person_email = gt.email
            WHERE
            poc.user_id = refine_persons.userid
            WINDOW grouped_by_email AS (PARTITION BY person_email)
        ) subquery
    )
    LOOP
        UPDATE public.persons
        SET
            name = record_row.name
        WHERE
            email = record_row.person_email;

        INSERT INTO public. refinedpersons (
            userid, email, occurrence, recency, seniority,
            sender, recipient, conversations, replied_conversations, tags
        )
        VALUES (
            refine_persons.userid,
            record_row.person_email,
            record_row.occurrence,
            record_row.recency,
            record_row.seniority,
            record_row.sender,
            record_row.recipient,
            record_row.conversations,
            record_row.replied_conversations,
            record_row.tags
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Create "get_contacts_table" function
CREATE OR REPLACE FUNCTION get_contacts_table(userid uuid)
RETURNS TABLE (
    email TEXT,
    name TEXT,
    status TEXT,
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
        p.email,
        p.name,
        p.status,
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
    WHERE 
        p.user_id = get_contacts_table.userid;
END;
$$
LANGUAGE plpgsql;