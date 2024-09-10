
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE "public"."engagement_type_enum" AS ENUM (
    'CSV',
    'ENRICH'
);

ALTER TYPE "public"."engagement_type_enum" OWNER TO "postgres";

CREATE TYPE "public"."task_category_enum" AS ENUM (
    'mining',
    'enriching',
    'cleaning'
);

ALTER TYPE "public"."task_category_enum" OWNER TO "postgres";

CREATE TYPE "public"."task_status_enum" AS ENUM (
    'running',
    'canceled',
    'done'
);

ALTER TYPE "public"."task_status_enum" OWNER TO "postgres";

CREATE TYPE "public"."task_type_enum" AS ENUM (
    'fetch',
    'extract',
    'edit',
    'export',
    'enrich',
    'clean'
);

ALTER TYPE "public"."task_type_enum" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_user_data"("user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  owner_id uuid;
BEGIN
  owner_id = delete_user_data.user_id;
  DELETE FROM messages msg WHERE msg.user_id = owner_id;
  DELETE FROM persons p WHERE p.user_id = owner_id;
  DELETE FROM pointsofcontact poc WHERE poc.user_id = owner_id;
  DELETE FROM tags t WHERE t.user_id = owner_id;
  DELETE FROM refinedpersons r WHERE r.user_id = owner_id;
  DELETE from mining_sources ms WHERE ms.user_id = owner_id;
  DELETE from engagement eg WHERE eg.user_id = owner_id;

  
END;
$$;

