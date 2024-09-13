-- This migration introduces the folowing changes:
    --> ADD RLS to tables engagement, 
    --> ADD column "email" and set email, user_id as primary key
    --> DROP column "id" from public.persons
    --> DROP "person_id" from table engagement
    --> DROP column "id" from public.persons
    --> Update function "handle_new_user"
    --> Alter the table "profiles" add new colunms and set the default value of the "credits" column to 0
    --> Removes using of persons.id function from get_contacts_table


-- DROP column "id" from public.persons
ALTER TABLE "public"."persons"
    DROP CONSTRAINT "persons_id_unique",
    DROP COLUMN "id";

-- DROP "person_id" from table engagement
-- ADD column "email" and set email, user_id as primary key
-- ADD RLS to tables engagement, 
ALTER TABLE engagement
    DROP COLUMN person_id;
ALTER TABLE engagement
    ADD COLUMN email text,
    ADD PRIMARY KEY (email, user_id);
ALTER TABLE "public"."engagement" enable row level security;

-- Removes using of persons.id function from get_contacts_table
DROP FUNCTION get_contacts_table;
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

-- Alter the table "profiles" add new colunms and set the default value of the "credits" column to 0
ALTER TABLE "public"."profiles"
    ADD COLUMN "email" TEXT NULL,
    ADD COLUMN "stripe_subscription_id" TEXT NULL,
    ALTER COLUMN credits SET DEFAULT 0;

-- Update function "handle_new_user"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;
