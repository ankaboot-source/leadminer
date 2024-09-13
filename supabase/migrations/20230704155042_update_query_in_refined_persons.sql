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
                array_agg(DISTINCT name) FILTER (
                    WHERE
                        name IS NOT NULL and name <> ''
                        AND nrm.recent_name IS NOT NULL AND nrm.recent_name <> ''
                        AND extensions.similarity(lower(nrm.recent_name), lower(name)) < 0.7
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
        WHERE poc.user_id = refined_persons.userid
        GROUP BY poc.person_email, nrm.recent_name
    ) sub_query
    WHERE rp.email = sub_query.person_email;
END;
$function$;