ALTER FUNCTION "public"."delete_user_data"("user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."enrich_contacts"("p_contacts_data" "jsonb"[], "p_update_empty_fields_only" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  contact_record JSONB;
  organization_id UUID;
  works_for_name TEXT;
  new_name TEXT;
  new_alternate_names TEXT[];
  old_name TEXT;
  old_alternate_names TEXT[];
BEGIN
  -- Assert that all records have email and user_id
  IF EXISTS (
    SELECT 1
    FROM unnest(p_contacts_data) AS contact
    WHERE contact->>'email' IS NULL OR contact->>'user_id' IS NULL
  ) THEN
    RAISE EXCEPTION 'All records in p_contacts_data must contain email and user_id fields';
  END IF;

  FOREACH contact_record IN ARRAY p_contacts_data
  LOOP
    
    works_for_name := contact_record->>'works_for';
    IF works_for_name IS NOT NULL THEN
      SELECT id INTO organization_id
      FROM organizations
      WHERE name = works_for_name
      LIMIT 1;
      
      IF NOT FOUND THEN
        INSERT INTO organizations (name)
        VALUES (works_for_name)
        RETURNING id INTO organization_id;
      END IF;
    ELSE
      organization_id := NULL;
    END IF;

    -- Add name into alternate_names if name is already filled
    new_name := contact_record->>'name';
    IF new_name IS NOT NULL THEN
      SELECT p.name, p.alternate_names 
      INTO old_name, old_alternate_names
      FROM persons p
      WHERE p.email = contact_record->>'email' AND p.user_id = (contact_record->>'user_id')::UUID
      LIMIT 1;
      IF old_name IS NOT NULL THEN
        IF (old_name != new_name AND (old_alternate_names IS NULL OR NOT(new_name = ANY(old_alternate_names)))) THEN
          new_alternate_names := ARRAY_APPEND(old_alternate_names, new_name);
        END IF;
        new_name := old_name;
      END IF;
    END IF;

    IF p_update_empty_fields_only THEN
      UPDATE persons
      SET 
        name = COALESCE(persons.name, new_name::TEXT),
        url = COALESCE(persons.url, (contact_record->>'url')::TEXT),
        image = COALESCE(persons.image, (contact_record->>'image')::TEXT),
        address = COALESCE(persons.address, (contact_record->>'address')::TEXT),
        alternate_names = COALESCE(persons.alternate_names, (new_alternate_names)::TEXT[]),
        same_as = COALESCE(persons.same_as, string_to_array(contact_record->>'same_as', ',')::TEXT[]),
        given_name = COALESCE(persons.given_name, (contact_record->>'given_name')::TEXT),
        family_name = COALESCE(persons.family_name, (contact_record->>'family_name')::TEXT),
        job_title = COALESCE(persons.job_title, (contact_record->>'job_title')::TEXT),
        works_for = COALESCE(persons.works_for, organization_id),
        identifiers = COALESCE(persons.identifiers, string_to_array(contact_record->>'identifiers', ',')::TEXT[]),
        status = COALESCE(persons.status, (contact_record->>'status')::TEXT)
      WHERE 
        email = (contact_record->>'email')::TEXT AND
        user_id = (contact_record->>'user_id')::UUID;
    ELSE
      UPDATE persons
      SET 
        name = COALESCE(new_name::TEXT, persons.name),
        url = COALESCE((contact_record->>'url')::TEXT, persons.url),
        image = COALESCE((contact_record->>'image')::TEXT, persons.image),
        address = COALESCE((contact_record->>'address')::TEXT, persons.address),
        alternate_names = COALESCE((new_alternate_names)::TEXT[], persons.alternate_names),
        same_as = COALESCE(string_to_array(contact_record->>'same_as', ',')::TEXT[], persons.same_as),
        given_name = COALESCE((contact_record->>'given_name')::TEXT, persons.given_name),
        family_name = COALESCE((contact_record->>'family_name')::TEXT, persons.family_name),
        job_title = COALESCE((contact_record->>'job_title')::TEXT, persons.job_title),
        works_for = COALESCE(organization_id, persons.works_for),
        identifiers = COALESCE(string_to_array(contact_record->>'identifiers', ',')::TEXT[], persons.identifiers),
        status = COALESCE((contact_record->>'status')::TEXT, persons.status)
      WHERE 
        email = (contact_record->>'email')::TEXT AND
        user_id = (contact_record->>'user_id')::UUID;
    END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION "public"."enrich_contacts"("p_contacts_data" "jsonb"[], "p_update_empty_fields_only" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_contacts_table"("user_id" "uuid") RETURNS TABLE("source" "text", "email" "text", "name" "text", "status" "text", "image" "text", "address" "text", "alternate_names" "text"[], "same_as" "text"[], "given_name" "text", "family_name" "text", "job_title" "text", "works_for" "text", "recency" timestamp with time zone, "seniority" timestamp with time zone, "occurrence" integer, "sender" integer, "recipient" integer, "conversations" integer, "replied_conversations" integer, "tags" "text"[], "updated_at" timestamp without time zone, "created_at" timestamp without time zone)
    LANGUAGE "plpgsql"
    AS $$
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
	  p.updated_at as updated_at_col,
	  p.created_at as created_at_col,
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
    tags_col AS tags,
	updated_at_col AS updated_at,
	created_at_col AS created_at
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$;

ALTER FUNCTION "public"."get_contacts_table"("user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_contacts_table_by_emails"("user_id" "uuid", "emails" "text"[]) RETURNS TABLE("source" "text", "email" "text", "name" "text", "status" "text", "image" "text", "address" "text", "alternate_names" "text"[], "same_as" "text"[], "given_name" "text", "family_name" "text", "job_title" "text", "works_for" "text", "recency" timestamp with time zone, "seniority" timestamp with time zone, "occurrence" integer, "sender" integer, "recipient" integer, "conversations" integer, "replied_conversations" integer, "tags" "text"[], "updated_at" timestamp without time zone, "created_at" timestamp without time zone)
    LANGUAGE "plpgsql"
    AS $$
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
      p.updated_at as updated_at_col,
	  p.created_at as created_at_col,
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
    tags_col AS tags,
	updated_at_col AS updated_at,
	created_at_col AS created_at
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$;

ALTER FUNCTION "public"."get_contacts_table_by_emails"("user_id" "uuid", "emails" "text"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_grouped_tags_by_person"("_userid" "uuid") RETURNS TABLE("email" "text", "tags" "text"[], "tags_reachability" integer[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    person_email AS email,
    array_agg(name) AS tags,
    array_agg(reachable) AS tags_reachability
  FROM tags
  WHERE
      user_id = _userid
      AND reachable IN (1, 2)
      AND person_email NOT IN (
          SELECT person_email
          FROM tags
          WHERE user_id = _userid
          GROUP BY person_email
          HAVING
            MAX(reachable) = 3
              OR (count(DISTINCT reachable) = 1 AND MAX(reachable) = 3)
              OR (count(DISTINCT reachable) = 2 AND ARRAY[1, 3] <@ array_agg(DISTINCT reachable))
      )
  GROUP BY person_email;
END
$$;

ALTER FUNCTION "public"."get_grouped_tags_by_person"("_userid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."populate_refined"("_userid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO refinedpersons(user_id, tags, name, email, status, created_at, updated_at)
    SELECT populate_refined._userid, t.tags, p.name, p.email, p.status, p.created_at, p.updated_at
    FROM public.persons p
    INNER JOIN public.get_grouped_tags_by_person(_userid) AS t ON t.email = p.email
    WHERE p.user_id=populate_refined._userid
    ON conflict(email, user_id) do nothing;
END;
$$;

ALTER FUNCTION "public"."populate_refined"("_userid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."refine_persons"("user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
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
            JOIN get_grouped_tags_by_person(refine_persons.user_id) gt on poc.person_email = gt.email
            WHERE
            poc.user_id = refine_persons.user_id
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
            user_id, email, occurrence, recency, seniority,
            sender, recipient, conversations, replied_conversations, tags
        )
        VALUES (
            refine_persons.user_id,
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
$$;

ALTER FUNCTION "public"."refine_persons"("user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_email_in_profile_table"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles
  SET email = new.email
  WHERE user_id = new.id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_email_in_profile_table"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."upsert_mining_source"("_user_id" "uuid", "_email" "text", "_type" "text", "_credentials" "text", "_encryption_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'extensions', 'public'
    AS $$
BEGIN
    INSERT INTO mining_sources ("user_id", "email", "type", "credentials")
    VALUES (_user_id, _email, _type, pgp_sym_encrypt(_credentials, _encryption_key))
    ON CONFLICT (email, user_id)
    DO UPDATE 
    SET credentials = EXCLUDED.credentials,
        type = EXCLUDED.type;
END;
$$;

ALTER FUNCTION "public"."upsert_mining_source"("_user_id" "uuid", "_email" "text", "_type" "text", "_credentials" "text", "_encryption_key" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."domains" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text",
    "last_check" timestamp with time zone,
    "email_server_type" "text"
);

ALTER TABLE "public"."domains" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."engagement" (
    "user_id" "uuid" NOT NULL,
    "engagement_type" "public"."engagement_type_enum" NOT NULL,
    "engagement_created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text" NOT NULL
);

ALTER TABLE "public"."engagement" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."messages" (
    "channel" "text",
    "folder_path" "text",
    "date" timestamp with time zone,
    "user_id" "uuid" NOT NULL,
    "list_id" "text",
    "message_id" "text" NOT NULL,
    "references" "text"[],
    "conversation" boolean
)
PARTITION BY HASH ("user_id");

ALTER TABLE "public"."messages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."messages_0" (
    "channel" "text",
    "folder_path" "text",
    "date" timestamp with time zone,
    "user_id" "uuid" NOT NULL,
    "list_id" "text",
    "message_id" "text" NOT NULL,
    "references" "text"[],
    "conversation" boolean
);

ALTER TABLE "public"."messages_0" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."messages_1" (
    "channel" "text",
    "folder_path" "text",
    "date" timestamp with time zone,
    "user_id" "uuid" NOT NULL,
    "list_id" "text",
    "message_id" "text" NOT NULL,
    "references" "text"[],
    "conversation" boolean
);

ALTER TABLE "public"."messages_1" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."messages_2" (
    "channel" "text",
    "folder_path" "text",
    "date" timestamp with time zone,
    "user_id" "uuid" NOT NULL,
    "list_id" "text",
    "message_id" "text" NOT NULL,
    "references" "text"[],
    "conversation" boolean
);

ALTER TABLE "public"."messages_2" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."mining_sources" (
    "created_at" timestamp with time zone DEFAULT "now"(),
    "credentials" "bytea" NOT NULL,
    "email" "text" NOT NULL,
    "type" "text" NOT NULL,
    "user_id" "uuid" NOT NULL
);

ALTER TABLE "public"."mining_sources" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "alternate_name" "text",
    "address" "text",
    "url" "text",
    "legal_name" "text",
    "telephone" "text",
    "email" "text",
    "image" "text",
    "founder" "uuid",
    "_domain" "uuid"
);

ALTER TABLE "public"."organizations" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."persons" (
    "name" "text",
    "email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "url" "text",
    "image" "text",
    "address" "text",
    "alternate_names" "text"[],
    "same_as" "text"[],
    "given_name" "text",
    "family_name" "text",
    "job_title" "text",
    "works_for" "uuid",
    "identifiers" "text"[],
    "status" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "source" "text" NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "verification_details" "json"
);

ALTER TABLE "public"."persons" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pointsofcontact" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_id" "text",
    "name" "text",
    "from" boolean,
    "reply_to" boolean,
    "to" boolean,
    "cc" boolean,
    "bcc" boolean,
    "body" boolean,
    "person_email" "text"
)
PARTITION BY HASH ("user_id");

ALTER TABLE "public"."pointsofcontact" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pointsofcontact_0" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_id" "text",
    "name" "text",
    "from" boolean,
    "reply_to" boolean,
    "to" boolean,
    "cc" boolean,
    "bcc" boolean,
    "body" boolean,
    "person_email" "text"
);

ALTER TABLE "public"."pointsofcontact_0" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pointsofcontact_1" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_id" "text",
    "name" "text",
    "from" boolean,
    "reply_to" boolean,
    "to" boolean,
    "cc" boolean,
    "bcc" boolean,
    "body" boolean,
    "person_email" "text"
);

ALTER TABLE "public"."pointsofcontact_1" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pointsofcontact_2" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_id" "text",
    "name" "text",
    "from" boolean,
    "reply_to" boolean,
    "to" boolean,
    "cc" boolean,
    "bcc" boolean,
    "body" boolean,
    "person_email" "text"
);

ALTER TABLE "public"."pointsofcontact_2" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "credits" integer DEFAULT 0,
    "stripe_customer_id" "text",
    "email" "text",
    "stripe_subscription_id" "text"
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."refinedpersons" (
    "user_id" "uuid" NOT NULL,
    "engagement" integer,
    "occurrence" integer,
    "tags" "text"[],
    "email" "text" NOT NULL,
    "recency" timestamp with time zone,
    "sender" integer,
    "recipient" integer,
    "conversations" integer,
    "replied_conversations" integer,
    "seniority" timestamp with time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."refinedpersons" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tags" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text"
)
PARTITION BY HASH ("user_id");

ALTER TABLE "public"."tags" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tags_0" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text"
);

