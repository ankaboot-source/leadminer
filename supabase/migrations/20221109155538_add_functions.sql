set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_occurrences_per_person(personid uuid, userid uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  occurrences int;
begin
    select count(*) into occurrences filter (where cc or _to or _from or reply_to or bcc)
    FROM pointsofcontact where pointsofcontact.personid=get_occurrences_per_person.personid and pointsofcontact.userid=get_occurrences_per_person.userid;
  return occurrences;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_tags_per_person(personid uuid, userid uuid)
 RETURNS text[]
 LANGUAGE plpgsql
AS $function$
declare
  tag text[];
begin
    select array_agg(name) into tag from tags where tags.personid=get_tags_per_person.personid and tags.userid=get_tags_per_person.userid;
  return tag;
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
        and public.pointsofcontact.userid=get_alternate_names.userid and name != ''
        group by name
        order by count(name) desc
    );
end
$$ language plpgsql;

create or replace function update_names_table_persons(personid uuid, userid uuid)
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

    -- get total alternate names
    result = public.get_alternate_names(update_names_table_persons.personid, update_names_table_persons.userid);

    -- in case there is no name in the last x days
    if (freq_name = '' or freq_name is null) then
        freq_name = result[1];
    end if;

    -- update name, alternate_names in table persons
    update public.persons
        set name = freq_name, alternate_names = result
    where public.persons.id = personid;

    -- return top name
    return freq_name;
end
$$ language plpgsql;

CREATE OR REPLACE FUNCTION public.refined_persons(userid uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    person persons%rowtype;
    t text[];
    occurrences int;
    person_name varchar;
BEGIN
    FOR person IN
        SELECT * FROM persons WHERE _userid=refined_persons.userid
    LOOP
        t=public.get_tags_per_person(person.id, refined_persons.userid);
        occurrences=public.get_occurrences_per_person(person.id, refined_persons.userid);
        person_name=public.update_names_table_persons(person.id, refined_persons.userid);

        INSERT INTO refinedpersons(personid, userid, engagement, occurence, tags, name, email)
        VALUES(person.id, refined_persons.userid, 0, occurrences, t, person_name, person.email)
        ON CONFLICT(personid) DO UPDATE SET occurence=occurrences,tags=t;
    END LOOP;
END;
$function$
;


