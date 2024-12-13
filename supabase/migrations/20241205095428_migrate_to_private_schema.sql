-- DISABLE EXTENSION
-- https://supabase.com/docs/guides/database/hardening-data-api
DROP EXTENSION pg_graphql;

-- CREATE SCHEMA PRIVATE
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- DROP TABLE TRIGGERS
DROP TRIGGER on_auth_user_created ON auth.users;
DROP TRIGGER update_email_in_profile_table_trigger ON auth.users;
DROP TRIGGER handle_updated_at ON public.persons;
DROP TRIGGER handle_updated_at ON public.refinedpersons;
DROP TRIGGER update_persons_status_trigger ON public.email_status;
DROP TRIGGER handle_updated_at_email_status ON public.email_status;


-- DROP FUNCTIONS
DROP FUNCTION public.update_email_in_profile_table;
DROP FUNCTION public.update_person_status;
DROP FUNCTION public.get_grouped_tags_by_person;
DROP FUNCTION public.handle_new_user;
DROP FUNCTION public.delete_user_data;
DROP FUNCTION public.populate_refined;
DROP FUNCTION public.enrich_contacts;
DROP FUNCTION public.get_contacts_table;
DROP FUNCTION public.get_contacts_table_by_emails;
DROP FUNCTION public.upsert_mining_source;
DROP FUNCTION public.delete_expired_clean_cache;
DROP FUNCTION public.delete_expired_enrich_cache;
DROP FUNCTION public.refine_persons;
DROP FUNCTION public.custom_access_token_hook;
DROP FUNCTION public.enriched_most_recent;

-- DROP TABLES, RLS ...
DROP TABLE public.engagement;
DROP TABLE public.messages_0;
DROP TABLE public.messages_1;
DROP TABLE public.messages_2;
DROP TABLE public.messages;
DROP TABLE public.mining_sources;
DROP TABLE public.organizations;
DROP TABLE public.domains;
DROP TABLE public.persons;
DROP TABLE public.pointsofcontact_0;
DROP TABLE public.pointsofcontact_1;
DROP TABLE public.pointsofcontact_2;
DROP TABLE public.pointsofcontact;
DROP TABLE public.profiles;
DROP TABLE public.refinedpersons;
DROP TABLE public.tags_0;
DROP TABLE public.tags_1;
DROP TABLE public.tags_2;
DROP TABLE public.tags;
DROP TABLE public.tasks;
DROP TABLE public.email_status;

DROP TYPE public.engagement_type_enum;
DROP TYPE public.task_category_enum;
DROP TYPE public.task_status_enum;
DROP TYPE public.task_type_enum;
DROP TYPE public.status_enum;

-- CREATE ENUMS
CREATE TYPE "private"."engagement_type_enum" AS ENUM (
    'CSV',
    'ENRICH'
);

CREATE TYPE "private"."task_category_enum" AS ENUM (
    'mining',
    'enriching',
    'cleaning'
);

CREATE TYPE "private"."task_status_enum" AS ENUM (
    'running',
    'canceled',
    'done'
);

CREATE TYPE "private"."task_type_enum" AS ENUM (
    'fetch',
    'extract',
    'edit',
    'export',
    'enrich',
    'clean'
);

CREATE TYPE "private"."status_enum" AS ENUM (
  'VALID',
  'RISKY',
  'INVALID',
  'UNKNOWN'
);



-- CREATE TABLES

CREATE TABLE "private"."email_status" (
    email text not null,
    user_id uuid not null,
    status private.status_enum not null,
    details JSONB null,
    verified_on timestamp without time zone not null,
    created_at timestamp without time zone not null default now(),
    updated_at timestamp without time zone not null default now(),
    constraint email_status_pkey primary key (email)
  );

ALTER TABLE "private"."email_status" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable select for users based on user_id" ON "private"."email_status" FOR
SELECT TO "authenticated" USING ( ((SELECT "auth"."uid" () AS "uid" ) = "user_id" ) );

CREATE TABLE "private"."domains" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text",
    "last_check" timestamp with time zone,
    "email_server_type" "text",
    PRIMARY KEY ("id")
);

ALTER TABLE "private"."domains" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."engagement" (
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id"),
    "engagement_type" "private"."engagement_type_enum" NOT NULL,
    "engagement_created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text" NOT NULL,
    PRIMARY KEY ("email", "user_id", "engagement_type")
);