ALTER TABLE "public"."tags_0" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tags_1" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text"
);

ALTER TABLE "public"."tags_1" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tags_2" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text"
);

ALTER TABLE "public"."tags_2" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "status" "public"."task_status_enum",
    "category" "public"."task_category_enum" NOT NULL,
    "type" "public"."task_type_enum" NOT NULL,
    "details" "jsonb",
    "duration" integer,
    "stopped_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."tasks" OWNER TO "postgres";

ALTER TABLE ONLY "public"."messages" ATTACH PARTITION "public"."messages_0" FOR VALUES WITH (modulus 3, remainder 0);

ALTER TABLE ONLY "public"."messages" ATTACH PARTITION "public"."messages_1" FOR VALUES WITH (modulus 3, remainder 1);

ALTER TABLE ONLY "public"."messages" ATTACH PARTITION "public"."messages_2" FOR VALUES WITH (modulus 3, remainder 2);

ALTER TABLE ONLY "public"."pointsofcontact" ATTACH PARTITION "public"."pointsofcontact_0" FOR VALUES WITH (modulus 3, remainder 0);

ALTER TABLE ONLY "public"."pointsofcontact" ATTACH PARTITION "public"."pointsofcontact_1" FOR VALUES WITH (modulus 3, remainder 1);

ALTER TABLE ONLY "public"."pointsofcontact" ATTACH PARTITION "public"."pointsofcontact_2" FOR VALUES WITH (modulus 3, remainder 2);

