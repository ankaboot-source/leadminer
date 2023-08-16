-- Rename the column "occurence" to "frequency"
ALTER TABLE refinedpersons RENAME COLUMN "occurence" TO "frequency";

-- Drop the column "alternate_names"
ALTER TABLE refinedpersons DROP COLUMN alternate_names;

-- Removes the engagement score
-- removes alternate_names L20,
-- Renames occurence to frequency L18, L30, L50

CREATE OR REPLACE FUNCTION public.refined_persons(userid uuid) RETURNS void 
LANGUAGE plpgsql 
AS $function$ 
DECLARE 
BEGIN
    UPDATE
        public.refinedpersons rp
    SET
        recency = sub_query.recency,
        seniority = sub_query.seniority,
        frequency = sub_query.frequency,
        name = sub_query.name,
        sender = sub_query.sender,
        recipient = sub_query.recipient,
        conversations = sub_query.conversations,
        replied_conversations = sub_query.replied_conversations

    FROM (
        SELECT distinct
            subquery.person_email,
            first_value(name) over (partition by person_email order by total desc, source desc, recent_date desc) AS name,
            subquery.frequency,
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
                COUNT(*) over grouped_by_email AS frequency,
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