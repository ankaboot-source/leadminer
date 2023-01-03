
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
    select (
        select name FROM public.pointsofcontact
        inner join public.messages as msg on public.pointsofcontact.messageid = msg.id
        where public.pointsofcontact.personid=get_most_recent_name.personid
            and msg.date >= current_date - interval '365' day
        group by name
        order by count(name) desc
        limit 1
    ) into person_name;

    if (person_name = '' or person_name is null) then
      return (
        select name FROM public.pointsofcontact
        inner join public.messages as msg on public.pointsofcontact.messageid = msg.id
        where public.pointsofcontact.personid=get_most_recent_name.personid
        group by name
        order by count(name) desc
        limit 1
      );
    end if;
    return person_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refined_persons(userid uuid) RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
BEGIN
  update public.refinedpersons
    set engagement=person.engagement, recency=person.recency, occurence=person.occurence, alternate_names=person.alternate_names
    from (
      select
        personid,
        refined_persons.userid as userid,
        count(*) filter (where msg.conversation) as engagement,
        max(msg.date) as recency,
        count(*) filter (where cc or _to or _from or reply_to or bcc or body) as occurence,
        public.get_most_recent_name(personid) as name,
        array_agg(distinct(name)) as alternate_names
      from public.pointsofcontact
        inner join public.messages as msg on public.pointsofcontact.messageid = msg.id
      where public.pointsofcontact.userid=refined_persons.userid
      group by personid
    ) as person
    where refinedpersons.personid=person.personid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.populate_refined(userid uuid) RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO refinedpersons(personid, userid, tags, name, email)
    select id,
    populate_refined.userid as userid,
    tags,
    name,
    email
    from (
      select id, persons.name, email, array(
        select tags.name
        from tags
        where tags.personid=public.persons.id group by tags.personid, tags.name
      ) as tags
      from public.persons
    ) as _
    where not tags && '{"transactional", "no-reply"}'
END;
$function$