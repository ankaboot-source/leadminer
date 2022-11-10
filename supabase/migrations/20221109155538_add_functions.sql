set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_occurences_per_person(personid uuid, userid uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  occurences int;
begin
    select count(*) into occurences filter (where cc or _to or _from or reply_to or bcc)
    FROM pointsofcontact where pointsofcontact.personid=get_occurences_per_person.personid and pointsofcontact.userid=get_occurences_per_person.userid;
  return occurences;
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

CREATE OR REPLACE FUNCTION public.refined_persons(userid uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    person persons%rowtype;
    t text[];
    occurences int;
    pid uuid;
    uidd uuid;
BEGIN
    uidd=refined_persons.userid;
    FOR person IN
        SELECT * FROM persons WHERE _userid=uidd
    LOOP
        t=public.get_tags_per_person(person.id, uidd);
        occurences=public.get_occurences_per_person(person.id, uidd);
        pid=person.id;
        INSERT INTO refinedpersons(personid, userid, engagement, occurence, tags, name, email)
        VALUES(pid, uidd, 0, occurences, t, person.name, person.email)
        ON CONFLICT(personid) DO UPDATE SET occurence=occurences,tags=t;
    END LOOP;
END;
$function$
;


