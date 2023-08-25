-- This migration introduces the following changes:
-- 1. Add an 'id' column to the 'persons' table and enforce uniqueness.
-- 2. Create an 'engagement' table for tracking export actions.
-- 3. Add delete table engagemnt in delete_user_data
-- 4. Update function get_contacts_table to return column id form persons

-- 1. Add 'id' column to 'persons' table and enforce uniqueness
ALTER TABLE "public"."persons"
    ADD COLUMN "id" uuid not null default uuid_generate_v4(),
    ADD CONSTRAINT "persons_id_unique" UNIQUE ("id");

-- 2. Create an 'engagement' table for tracking export actions.
CREATE TYPE engagement_type_enum AS ENUM ('CSV');
CREATE TABLE engagement (
    user_id uuid REFERENCES auth.users(id),
    person_id uuid,
    engagement_type engagement_type_enum,
    engagement_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (person_id)
);

-- 3. Add delete table engagemnt in delete_user_data
CREATE OR REPLACE FUNCTION delete_user_data(userid UUID) RETURNS VOID
AS $$
DECLARE
  owner_id uuid;
BEGIN
  owner_id = delete_user_data.userid;
  DELETE FROM messages msg WHERE msg.user_id = owner_id;
  DELETE FROM persons p WHERE p.user_id = owner_id;
  DELETE FROM pointsofcontact poc WHERE poc.user_id = owner_id;
  DELETE FROM tags t WHERE t.user_id = owner_id;
  DELETE FROM refinedpersons r WHERE r.userid = owner_id;
  DELETE from mining_sources ms WHERE ms.user_id = owner_id;
  DELETE from engagement eg WHERE eg.user_id = owner_id;

  
END;
$$ LANGUAGE plpgsql;

-- 4. return column id form persons
DROP FUNCTION get_contacts_table;
CREATE OR REPLACE FUNCTION get_contacts_table(userid uuid)
RETURNS TABLE (
    id UUID,
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
        p.id,
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