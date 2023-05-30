DROP TABLE "public"."messages" CASCADE;

CREATE TABLE "public"."messages" (
    -- "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "channel" text,
    "folder_path" text,
    "date" timestamp WITH time zone,
    "user_id" uuid NOT NULL,
    "list_id" text,
    "message_id" text,
    "references" text [],
    "conversation" boolean,
    PRIMARY KEY (message_id, user_id)
) PARTITION by hash(user_id);

CREATE TABLE "public"."messages_0" PARTITION OF "public"."messages" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 0);

CREATE TABLE "public"."messages_1" PARTITION OF "public"."messages" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 1);

CREATE TABLE "public"."messages_2" PARTITION OF "public"."messages" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 2);

DROP TABLE "public"."persons" CASCADE;

CREATE TABLE "public"."persons" (
    -- "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
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
    "identifiers" text [],
    "created_at" timestamp without time zone NOT NULL DEFAULT NOW(),
    "updated_at" timestamp without time zone NOT NULL DEFAULT NOW(),
    PRIMARY KEY (email, user_id)
) PARTITION by hash(user_id);

CREATE TRIGGER handle_updated_at BEFORE
UPDATE
    ON public.persons FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

CREATE TABLE "public"."persons_0" PARTITION OF "public"."persons" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 0);

CREATE TABLE "public"."persons_1" PARTITION OF "public"."persons" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 1);

CREATE TABLE "public"."persons_2" PARTITION OF "public"."persons" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 2);

DROP TABLE "public"."pointsofcontact" CASCADE;

CREATE TABLE "public"."pointsofcontact" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid,
    "message_id" text,
    "name" text,
    "from" boolean,
    "reply_to" boolean,
    "to" boolean,
    "cc" boolean,
    "bcc" boolean,
    "body" boolean,
    "person_email" text,
    PRIMARY KEY (id, user_id)
) PARTITION by hash(user_id);

CREATE TABLE "public"."pointsofcontact_0" PARTITION OF "public"."pointsofcontact" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 0);

CREATE TABLE "public"."pointsofcontact_1" PARTITION OF "public"."pointsofcontact" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 1);

CREATE TABLE "public"."pointsofcontact_2" PARTITION OF "public"."pointsofcontact" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 2);

DROP TABLE "public"."tags" CASCADE;

CREATE TABLE "public"."tags" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "person_email" text,
    "user_id" uuid,
    "name" text,
    "reachable" integer,
    PRIMARY KEY (id, user_id)
) PARTITION by hash(user_id);

CREATE TABLE "public"."tags_0" PARTITION OF "public"."tags" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 0);

CREATE TABLE "public"."tags_1" PARTITION OF "public"."tags" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 1);

CREATE TABLE "public"."tags_2" PARTITION OF "public"."tags" FOR
VALUES
    WITH (MODULUS 3, REMAINDER 2);

-- MAKE TABLES UNLOGGED
ALTER TABLE
    "public"."pointsofcontact"
SET
    unlogged;

ALTER TABLE
    "public"."messages"
SET
    unlogged;

ALTER TABLE
    "public"."tags"
SET
    unlogged;