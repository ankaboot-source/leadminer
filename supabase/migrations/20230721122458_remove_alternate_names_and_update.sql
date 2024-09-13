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
        alternate_names = null,
        name = sub_query.name
    FROM (
        SELECT
            subquery.person_email,
            first_value(name) over (partition by person_email order by total desc, recent_date desc) as name,
            subquery.occurrence,
            subquery.engagement,
            subquery.recency
        FROM (
            SELECT distinct
                person_email,
                name,
                MAX(m.date) over (partition by person_email, name) AS recent_date,
                COUNT(*) over (partition by person_email) AS occurrence,
                count(
                  CASE
                    WHEN name is not null THEN 1
                  END) over (partition by person_email, name) AS total,
                COUNT(
                  CASE
                    WHEN m.conversation THEN 1
                  END
                ) over (partition by person_email) AS engagement,
                MAX(m.date) over (partition by person_email) AS recency
            FROM pointsofcontact poc
            JOIN messages m ON poc.message_id = m.message_id
            WHERE
              poc.user_id = refined_persons.userid
        ) subquery
    ) sub_query
    WHERE rp.email = sub_query.person_email;
END;
$function$;