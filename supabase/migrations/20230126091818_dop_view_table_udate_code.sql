
DROP VIEW IF EXISTS public.calculated_refined_view;

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
      SELECT personid, array_agg(distinct(name)) as alternate_names
      FROM pointsofcontact_subquery 
      GROUP BY personid
    )
    UPDATE public.refinedpersons
    SET engagement = pointsofcontact_subquery.engagement, 
        recency = pointsofcontact_subquery.recency, 
        occurence = pointsofcontact_subquery.occurence, 
        alternate_names = alternate_names.alternate_names
    FROM pointsofcontact_subquery
    JOIN alternate_names 
    ON pointsofcontact_subquery.personid = alternate_names.personid
    WHERE refinedpersons.personid = pointsofcontact_subquery.personid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.populate_refined(userid uuid) RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO refinedpersons(personid, userid, tags, name, email)
    SELECT id, populate_refined.userid, t.tags, name, email
    FROM public.persons
    INNER JOIN public.grouped_tags_by_person_view AS t ON t.personid = id
    WHERE persons._userid=populate_refined.userid AND NOT t.tags_reachability && '{0}'
  ON conflict(personid) do nothing;
END;
$function$;