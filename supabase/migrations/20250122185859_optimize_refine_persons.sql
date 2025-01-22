DROP FUNCTION private.get_grouped_tags_by_person;
DROP FUNCTION private.refine_persons;
CREATE OR REPLACE FUNCTION private.refine_persons(userid uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    CREATE TEMP TABLE user_points_of_contact AS
        SELECT
            poc.person_email,
            poc.name,
            poc.plus_address,
            poc.message_id,
            poc."from",
            poc."to",
            poc.bcc,
            poc.cc,
            poc.reply_to,
            m.date,
            m.conversation
        FROM private.pointsofcontact poc
        JOIN private.messages m 
            ON poc.message_id = m.message_id
            AND poc.user_id = m.user_id
        WHERE poc.user_id = userid;

    CREATE TEMP TABLE grouped_tags AS
       SELECT
         person_email AS email,
         array_agg(name) AS tags
       FROM private.tags tg
       WHERE
        tg.user_id = userid
        AND reachable IN (1, 2)
        AND person_email NOT IN (
            SELECT person_email
            FROM private.tags tg
            WHERE tg.user_id = userid
            GROUP BY person_email
            HAVING
                MAX(reachable) = 3
                  OR (count(DISTINCT reachable) = 1 AND MAX(reachable) = 3)
                  OR (count(DISTINCT reachable) = 2 AND ARRAY[1, 3] <@ array_agg(DISTINCT reachable))
          )
        GROUP BY person_email;

    CREATE TEMP TABLE name_aggregates AS
        SELECT
            fd.person_email,
            fd.name,
            MAX(fd.date) AS recent_date,
            COUNT(*) AS total,
            array_agg(fd.name) OVER (PARTITION BY fd.person_email) AS alternate_name
        FROM user_points_of_contact fd
        WHERE fd.name IS NOT NULL
        GROUP BY fd.person_email, fd.name;

    CREATE TEMP TABLE real_names AS
        SELECT DISTINCT
            na.person_email,
            FIRST_VALUE(na.name) OVER (
                PARTITION BY na.person_email
                ORDER BY na.total DESC, na.recent_date DESC
            ) AS preferred_name,
            na.alternate_name
        FROM name_aggregates na;

    CREATE TEMP TABLE email_aggregates AS
        SELECT
            fd.person_email,
            MAX(fd.date) AS recency,
            MIN(fd.date) AS seniority,
            private.get_distinct_or_exclude_from_array(array_agg(fd.plus_address)) AS alternate_email,
            COUNT(*) AS occurrence,
            COUNT(CASE WHEN fd."from" = true OR fd.reply_to = true THEN 1 END) AS sender,
            COUNT(CASE WHEN fd."to" = true OR fd.bcc = true OR fd.cc = true THEN 1 END) AS recipient,
            COUNT(CASE WHEN fd.conversation = true THEN 1 END) AS conversations,
            COUNT(CASE WHEN fd.conversation = true AND fd."from" = true THEN 1 END) AS replied_conversations
        FROM user_points_of_contact fd
        GROUP BY fd.person_email;

    CREATE TEMP TABLE combined_data AS
        SELECT
            ea.*,
            gt.tags as tags,
            pn.preferred_name AS name,
            private.get_distinct_or_exclude_from_array(pn.alternate_name, pn.preferred_name) AS alternate_name
        FROM email_aggregates ea
        LEFT JOIN real_names pn ON ea.person_email = pn.person_email
        JOIN grouped_tags gt ON ea.person_email = gt.email;

    INSERT INTO private.refinedpersons (
        user_id, email, occurrence, recency, seniority,
        sender, recipient, conversations, replied_conversations, tags
    )
    SELECT
        userid,
        cd.person_email,
        cd.occurrence,
        cd.recency,
        cd.seniority,
        cd.sender,
        cd.recipient,
        cd.conversations,
        cd.replied_conversations,
        cd.tags
    FROM combined_data cd
    ON CONFLICT (user_id, email) DO UPDATE
    SET
        occurrence = EXCLUDED.occurrence,
        recency = EXCLUDED.recency,
        seniority = EXCLUDED.seniority,
        sender = EXCLUDED.sender,
        recipient = EXCLUDED.recipient,
        conversations = EXCLUDED.conversations,
        replied_conversations = EXCLUDED.replied_conversations,
        tags = EXCLUDED.tags;
END;
$$;