ALTER TABLE ONLY "public"."tags" ATTACH PARTITION "public"."tags_0" FOR VALUES WITH (modulus 3, remainder 0);

ALTER TABLE ONLY "public"."tags" ATTACH PARTITION "public"."tags_1" FOR VALUES WITH (modulus 3, remainder 1);

ALTER TABLE ONLY "public"."tags" ATTACH PARTITION "public"."tags_2" FOR VALUES WITH (modulus 3, remainder 2);

ALTER TABLE ONLY "public"."domains"
    ADD CONSTRAINT "domains_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."engagement"
    ADD CONSTRAINT "engagement_pkey" PRIMARY KEY ("email", "user_id", "engagement_type");

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("message_id", "user_id");

ALTER TABLE ONLY "public"."messages_0"
    ADD CONSTRAINT "messages_0_pkey" PRIMARY KEY ("message_id", "user_id");

ALTER TABLE ONLY "public"."messages_1"
    ADD CONSTRAINT "messages_1_pkey" PRIMARY KEY ("message_id", "user_id");

ALTER TABLE ONLY "public"."messages_2"
    ADD CONSTRAINT "messages_2_pkey" PRIMARY KEY ("message_id", "user_id");

ALTER TABLE ONLY "public"."mining_sources"
    ADD CONSTRAINT "mining_sources_pkey" PRIMARY KEY ("email", "user_id");

ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."persons"
    ADD CONSTRAINT "persons_pkey" PRIMARY KEY ("email", "user_id", "source");

