CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
-- https://github.com/supabase/postgrest-js/issues/168#issuecomment-1257689491
GRANT EXECUTE
ON FUNCTION extensions.similarity(text, text)
TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refined_persons(userid uuid) RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
BEGIN
  UPDATE public.refinedpersons rp
  SET
    engagement = subquery.engagement,
    recency = subquery.recency,
    occurence = subquery.occurrence,
    alternate_names = subquery.alternate_names,
    name = subquery.name
  FROM (
    SELECT
      poc.personid,
      COALESCE(nrm.recent_name, ''::text) AS name,
      COALESCE(array_agg(DISTINCT gn.alternate_name)
        FILTER (
          WHERE nrm.recent_name IS NOT NULL
                AND nrm.recent_name <> ''
                AND extensions.similarity(lower(nrm.recent_name), lower(gn.alternate_name)) < 0.7),
        '{}'::text[]) AS alternate_names,
      COUNT(CASE WHEN m.conversation THEN 1 END) AS engagement,
      MAX(m.date) AS recency,
      COUNT(*) AS occurrence
    FROM pointsofcontact poc
    JOIN messages m ON poc.messageid = m.id
    LEFT JOIN (
      SELECT
        ( array_agg(name ORDER BY m.date DESC) )[1] AS recent_name,
        personid
      FROM pointsofcontact poc
        JOIN messages m ON poc.messageid = m.id
      WHERE name <> ''
            AND name IS NOT NULL
            AND poc.userid = refined_persons.userid
      GROUP BY personid
    ) nrm ON poc.personid = nrm.personid
    LEFT JOIN (
      SELECT
        (array_agg(name))[1] AS alternate_name,
        personid
      FROM pointsofcontact poc
      WHERE name <> ''
            AND name IS NOT NULL
            AND poc.userid = refined_persons.userid
      GROUP BY personid, lower(name)
    ) gn ON poc.personid = gn.personid
    WHERE poc.userid = refined_persons.userid
    GROUP BY poc.personid, nrm.recent_name
  ) subquery
  WHERE rp.personid = subquery.personid;
END;
$function$;
