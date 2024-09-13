-- DROP TABLES AND RECREATE THEM WITH PARTITIONS

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
)
PARTITION by hash(user_id);

CREATE TABLE "public"."messages_0" PARTITION OF "public"."messages" FOR
VALUES WITH (MODULUS 3, REMAINDER 0);

CREATE TABLE "public"."messages_1" PARTITION OF "public"."messages" FOR
VALUES WITH (MODULUS 3, REMAINDER 1);

CREATE TABLE "public"."messages_2" PARTITION OF "public"."messages" FOR
VALUES WITH (MODULUS 3, REMAINDER 2);

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
)
PARTITION by hash(user_id);

CREATE TRIGGER handle_updated_at BEFORE
UPDATE ON public.persons FOR EACH 
ROW EXECUTE FUNCTION moddatetime('updated_at');

CREATE TABLE "public"."persons_0" PARTITION OF "public"."persons" FOR
VALUES WITH (MODULUS 3, REMAINDER 0);

CREATE TABLE "public"."persons_1" PARTITION OF "public"."persons" FOR
VALUES WITH (MODULUS 3, REMAINDER 1);

CREATE TABLE "public"."persons_2" PARTITION OF "public"."persons" FOR
VALUES WITH (MODULUS 3, REMAINDER 2);

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
)
PARTITION by hash(user_id);

CREATE TABLE "public"."pointsofcontact_0" PARTITION OF "public"."pointsofcontact" FOR
VALUES WITH (MODULUS 3, REMAINDER 0);

CREATE TABLE "public"."pointsofcontact_1" PARTITION OF "public"."pointsofcontact" FOR
VALUES WITH (MODULUS 3, REMAINDER 1);

CREATE TABLE "public"."pointsofcontact_2" PARTITION OF "public"."pointsofcontact" FOR
VALUES WITH (MODULUS 3, REMAINDER 2);

DROP TABLE "public"."tags" CASCADE;

CREATE TABLE "public"."tags" (
    "person_email" text,
    "user_id" uuid,
    "name" text,
    "reachable" integer,
    "source" text,
    PRIMARY KEY (person_email, name, user_id)
)
PARTITION by hash(user_id);

CREATE TABLE "public"."tags_0" PARTITION OF "public"."tags" FOR
VALUES WITH (MODULUS 3, REMAINDER 0);

CREATE TABLE "public"."tags_1" PARTITION OF "public"."tags" FOR
VALUES WITH (MODULUS 3, REMAINDER 1);

CREATE TABLE "public"."tags_2" PARTITION OF "public"."tags" FOR
VALUES WITH (MODULUS 3, REMAINDER 2);

DROP TABLE "public"."refinedpersons" CASCADE;

CREATE TABLE "public"."refinedpersons" (
    "userid" uuid,
    "engagement" integer,
    "occurence" integer,
    "tags" text[],
    "name" text,
    "alternate_names" text[],
    "email" text,
	"recency" timestamp with time zone,
    PRIMARY KEY (email, userid)
)
PARTITION by hash(userid);

ALTER PUBLICATION supabase_realtime 
ADD TABLE public.refinedpersons; -- Enable realtime

CREATE TABLE "public"."refinedpersons_0" PARTITION OF "public"."refinedpersons" FOR
VALUES WITH (MODULUS 3, REMAINDER 0);

CREATE TABLE "public"."refinedpersons_1" PARTITION OF "public"."refinedpersons" FOR
VALUES WITH (MODULUS 3, REMAINDER 1);

CREATE TABLE "public"."refinedpersons_2" PARTITION OF "public"."refinedpersons" FOR
VALUES WITH (MODULUS 3, REMAINDER 2);

-- MAKE TABLES UNLOGGED
ALTER TABLE "public"."pointsofcontact"
SET unlogged;

ALTER TABLE "public"."messages"
SET unlogged;

ALTER TABLE "public"."tags"
SET unlogged;

-- UPDATE REFINED_PERSONS FUNCTION
CREATE
OR REPLACE FUNCTION public.refined_persons(userid uuid) RETURNS void 
LANGUAGE plpgsql 
AS $function$ 
DECLARE 
BEGIN
    UPDATE
        public.refinedpersons rp
    SET
        engagement = sub_query.engagement,
        recency = sub_query.recency,
        occurence = sub_query.occurrence,
        alternate_names = sub_query.alternate_names,
        name = sub_query.name
    FROM (
        SELECT
            poc.person_email,
            COALESCE(nrm.recent_name, '' :: text) AS name,
            COALESCE(
                array_agg(DISTINCT gn.alternate_name) FILTER (
                    WHERE
                        nrm.recent_name IS NOT NULL
                        AND nrm.recent_name <> ''
                        AND extensions.similarity(lower(nrm.recent_name), lower(gn.alternate_name)) < 0.7
                ),
                '{}' :: text []
            ) AS alternate_names,
            COUNT(
                CASE
                    WHEN m.conversation THEN 1
                END
            ) AS engagement,
            MAX(m.date) AS recency,
            COUNT(*) AS occurrence
        FROM pointsofcontact poc
        JOIN messages m ON poc.message_id = m.message_id
        LEFT JOIN (
            SELECT
                ( array_agg(name ORDER BY m.date DESC)) [1] AS recent_name,
                person_email
            FROM pointsofcontact poc
            JOIN messages m ON poc.message_id = m.message_id
            WHERE name <> ''
                AND name IS NOT NULL
                AND poc.user_id = refined_persons.userid
            GROUP BY person_email
        ) nrm ON poc.person_email = nrm.person_email
        LEFT JOIN (
            SELECT (array_agg(name)) [1] AS alternate_name, person_email
            FROM pointsofcontact poc
            WHERE name <> ''
                AND name IS NOT NULL
                AND poc.user_id = refined_persons.userid
            GROUP BY person_email, lower(name)
        ) gn ON poc.person_email = gn.person_email
        WHERE poc.user_id = refined_persons.userid
        GROUP BY poc.person_email, nrm.recent_name
    ) sub_query
    WHERE rp.email = sub_query.person_email;
END;
$function$;

-- UPDATE GROUPED_TAGS_BY_PERSON_VIEW VIEW
CREATE OR REPLACE VIEW public.grouped_tags_by_person_view AS
SELECT
    person_email,
    array_agg(name) AS tags,
    array_agg(reachable) AS tags_reachability
FROM tags
GROUP BY person_email;

-- UPDATE POPULATE FUNCTION
DROP FUNCTION public.populate_refined;
CREATE OR REPLACE FUNCTION public.populate_refined(_userid uuid) RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO refinedpersons(userid, tags, name, email)
    SELECT populate_refined._userid, t.tags, name, email
    FROM public.persons p
    INNER JOIN public.grouped_tags_by_person_view AS t ON t.person_email = email
    WHERE p.user_id=populate_refined._userid AND NOT t.tags_reachability && '{0}'
    ON conflict(email, userid) do nothing;
END;
$function$;
