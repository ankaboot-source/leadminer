DROP FUNCTION IF EXISTS public.get_most_recent_name;

CREATE OR REPLACE FUNCTION public.refined_persons(userid uuid) RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
BEGIN
  UPDATE public.refinedpersons
  SET
    engagement = subquery.engagement,
    recency = subquery.recency,
    occurence = subquery.occurence,
    alternate_names = subquery.alternate_names,
    name = subquery.name
  FROM (
    SELECT
      poc.personid,
      coalesce((array_agg(poc.name ORDER BY m.date desc) FILTER (WHERE name IS NOT NULL AND name <> ''))[1], '') AS name,
      coalesce(array_agg(distinct name) FILTER (WHERE name IS NOT NULL AND name <> ''), '{}'::text[])  as alternate_names,
      count(CASE WHEN m.conversation THEN 1 ELSE NULL END) AS engagement,
      max(m.date) AS recency,
      count(*) AS occurence
    FROM pointsofcontact poc
      JOIN messages m ON poc.messageid = m.id
    WHERE poc.userid = refined_persons.userid
    GROUP BY poc.personid
  ) subquery
  WHERE refinedpersons.personid = subquery.personid;
END;
$function$;