
drop function public.get_occurrences_per_person;
drop function public.get_alternate_names;
drop function public.update_names_table_persons;
drop function public.get_recency;
drop function public.get_engagement;
drop function public.refined_persons;

CREATE OR REPLACE FUNCTION public.get_most_recent_name(personid uuid) RETURNS varchar
LANGUAGE plpgsql
AS $function$
DECLARE
  person_name text;
BEGIN
    return (
        select name FROM public.pointsofcontact
        inner join public.messages as msg on public.pointsofcontact.messageid = msg.id
        where 
        (
          public.pointsofcontact.personid=get_most_recent_name.personid
          and msg.date >= current_date - interval '365' day 
          and name != ''
        ) or public.pointsofcontact.personid=get_most_recent_name.personid and name !=''
        group by name
        order by count(name) desc
        limit 1
    );
END;
$function$;

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
        count(*) FILTER (WHERE cc OR _to OR _from OR reply_to OR bcc OR body) AS occurence
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

create or replace view public.grouped_tags_by_person_view as
    select
    array_agg(name) as tags,
    array_agg(reachable) as tags_reachability,
    personid
    from tags
    group  by personid;