CREATE POLICY "Enable select for users based on user_id" ON "private"."engagement" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "private"."engagement" ENABLE ROW LEVEL SECURITY;


CREATE TABLE "private"."messages" (
    "channel" "text",
    "folder_path" "text",
    "date" timestamp with time zone,
    "user_id" "uuid" NOT NULL,
    "list_id" "text",
    "message_id" "text" NOT NULL,
    "references" "text"[],
    "conversation" boolean,
    PRIMARY KEY ("message_id", "user_id")
)
PARTITION BY HASH ("user_id");

CREATE TABLE "private"."messages_0" (
    "channel" "text",
    "folder_path" "text",
    "date" timestamp with time zone,
    "user_id" "uuid" NOT NULL,
    "list_id" "text",
    "message_id" "text" NOT NULL,
    "references" "text"[],
    "conversation" boolean,
    PRIMARY KEY ("message_id", "user_id")
);
CREATE TABLE "private"."messages_1" (
    "channel" text,
    "folder_path" text,
    "date" timestamp with time zone,
    "user_id" uuid NOT NULL,
    "list_id" text,
    "message_id" text NOT NULL,
    "references" text[],
    "conversation" boolean,
    PRIMARY KEY ("message_id", "user_id")
);
CREATE TABLE "private"."messages_2" (
    "channel" "text",
    "folder_path" "text",
    "date" timestamp with time zone,
    "user_id" "uuid" NOT NULL,
    "list_id" "text",
    "message_id" "text" NOT NULL,
    "references" "text"[],
    "conversation" boolean,
    PRIMARY KEY ("message_id", "user_id")
);

ALTER TABLE ONLY "private"."messages" ATTACH PARTITION "private"."messages_0" FOR VALUES WITH (modulus 3, remainder 0);
ALTER TABLE ONLY "private"."messages" ATTACH PARTITION "private"."messages_1" FOR VALUES WITH (modulus 3, remainder 1);
ALTER TABLE ONLY "private"."messages" ATTACH PARTITION "private"."messages_2" FOR VALUES WITH (modulus 3, remainder 2);

ALTER INDEX "private"."messages_pkey" ATTACH PARTITION "private"."messages_0_pkey";
ALTER INDEX "private"."messages_pkey" ATTACH PARTITION "private"."messages_1_pkey";
ALTER INDEX "private"."messages_pkey" ATTACH PARTITION "private"."messages_2_pkey";

CREATE POLICY "Enable select for users based on user_id" ON "private"."messages" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "private"."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."messages_0" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."messages_1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."messages_2" ENABLE ROW LEVEL SECURITY;


CREATE TABLE "private"."mining_sources" (
    "created_at" timestamp with time zone DEFAULT "now"(),
    "credentials" "bytea" NOT NULL,
    "email" "text" NOT NULL,
    "type" "text" NOT NULL,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id"),
    PRIMARY KEY ("email", "user_id")
);

ALTER TABLE "private"."mining_sources" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "alternate_name" "text",
    "location" "text"[],
    "url" "text",
    "legal_name" "text",
    "telephone" "text",
    "email" "text",
    "image" "text",
    "founder" "uuid",
    "_domain" "uuid" REFERENCES "private"."domains"("id"),
    PRIMARY KEY ("id")
);

CREATE POLICY "Enable insert for authenticated users only" ON "private"."organizations" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "private"."organizations" FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "private"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE TABLE "private"."persons" (
    "name" "text",
    "email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "url" "text",
    "image" "text",
    "location" "text"[],
    "alternate_name" "text"[],
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
    PRIMARY KEY ("email", "user_id", "source")
);

CREATE POLICY "Enable select for users based on user_id" ON "private"."persons" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));
CREATE POLICY "Enable update for users based on user_id" ON "private"."persons" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "private"."persons" ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "private"."persons";

CREATE TABLE "private"."pointsofcontact" (
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
    "person_email" "text",
    PRIMARY KEY ("id", "user_id")
)
PARTITION BY HASH ("user_id");

CREATE TABLE "private"."pointsofcontact_0" (
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
    "person_email" "text",
    PRIMARY KEY ("id", "user_id")
);
CREATE TABLE "private"."pointsofcontact_1" (
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
    "person_email" "text",
    PRIMARY KEY ("id", "user_id")
);
CREATE TABLE "private"."pointsofcontact_2" (
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
    "person_email" "text",
    PRIMARY KEY ("id", "user_id")
);

