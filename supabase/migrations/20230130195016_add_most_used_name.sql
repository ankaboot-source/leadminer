DROP FUNCTION IF EXISTS public.get_most_recent_name;

CREATE OR REPLACE FUNCTION public.refined_persons(userid uuid) RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
BEGIN
  WITH pointsofcontact_subquery AS (
    SELECT 
      personid,
      name,
      count(*) FILTER (WHERE msg.conversation) AS engagement,
      max(msg.date) AS recency,
      count(*) AS occurence
    FROM public.pointsofcontact
      INNER JOIN public.messages msg ON public.pointsofcontact.messageid = msg.id
    WHERE public.pointsofcontact.userid=refined_persons.userid
    GROUP BY personid, name
  )
  , alternate_names AS (
  SELECT personid, array_agg(name ORDER BY occurence desc) as alternate_names
  FROM pointsofcontact_subquery
  WHERE name <> ''
  GROUP BY personid
  )
  UPDATE public.refinedpersons
  SET
    engagement = pointsofcontact_subquery.engagement,
    recency = pointsofcontact_subquery.recency,
    occurence = pointsofcontact_subquery.occurence,
    alternate_names = COALESCE(alternate_names.alternate_names, ARRAY[]::text[]),
    name = COALESCE(
    (
    SELECT alternate_names[1]
    FROM alternate_names
    WHERE alternate_names.personid = refinedpersons.personid
    ), ''
    )
  FROM pointsofcontact_subquery
    LEFT JOIN alternate_names
    ON pointsofcontact_subquery.personid = alternate_names.personid
  WHERE refinedpersons.personid = pointsofcontact_subquery.personid;
END;
$function$;