ALTER TABLE ONLY "public"."pointsofcontact"
    ADD CONSTRAINT "pointsofcontact_pkey" PRIMARY KEY ("id", "user_id");

ALTER TABLE ONLY "public"."pointsofcontact_0"
    ADD CONSTRAINT "pointsofcontact_0_pkey" PRIMARY KEY ("id", "user_id");

ALTER TABLE ONLY "public"."pointsofcontact_1"
    ADD CONSTRAINT "pointsofcontact_1_pkey" PRIMARY KEY ("id", "user_id");

ALTER TABLE ONLY "public"."pointsofcontact_2"
    ADD CONSTRAINT "pointsofcontact_2_pkey" PRIMARY KEY ("id", "user_id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."refinedpersons"
    ADD CONSTRAINT "refinedpersons_pkey" PRIMARY KEY ("email", "user_id");

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("person_email", "name", "user_id");

ALTER TABLE ONLY "public"."tags_0"
    ADD CONSTRAINT "tags_0_pkey" PRIMARY KEY ("person_email", "name", "user_id");

ALTER TABLE ONLY "public"."tags_1"
    ADD CONSTRAINT "tags_1_pkey" PRIMARY KEY ("person_email", "name", "user_id");

ALTER TABLE ONLY "public"."tags_2"
    ADD CONSTRAINT "tags_2_pkey" PRIMARY KEY ("person_email", "name", "user_id");

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");

ALTER INDEX "public"."messages_pkey" ATTACH PARTITION "public"."messages_0_pkey";

ALTER INDEX "public"."messages_pkey" ATTACH PARTITION "public"."messages_1_pkey";

ALTER INDEX "public"."messages_pkey" ATTACH PARTITION "public"."messages_2_pkey";

ALTER INDEX "public"."pointsofcontact_pkey" ATTACH PARTITION "public"."pointsofcontact_0_pkey";

ALTER INDEX "public"."pointsofcontact_pkey" ATTACH PARTITION "public"."pointsofcontact_1_pkey";

ALTER INDEX "public"."pointsofcontact_pkey" ATTACH PARTITION "public"."pointsofcontact_2_pkey";

ALTER INDEX "public"."tags_pkey" ATTACH PARTITION "public"."tags_0_pkey";

ALTER INDEX "public"."tags_pkey" ATTACH PARTITION "public"."tags_1_pkey";

ALTER INDEX "public"."tags_pkey" ATTACH PARTITION "public"."tags_2_pkey";

CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."persons" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."refinedpersons" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

ALTER TABLE ONLY "public"."engagement"
    ADD CONSTRAINT "engagement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."mining_sources"
    ADD CONSTRAINT "mining_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations__domain_fkey" FOREIGN KEY ("_domain") REFERENCES "public"."domains"("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "Allow all operations for authenticated users on their own data" ON "public"."refinedpersons" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable insert for authenticated users only" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Enable select for users based on user_id" ON "public"."engagement" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable select for users based on user_id" ON "public"."messages" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable select for users based on user_id" ON "public"."persons" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable select for users based on user_id" ON "public"."pointsofcontact" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable select for users based on user_id" ON "public"."tags" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable select for users based on user_id" ON "public"."tasks" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable update for users based on user_id" ON "public"."persons" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Users can update their own data" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Users can view their own data" ON "public"."profiles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "public"."domains" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."engagement" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."messages_0" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."messages_1" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."messages_2" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."mining_sources" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."persons" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pointsofcontact" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pointsofcontact_0" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pointsofcontact_1" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pointsofcontact_2" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."refinedpersons" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tags_0" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tags_1" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tags_2" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;

CREATE PUBLICATION "logflare_pub" WITH (publish = 'insert, update, delete, truncate');

ALTER PUBLICATION "logflare_pub" OWNER TO "supabase_admin";

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."persons";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tasks";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;

GRANT ALL ON FUNCTION "public"."delete_user_data"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_data"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_data"("user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."enrich_contacts"("p_contacts_data" "jsonb"[], "p_update_empty_fields_only" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enrich_contacts"("p_contacts_data" "jsonb"[], "p_update_empty_fields_only" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."enrich_contacts"("p_contacts_data" "jsonb"[], "p_update_empty_fields_only" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enrich_contacts"("p_contacts_data" "jsonb"[], "p_update_empty_fields_only" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_contacts_table"("user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_contacts_table"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_contacts_table"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_contacts_table"("user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_contacts_table_by_emails"("user_id" "uuid", "emails" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_contacts_table_by_emails"("user_id" "uuid", "emails" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_contacts_table_by_emails"("user_id" "uuid", "emails" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_contacts_table_by_emails"("user_id" "uuid", "emails" "text"[]) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_grouped_tags_by_person"("_userid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_grouped_tags_by_person"("_userid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_grouped_tags_by_person"("_userid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON FUNCTION "public"."populate_refined"("_userid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."populate_refined"("_userid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_refined"("_userid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."refine_persons"("user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refine_persons"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refine_persons"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refine_persons"("user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_email_in_profile_table"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_email_in_profile_table"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_in_profile_table"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_in_profile_table"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."upsert_mining_source"("_user_id" "uuid", "_email" "text", "_type" "text", "_credentials" "text", "_encryption_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_mining_source"("_user_id" "uuid", "_email" "text", "_type" "text", "_credentials" "text", "_encryption_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_mining_source"("_user_id" "uuid", "_email" "text", "_type" "text", "_credentials" "text", "_encryption_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_mining_source"("_user_id" "uuid", "_email" "text", "_type" "text", "_credentials" "text", "_encryption_key" "text") TO "service_role";

GRANT ALL ON TABLE "public"."domains" TO "anon";
GRANT ALL ON TABLE "public"."domains" TO "authenticated";
GRANT ALL ON TABLE "public"."domains" TO "service_role";

GRANT ALL ON TABLE "public"."engagement" TO "anon";
GRANT ALL ON TABLE "public"."engagement" TO "authenticated";
GRANT ALL ON TABLE "public"."engagement" TO "service_role";

GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";

GRANT ALL ON TABLE "public"."messages_0" TO "anon";
GRANT ALL ON TABLE "public"."messages_0" TO "authenticated";
GRANT ALL ON TABLE "public"."messages_0" TO "service_role";

GRANT ALL ON TABLE "public"."messages_1" TO "anon";
GRANT ALL ON TABLE "public"."messages_1" TO "authenticated";
GRANT ALL ON TABLE "public"."messages_1" TO "service_role";

GRANT ALL ON TABLE "public"."messages_2" TO "anon";
GRANT ALL ON TABLE "public"."messages_2" TO "authenticated";
GRANT ALL ON TABLE "public"."messages_2" TO "service_role";

GRANT ALL ON TABLE "public"."mining_sources" TO "anon";
GRANT ALL ON TABLE "public"."mining_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."mining_sources" TO "service_role";

GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";

GRANT ALL ON TABLE "public"."persons" TO "anon";
GRANT ALL ON TABLE "public"."persons" TO "authenticated";
GRANT ALL ON TABLE "public"."persons" TO "service_role";

GRANT ALL ON TABLE "public"."pointsofcontact" TO "anon";
GRANT ALL ON TABLE "public"."pointsofcontact" TO "authenticated";
GRANT ALL ON TABLE "public"."pointsofcontact" TO "service_role";

GRANT ALL ON TABLE "public"."pointsofcontact_0" TO "anon";
GRANT ALL ON TABLE "public"."pointsofcontact_0" TO "authenticated";
GRANT ALL ON TABLE "public"."pointsofcontact_0" TO "service_role";

GRANT ALL ON TABLE "public"."pointsofcontact_1" TO "anon";
GRANT ALL ON TABLE "public"."pointsofcontact_1" TO "authenticated";
GRANT ALL ON TABLE "public"."pointsofcontact_1" TO "service_role";

GRANT ALL ON TABLE "public"."pointsofcontact_2" TO "anon";
GRANT ALL ON TABLE "public"."pointsofcontact_2" TO "authenticated";
GRANT ALL ON TABLE "public"."pointsofcontact_2" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."refinedpersons" TO "anon";
GRANT ALL ON TABLE "public"."refinedpersons" TO "authenticated";
GRANT ALL ON TABLE "public"."refinedpersons" TO "service_role";

GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";

GRANT ALL ON TABLE "public"."tags_0" TO "anon";
GRANT ALL ON TABLE "public"."tags_0" TO "authenticated";
GRANT ALL ON TABLE "public"."tags_0" TO "service_role";

GRANT ALL ON TABLE "public"."tags_1" TO "anon";
GRANT ALL ON TABLE "public"."tags_1" TO "authenticated";
GRANT ALL ON TABLE "public"."tags_1" TO "service_role";

GRANT ALL ON TABLE "public"."tags_2" TO "anon";
GRANT ALL ON TABLE "public"."tags_2" TO "authenticated";
GRANT ALL ON TABLE "public"."tags_2" TO "service_role";

GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON FUNCTIONS  FROM PUBLIC;

RESET ALL;