ALTER TABLE ONLY "private"."pointsofcontact" ATTACH PARTITION "private"."pointsofcontact_0" FOR VALUES WITH (modulus 3, remainder 0);
ALTER TABLE ONLY "private"."pointsofcontact" ATTACH PARTITION "private"."pointsofcontact_1" FOR VALUES WITH (modulus 3, remainder 1);
ALTER TABLE ONLY "private"."pointsofcontact" ATTACH PARTITION "private"."pointsofcontact_2" FOR VALUES WITH (modulus 3, remainder 2);

ALTER INDEX "private"."pointsofcontact_pkey" ATTACH PARTITION "private"."pointsofcontact_0_pkey";
ALTER INDEX "private"."pointsofcontact_pkey" ATTACH PARTITION "private"."pointsofcontact_1_pkey";
ALTER INDEX "private"."pointsofcontact_pkey" ATTACH PARTITION "private"."pointsofcontact_2_pkey";

CREATE POLICY "Enable select for users based on user_id" ON "private"."pointsofcontact" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "private"."pointsofcontact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."pointsofcontact_0" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."pointsofcontact_1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."pointsofcontact_2" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."profiles" (
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "full_name" "text",
    "email" "text",
    PRIMARY KEY ("user_id")
);

CREATE POLICY "Users can update their own data" ON "private"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));
CREATE POLICY "Users can view their own data" ON "private"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "private"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "private"."profiles";

CREATE TABLE "private"."refinedpersons" (
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
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("email", "user_id")
);

CREATE POLICY "Allow all operations for authenticated users on their own data" ON "private"."refinedpersons" FOR ALL TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "private"."refinedpersons" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."tags" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text",
    PRIMARY KEY ("person_email", "name", "user_id")
)
PARTITION BY HASH ("user_id");

CREATE TABLE "private"."tags_0" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text",
    PRIMARY KEY ("person_email", "name", "user_id")
);
CREATE TABLE "private"."tags_1" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text",
    PRIMARY KEY ("person_email", "name", "user_id")
);
CREATE TABLE "private"."tags_2" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text",
    PRIMARY KEY ("person_email", "name", "user_id")
);

ALTER TABLE ONLY "private"."tags" ATTACH PARTITION "private"."tags_0" FOR VALUES WITH (modulus 3, remainder 0);
ALTER TABLE ONLY "private"."tags" ATTACH PARTITION "private"."tags_1" FOR VALUES WITH (modulus 3, remainder 1);
ALTER TABLE ONLY "private"."tags" ATTACH PARTITION "private"."tags_2" FOR VALUES WITH (modulus 3, remainder 2);

ALTER INDEX "private"."tags_pkey" ATTACH PARTITION "private"."tags_0_pkey";
ALTER INDEX "private"."tags_pkey" ATTACH PARTITION "private"."tags_1_pkey";
ALTER INDEX "private"."tags_pkey" ATTACH PARTITION "private"."tags_2_pkey";

CREATE POLICY "Enable select for users based on user_id" ON "private"."tags" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "private"."tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."tags_0" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."tags_1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."tags_2" ENABLE ROW LEVEL SECURITY;


CREATE TABLE "private"."tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "status" "private"."task_status_enum",
    "category" "private"."task_category_enum" NOT NULL,
    "type" "private"."task_type_enum" NOT NULL,
    "details" "jsonb",
    "duration" integer,
    "stopped_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("id")
);

CREATE POLICY "Enable select for users based on user_id" ON "private"."tasks" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "private"."tasks" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "private"."tasks";

-- CREATE FUNCTIONS
CREATE FUNCTION private.update_email_in_profile_table()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE private.profiles
    SET email = NEW.email
    WHERE user_id = NEW.id;
    RETURN NEW;
END;
$$;

CREATE FUNCTION private.update_person_status () RETURNS TRIGGER AS $$
BEGIN
  -- Update the status in the persons table
  UPDATE private.persons
  SET status = NEW.status
  WHERE email = NEW.email
    AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

