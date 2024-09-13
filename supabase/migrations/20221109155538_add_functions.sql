set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_occurrences_per_person(personid uuid, userid uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  occurrences int;
begin
    select count(*) into occurrences filter (where cc or _to or _from or reply_to or bcc or body)
    FROM pointsofcontact where pointsofcontact.personid=get_occurrences_per_person.personid and pointsofcontact.userid=get_occurrences_per_person.userid;
  return occurrences;
end;
$function$
;

create or replace function get_alternate_names(personid uuid, userid uuid)
returns text[]
as
$$
begin
    return array
    (
        select name from public.pointsofcontact
        where public.pointsofcontact.personid=get_alternate_names.personid
        and public.pointsofcontact.userid=get_alternate_names.userid and (name != ' ' and name != '')
        group by name
        order by count(name) desc
    );
end
$$ language plpgsql;

create or replace function update_names_table_persons(personid uuid, userid uuid, alternate_names text[])
returns varchar
as
$$
declare
    freq_name varchar;
    result text[];
begin
    -- get top frequent name in x days
    select
    (
        select name FROM public.pointsofcontact
        inner join public.messages as msg on public.pointsofcontact.messageid = msg.id
        where public.pointsofcontact.personid=update_names_table_persons.personid
            and public.pointsofcontact.userid=update_names_table_persons.userid
            and msg.date >= current_date - interval '365' day
        group by name
        order by count(name) desc
        limit 1
    ) into freq_name;

    -- in case there is no name in the last x days
    if (freq_name = '' or freq_name is null) then
        freq_name = update_names_table_persons.alternate_names[1];
    end if;

    -- update name, alternate_names in table persons
    update public.persons
        set name = freq_name, alternate_names = update_names_table_persons.alternate_names
    where public.persons.id = personid;

    -- return top name
    return freq_name;
end
$$ language plpgsql;

create or replace function public.get_recency(personid uuid, userid uuid)
 returns timestamp with time zone
 LANGUAGE plpgsql
AS $function$
declare
  recency timestamp with time zone;
begin
    select max(m.date) into recency
    FROM public.messages m
		inner join public.pointsofcontact poc on poc.messageid = m.id
		where poc.userid = get_recency.userid and poc.personid = get_recency.personid;

  	return recency;
end;
$function$
;

create or replace function get_engagement(personid uuid, userid uuid)
returns int
as
$$
declare
  total int;
begin
    -- Count total of messages where message.conversation = true
  select count(*) into total
  FROM public.pointsofcontact
    inner join public.messages as msg on public.pointsofcontact.messageid = msg.id
  where public.pointsofcontact.personid=get_engagement.personid
      and public.pointsofcontact.userid=get_engagement.userid
      and msg.conversation;
  return total;
end;
$$ language plpgsql;

CREATE OR REPLACE FUNCTION public.refined_persons(userid uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    person record;
    person_name varchar;
    poc_recency timestamp with time zone;
BEGIN
    FOR person IN
        select
            personid as id,
            array_agg(name) as tags,
            public.get_occurrences_per_person(personid, refined_persons.userid) as occurrences,
            public.get_alternate_names(personid, refined_persons.userid) as alternate_names,
            public.get_engagement(personid, refined_persons.userid) as engagement,
            (select email from public.persons where id=personid) as email
        from public.tags where id not in (
            select id from public.tags 
            where name in ('transactional', 'no-reply')
        )
        group by personid
    LOOP
        person_name = public.update_names_table_persons(person.id, refined_persons.userid, person.alternate_names);
        poc_recency = public.get_recency(person.id, refined_persons.userid);
        INSERT INTO refinedpersons(personid, userid, engagement, occurence, tags, name, alternate_names, email, recency)
        VALUES(person.id, refined_persons.userid, person.engagement, person.occurrences, person.tags, person_name, person.alternate_names, person.email, poc_recency)
        ON CONFLICT(personid) DO 
        UPDATE SET occurence=person.occurrences,tags=person.tags, name=person_name, alternate_names=person.alternate_names, recency=poc_recency, engagement=person.engagement;
    END LOOP;
END;
$function$
;