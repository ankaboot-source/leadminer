
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
  update public.refinedpersons
    set engagement=person.engagement, recency=person.recency, occurence=person.occurence, alternate_names=person.alternate_names
    from public.calculated_refined_view as person
    where refinedpersons.personid=person.personid and person.userid = refined_persons.userid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.populate_refined(userid uuid) RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO refinedpersons(personid, userid, tags, name, email)
    select id, populate_refined.userid, t.tags, name, email
    from public.persons
    inner join public.grouped_tags_by_person_view as t on t.personid = id
    where not t.tags_reachability && '{0}'
  on conflict(personid) do nothing;
END;
$function$;

create or replace view public.grouped_tags_by_person_view as
    select
    array_agg(name) as tags,
    array_agg(reachable) as tags_reachability,
    personid
    from tags
    group  by personid;
    
create or replace view public.calculated_refined_view as
  select
      personid,
      pointsofcontact.userid,
      count(*) filter (where msg.conversation) as engagement,
      max(msg.date) as recency,
      count(*) filter (where cc or _to or _from or reply_to or bcc or body) as occurence,
      public.get_most_recent_name(personid) as name,
      array_agg(distinct(name)) as alternate_names
  from public.pointsofcontact
  inner join messages as msg on msg.id = messageid
  group by personid, pointsofcontact.userid;