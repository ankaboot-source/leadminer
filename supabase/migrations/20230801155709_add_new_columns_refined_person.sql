alter table "public"."refinedpersons" add column "seniority" timestamp with time zone;
alter table "public"."refinedpersons" add column "sender" integer;
alter table "public"."refinedpersons" add column "recipient" integer;
alter table "public"."refinedpersons" add column "conversations" integer;
alter table "public"."refinedpersons" add column "replied_conversations" integer;

CREATE OR REPLACE FUNCTION public.refined_persons(userid uuid) RETURNS void 
LANGUAGE plpgsql 
AS $function$ 
DECLARE 
BEGIN
    UPDATE
        public.refinedpersons rp
    SET
        engagement = sub_query.engagement,
        recency = sub_query.recency,
        seniority = sub_query.seniority,
        occurence = sub_query.occurrence,
        alternate_names = null,
        name = sub_query.name,
        sender = sub_query.sender,
        recipient = sub_query.recipient,
        conversations = sub_query.conversations,
        replied_conversations = sub_query.replied_conversations

    FROM (
        SELECT distinct
            subquery.person_email,
            first_value(name) over (partition by person_email order by total desc, source desc, recent_date desc) AS name,
            subquery.occurrence,
            subquery.sender + subquery.replied_conversations as engagement,
            subquery.recency,
            subquery.seniority,
            subquery.sender,
            subquery.recipient,
            subquery.conversations,
            subquery.replied_conversations
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
                ) over grouped_by_email AS replied_conversations

            FROM pointsofcontact poc
            JOIN messages m ON poc.message_id = m.message_id
            WHERE
              poc.user_id = refined_persons.userid
            WINDOW grouped_by_email AS (PARTITION BY person_email)
        ) subquery
    ) sub_query
    WHERE rp.email = sub_query.person_email;
END;
$function$; 