-- EXTENTIONS
create extension if not exists moddatetime schema extensions;

-- Table domains
CREATE TABLE "public"."domains" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text",
    "last_check" timestamp with time zone,
    "email_server_type" "text",
    PRIMARY KEY ("id")
);

ALTER TABLE "public"."domains" ENABLE ROW LEVEL SECURITY;

-- Table engagement

CREATE TYPE "public"."engagement_type_enum" AS ENUM (
    'CSV',
    'ENRICH'
);

CREATE TABLE "public"."engagement" (
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id"),
    "engagement_type" "public"."engagement_type_enum" NOT NULL,
    "engagement_created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text" NOT NULL,
    PRIMARY KEY ("email", "user_id", "engagement_type")
);

CREATE POLICY "Enable select for users based on user_id" ON "public"."engagement" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "public"."engagement" ENABLE ROW LEVEL SECURITY;

-- Table messages

CREATE TABLE "public"."messages" (
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

CREATE TABLE "public"."messages_0" (
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
CREATE TABLE "public"."messages_1" (
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
CREATE TABLE "public"."messages_2" (
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

ALTER TABLE ONLY "public"."messages" ATTACH PARTITION "public"."messages_0" FOR VALUES WITH (modulus 3, remainder 0);
ALTER TABLE ONLY "public"."messages" ATTACH PARTITION "public"."messages_1" FOR VALUES WITH (modulus 3, remainder 1);
ALTER TABLE ONLY "public"."messages" ATTACH PARTITION "public"."messages_2" FOR VALUES WITH (modulus 3, remainder 2);

ALTER INDEX "public"."messages_pkey" ATTACH PARTITION "public"."messages_0_pkey";
ALTER INDEX "public"."messages_pkey" ATTACH PARTITION "public"."messages_1_pkey";
ALTER INDEX "public"."messages_pkey" ATTACH PARTITION "public"."messages_2_pkey";

CREATE POLICY "Enable select for users based on user_id" ON "public"."messages" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages_0" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages_1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages_2" ENABLE ROW LEVEL SECURITY;

-- Table mining_sources

CREATE TABLE "public"."mining_sources" (
    "created_at" timestamp with time zone DEFAULT "now"(),
    "credentials" "bytea" NOT NULL,
    "email" "text" NOT NULL,
    "type" "text" NOT NULL,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id"),
    PRIMARY KEY ("email", "user_id")
);

ALTER TABLE "public"."mining_sources" ENABLE ROW LEVEL SECURITY;


-- Table organizations

CREATE TABLE "public"."organizations" (
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
    "_domain" "uuid" REFERENCES "public"."domains"("id"),
    PRIMARY KEY ("id")
);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


-- Table persons

CREATE TABLE "public"."persons" (
    "name" "text",
    "email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "url" "text",
    "image" "text",
    "location" "text"[],
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
    "verification_details" "json",
    PRIMARY KEY ("email", "user_id", "source")
);

CREATE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."persons" FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

CREATE POLICY "Enable select for users based on user_id" ON "public"."persons" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));
CREATE POLICY "Enable update for users based on user_id" ON "public"."persons" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "public"."persons" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."persons";

-- Table pointsofcontact

CREATE TABLE "public"."pointsofcontact" (
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

CREATE TABLE "public"."pointsofcontact_0" (
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
CREATE TABLE "public"."pointsofcontact_1" (
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
CREATE TABLE "public"."pointsofcontact_2" (
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

ALTER TABLE ONLY "public"."pointsofcontact" ATTACH PARTITION "public"."pointsofcontact_0" FOR VALUES WITH (modulus 3, remainder 0);
ALTER TABLE ONLY "public"."pointsofcontact" ATTACH PARTITION "public"."pointsofcontact_1" FOR VALUES WITH (modulus 3, remainder 1);
ALTER TABLE ONLY "public"."pointsofcontact" ATTACH PARTITION "public"."pointsofcontact_2" FOR VALUES WITH (modulus 3, remainder 2);

ALTER INDEX "public"."pointsofcontact_pkey" ATTACH PARTITION "public"."pointsofcontact_0_pkey";
ALTER INDEX "public"."pointsofcontact_pkey" ATTACH PARTITION "public"."pointsofcontact_1_pkey";
ALTER INDEX "public"."pointsofcontact_pkey" ATTACH PARTITION "public"."pointsofcontact_2_pkey";

CREATE POLICY "Enable select for users based on user_id" ON "public"."pointsofcontact" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "public"."pointsofcontact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pointsofcontact_0" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pointsofcontact_1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pointsofcontact_2" ENABLE ROW LEVEL SECURITY;


-- Table profiles

CREATE TABLE "public"."profiles" (
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "full_name" "text",
    "email" "text",
    PRIMARY KEY ("user_id")
);

CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION public.update_email_in_profile_table()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET email = NEW.email
    WHERE user_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

CREATE TRIGGER update_email_in_profile_table_trigger
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.update_email_in_profile_table();

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."update_email_in_profile_table"() FROM PUBLIC;

CREATE POLICY "Users can update their own data" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));
CREATE POLICY "Users can view their own data" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";

-- Table refinedpersons

CREATE TABLE "public"."refinedpersons" (
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

CREATE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."refinedpersons" FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

CREATE POLICY "Allow all operations for authenticated users on their own data" ON "public"."refinedpersons" FOR ALL TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "public"."refinedpersons" ENABLE ROW LEVEL SECURITY;

-- Table tags

CREATE TABLE "public"."tags" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text",
    PRIMARY KEY ("person_email", "name", "user_id")
)
PARTITION BY HASH ("user_id");

CREATE TABLE "public"."tags_0" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text",
    PRIMARY KEY ("person_email", "name", "user_id")
);
CREATE TABLE "public"."tags_1" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text",
    PRIMARY KEY ("person_email", "name", "user_id")
);
CREATE TABLE "public"."tags_2" (
    "person_email" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reachable" integer,
    "source" "text",
    PRIMARY KEY ("person_email", "name", "user_id")
);

ALTER TABLE ONLY "public"."tags" ATTACH PARTITION "public"."tags_0" FOR VALUES WITH (modulus 3, remainder 0);
ALTER TABLE ONLY "public"."tags" ATTACH PARTITION "public"."tags_1" FOR VALUES WITH (modulus 3, remainder 1);
ALTER TABLE ONLY "public"."tags" ATTACH PARTITION "public"."tags_2" FOR VALUES WITH (modulus 3, remainder 2);

ALTER INDEX "public"."tags_pkey" ATTACH PARTITION "public"."tags_0_pkey";
ALTER INDEX "public"."tags_pkey" ATTACH PARTITION "public"."tags_1_pkey";
ALTER INDEX "public"."tags_pkey" ATTACH PARTITION "public"."tags_2_pkey";

CREATE POLICY "Enable select for users based on user_id" ON "public"."tags" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tags_0" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tags_1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tags_2" ENABLE ROW LEVEL SECURITY;

-- Table tasks

CREATE TYPE "public"."task_category_enum" AS ENUM (
    'mining',
    'enriching',
    'cleaning'
);

CREATE TYPE "public"."task_status_enum" AS ENUM (
    'running',
    'canceled',
    'done'
);

CREATE TYPE "public"."task_type_enum" AS ENUM (
    'fetch',
    'extract',
    'edit',
    'export',
    'enrich',
    'clean'
);

CREATE TABLE "public"."tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "status" "public"."task_status_enum",
    "category" "public"."task_category_enum" NOT NULL,
    "type" "public"."task_type_enum" NOT NULL,
    "details" "jsonb",
    "duration" integer,
    "stopped_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("id")
);

CREATE POLICY "Enable select for users based on user_id" ON "public"."tasks" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tasks";
