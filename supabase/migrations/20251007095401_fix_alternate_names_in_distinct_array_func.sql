DROP FUNCTION private.refine_persons;
DROP FUNCTION private.get_distinct_or_exclude_from_array;

CREATE OR REPLACE FUNCTION private.get_distinct_or_exclude_from_array(
    input_array anyarray,
    exclude_array anyarray DEFAULT NULL
)
RETURNS anyarray
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT array_agg(original_value)
        FROM (
            SELECT
                unnested AS original_value,
                lower(trim(unnested)) AS normalized_value,
                MIN(array_position(input_array, unnested)) AS ord
            FROM unnest(input_array) unnested
            WHERE unnested IS NOT NULL
            GROUP BY normalized_value, original_value
        ) dedup
        WHERE exclude_array IS NULL
           OR NOT (
                normalized_value = ANY (
                    SELECT lower(trim(e)) FROM unnest(exclude_array) e WHERE e IS NOT NULL
                )
            )
        ORDER BY ord
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.refine_persons(user_id uuid) RETURNS void
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
            subquery.alternate_email,
            subquery.alternate_name,
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
                array_agg(poc.plus_address) over (partition by person_email) as alternate_email,
                array_agg(poc.name) over (partition by person_email) as alternate_name,
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
            name = record_row.name,
            alternate_name = private.get_distinct_or_exclude_from_array(record_row.alternate_name, record_row.name),
            alternate_name = private.get_distinct_or_exclude_from_array(
              record_row.alternate_name,
              ARRAY[record_row.name, record_row.person_email]
            )
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