CREATE FUNCTION private.get_grouped_tags_by_person(_userid uuid) RETURNS TABLE(email text, tags text[], tags_reachability integer[])
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    person_email AS email,
    array_agg(name) AS tags,
    array_agg(reachable) AS tags_reachability
  FROM private.tags
  WHERE
      user_id = _userid
      AND reachable IN (1, 2)
      AND person_email NOT IN (
          SELECT person_email
          FROM private.tags
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

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO private.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$;

CREATE FUNCTION private.delete_user_data(user_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
DECLARE
  owner_id uuid;
BEGIN
  owner_id = delete_user_data.user_id;
  DELETE FROM private.messages msg WHERE msg.user_id = owner_id;
  DELETE FROM private.persons p WHERE p.user_id = owner_id;
  DELETE FROM private.pointsofcontact poc WHERE poc.user_id = owner_id;
  DELETE FROM private.tags t WHERE t.user_id = owner_id;
  DELETE FROM private.refinedpersons r WHERE r.user_id = owner_id;
  DELETE FROM private.mining_sources ms WHERE ms.user_id = owner_id;
  DELETE FROM private.engagement eg WHERE eg.user_id = owner_id;
END;
$$;

CREATE FUNCTION private.populate_refined(_userid uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
BEGIN
  INSERT INTO private.refinedpersons(user_id, tags, name, email, status, created_at, updated_at)
    SELECT populate_refined._userid, t.tags, p.name, p.email, p.status, p.created_at, p.updated_at
    FROM private.persons p
    INNER JOIN private.get_grouped_tags_by_person(_userid) AS t ON t.email = p.email
    WHERE p.user_id=populate_refined._userid
    ON conflict(email, user_id) do nothing;
END;
$$;

CREATE FUNCTION private.enrich_contacts(p_contacts_data jsonb[], p_update_empty_fields_only boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
DECLARE
  contact_record JSONB;
  organization_id UUID;
  works_for_name TEXT;
  new_name TEXT;
  new_alternate_name TEXT[];
  old_name TEXT;
  old_alternate_name TEXT[];
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
      FROM private.organizations
      WHERE name = works_for_name
      LIMIT 1;
      
      IF NOT FOUND THEN
        INSERT INTO private.organizations (name)
        VALUES (works_for_name)
        RETURNING id INTO organization_id;
      END IF;
    ELSE
      organization_id := NULL;
    END IF;

    -- Add name into alternate_name if name is already filled
    new_name := contact_record->>'name';
    IF new_name IS NOT NULL THEN
      SELECT p.name, p.alternate_name 
      INTO old_name, old_alternate_name
      FROM private.persons p
      WHERE p.email = contact_record->>'email' AND p.user_id = (contact_record->>'user_id')::UUID
      LIMIT 1;
      IF old_name IS NOT NULL THEN
        IF (old_name != new_name AND (old_alternate_name IS NULL OR NOT(new_name = ANY(old_alternate_name)))) THEN
          new_alternate_name := ARRAY_APPEND(old_alternate_name, new_name);
        END IF;
        new_name := old_name;
      END IF;
    END IF;

    IF p_update_empty_fields_only THEN
      UPDATE private.persons pp
      SET 
        name = COALESCE(pp.name, new_name::TEXT),
        url = COALESCE(pp.url, (contact_record->>'url')::TEXT),
        image = COALESCE(pp.image, (contact_record->>'image')::TEXT),
        location = COALESCE(pp.location, string_to_array(contact_record->>'location', ',')::TEXT[]),
        alternate_name = COALESCE(pp.alternate_name, (new_alternate_name)::TEXT[]),
        same_as = COALESCE(pp.same_as, string_to_array(contact_record->>'same_as', ',')::TEXT[]),
        given_name = COALESCE(pp.given_name, (contact_record->>'given_name')::TEXT),
        family_name = COALESCE(pp.family_name, (contact_record->>'family_name')::TEXT),
        job_title = COALESCE(pp.job_title, (contact_record->>'job_title')::TEXT),
        works_for = COALESCE(pp.works_for, organization_id),
        identifiers = COALESCE(pp.identifiers, string_to_array(contact_record->>'identifiers', ',')::TEXT[]),
        status = COALESCE(pp.status, (contact_record->>'status')::TEXT)
      WHERE 
        email = (contact_record->>'email')::TEXT AND
        user_id = (contact_record->>'user_id')::UUID;
    ELSE
      UPDATE private.persons pp
      SET 
        name = COALESCE(new_name::TEXT, pp.name),
        url = COALESCE((contact_record->>'url')::TEXT, pp.url),
        image = COALESCE((contact_record->>'image')::TEXT, pp.image),
        location = COALESCE(string_to_array(contact_record->>'location', ',')::TEXT[], pp.location),
        alternate_name = COALESCE((new_alternate_name)::TEXT[], pp.alternate_name),
        same_as = COALESCE(string_to_array(contact_record->>'same_as', ',')::TEXT[], pp.same_as),
        given_name = COALESCE((contact_record->>'given_name')::TEXT, pp.given_name),
        family_name = COALESCE((contact_record->>'family_name')::TEXT, pp.family_name),
        job_title = COALESCE((contact_record->>'job_title')::TEXT, pp.job_title),
        works_for = COALESCE(organization_id, pp.works_for),
        identifiers = COALESCE(string_to_array(contact_record->>'identifiers', ',')::TEXT[], pp.identifiers),
        status = COALESCE((contact_record->>'status')::TEXT, pp.status)
      WHERE 
        email = (contact_record->>'email')::TEXT AND
        user_id = (contact_record->>'user_id')::UUID;
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION private.get_contacts_table(user_id uuid) RETURNS TABLE(source text, email text, name text, status text, image text, location text[], alternate_name text[], same_as text[], given_name text, family_name text, job_title text, works_for text, recency timestamp with time zone, seniority timestamp with time zone, occurrence integer, sender integer, recipient integer, conversations integer, replied_conversations integer, tags text[], updated_at timestamp without time zone, created_at timestamp without time zone)
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

CREATE FUNCTION private.get_contacts_table_by_emails(user_id uuid, emails text[]) RETURNS TABLE(source text, email text, name text, status text, image text, location text[], alternate_name text[], same_as text[], given_name text, family_name text, job_title text, works_for text, recency timestamp with time zone, seniority timestamp with time zone, occurrence integer, sender integer, recipient integer, conversations integer, replied_conversations integer, tags text[], updated_at timestamp without time zone, created_at timestamp without time zone)
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

CREATE FUNCTION private.upsert_mining_source(_user_id uuid, _email text, _type text, _credentials text, _encryption_key text) RETURNS void
    LANGUAGE plpgsql
    SET "search_path" = '' 
    AS $$
BEGIN
    INSERT INTO private.mining_sources ("user_id", "email", "type", "credentials")
    VALUES (_user_id, _email, _type, extensions.pgp_sym_encrypt(_credentials, _encryption_key))
    ON CONFLICT (email, user_id)
    DO UPDATE 
    SET credentials = EXCLUDED.credentials,
        type = EXCLUDED.type;
END;
$$;

CREATE FUNCTION private.delete_expired_clean_cache (delete_interval INTERVAL) RETURNS void AS $$
BEGIN
    DELETE FROM private.email_status
    WHERE verified_on <= NOW() - delete_interval;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

CREATE FUNCTION private.delete_expired_enrich_cache(delete_interval INTERVAL)
RETURNS void AS $$
BEGIN
    DELETE FROM private.tasks
    WHERE status = 'done'
      AND category = 'enriching'
      AND type = 'enrich'
      AND started_at <= NOW() - delete_interval;
END;
$$ LANGUAGE plpgsql
SET search_path = '';


CREATE FUNCTION private.refine_persons(user_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path = ''
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

            FROM private.pointsofcontact poc
            JOIN private.messages m ON poc.message_id = m.message_id
            JOIN private.get_grouped_tags_by_person(refine_persons.user_id) gt on poc.person_email = gt.email
            WHERE
            poc.user_id = refine_persons.user_id
            WINDOW grouped_by_email AS (PARTITION BY person_email)
        ) subquery
    )
    LOOP
        UPDATE private.persons
        SET
            name = record_row.name
        WHERE
            email = record_row.person_email;

        INSERT INTO private.refinedpersons (
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

CREATE OR REPLACE FUNCTION private.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    claims JSONB;
    user_metadata JSONB;
    email_template_language JSONB;
BEGIN
    -- Extract claims from the event
    claims := event->'claims';
    claims := jsonb_build_object(
        'aud', claims->'aud',
        'exp', claims->'exp',
        'iat', claims->'iat',
        'sub', claims->'sub',
        'email', claims->'email',
        'phone', claims->'phone',
        'role', claims->'role',
        'aal', claims->'aal',
        'session_id', claims->'session_id',
        'is_anonymous', claims->'is_anonymous'
    );

    -- Check for user_metadata and update claims if EmailTemplate exists
    IF jsonb_typeof(event->'claims'->'user_metadata') IS NOT NULL THEN
        user_metadata := event->'claims'->'user_metadata';

        IF jsonb_typeof(user_metadata->'EmailTemplate') IS NOT NULL THEN
            email_template_language := jsonb_build_object(
                'language', user_metadata->'EmailTemplate'->'language'
            );
            user_metadata := jsonb_set('{}'::JSONB, '{EmailTemplate}', email_template_language);
            claims := jsonb_set(claims, '{user_metadata}', user_metadata);
        END IF;
    END IF;

    -- Update the event with modified claims and return it
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$;


REVOKE USAGE 
ON SCHEMA public 
FROM supabase_auth_admin;

GRANT EXECUTE
ON FUNCTION private.custom_access_token_hook
TO supabase_auth_admin;

GRANT USAGE
ON SCHEMA private
TO supabase_auth_admin;

REVOKE EXECUTE
ON FUNCTION private.custom_access_token_hook
FROM authenticated, anon, public;

CREATE OR REPLACE FUNCTION private.enriched_most_recent(emails text[])
RETURNS SETOF jsonb
LANGUAGE sql
SET search_path = ''
STABLE
AS $$
WITH
recent_tasks AS (
    SELECT
    *
    FROM
    private.tasks t
    WHERE
    jsonb_typeof(t.details -> 'result') = 'array'
    AND t.status = 'done'
    AND t.category = 'enriching'
    AND t.type = 'enrich'
    AND t.started_at >= NOW() - INTERVAL '6 months'
),
cached_results AS (
    SELECT DISTINCT
    ON (enriched_raw_data ->> 'email') -- Get distinct emails
    t.id as task_id,
    t.user_id as user_id,
    t.started_at as created_at,
    result ->> 'instance' as instance,
    enriched_raw_data as result
    FROM
    recent_tasks t,
    LATERAL (
        SELECT
        jsonb_array_elements(t.details -> 'result') AS result
    ) AS results_array,
    LATERAL (
        SELECT
        jsonb_array_elements(results_array.result -> 'raw_data') AS enriched_raw_data
    ) AS flattened_raw_data
    WHERE
    enriched_raw_data ->> 'email' = ANY (emails)
    ORDER BY
    enriched_raw_data ->> 'email',
    t.started_at DESC -- Order by email and timestamp to get the most recent
)
SELECT
jsonb_build_object(
    'task_id',
    ce.task_id,
    'user_id',
    ce.user_id,
    'created_at',
    ce.created_at::timestamp,
    'instance',
    ce.instance,
    'result',
    ce.result
) AS task
FROM
cached_results ce;
$$;


-- CREATE TRIGGERS
CREATE TRIGGER handle_updated_at 
BEFORE UPDATE ON private.persons
FOR EACH ROW
EXECUTE FUNCTION extensions.moddatetime('updated_at');

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION private.handle_new_user();

CREATE TRIGGER update_email_in_profile_table_trigger
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION private.update_email_in_profile_table();

CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON private.refinedpersons
FOR EACH ROW
EXECUTE FUNCTION extensions.moddatetime('updated_at');

CREATE TRIGGER update_persons_status_trigger
AFTER INSERT OR UPDATE ON private.email_status
FOR EACH ROW
EXECUTE FUNCTION private.update_person_status();

CREATE TRIGGER handle_updated_at_email_status 
BEFORE UPDATE ON private.email_status
FOR EACH ROW
EXECUTE FUNCTION extensions.moddatetime('updated_at');



-- UPDATE CRON JOBS
DO $$
BEGIN
  -- Unschedule 'delete-expired-enrich-cache' if it exists
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'delete-expired-enrich-cache';

  -- Unschedule 'delete-expired-clean-cache' if it exists
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'delete-expired-clean-cache';
END $$;

SELECT cron.schedule(
    'delete-expired-enrich-cache',
    '0 0 1 */6 *', -- At 00:00 on the 1st day of every 6th month
    $$SELECT private.delete_expired_enrich_cache(INTERVAL '6 months');$$
);

SELECT cron.schedule(
    'delete-expired-clean-cache',
    '0 0 */100 * *', -- At 00:00 every 100 days
    $$SELECT private.delete_expired_clean_cache(INTERVAL '100 days');$$
);