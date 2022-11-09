-- --required for app level authentication layer(not the imap, but leadminer app)
-- CREATE TABLE IF NOT EXISTS public.users
-- (
--     id uuid DEFAULT uuid_generate_v4(),
--     email text, -- email used to connect to leadminer
--     password text,
--     emailHash text,
--     PRIMARY KEY (id)  
-- );


CREATE TABLE IF NOT EXISTS public.messages
(
    id uuid DEFAULT uuid_generate_v4(),
    channel text,
    folder_path text,
    date timestamptz,
    userid uuid,
    listid text,
    message_id text UNIQUE,
    reference text,
    PRIMARY KEY (id,userid)
);



CREATE TABLE IF NOT EXISTS public.domains
(
    id uuid DEFAULT uuid_generate_v4(),
    name text,
    last_check timestamptz,
    email_server_type text,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.organizations
(
    name text,
    alternate_name text,
    address text,
    url text,
    legal_name text,
    telephone text,
    email text,
    image text,
    founder uuid,
    employee uuid,
    _domain uuid,
    CONSTRAINT name PRIMARY KEY (name),
    FOREIGN KEY (_domain) REFERENCES domains(id)
    --FOREIGN KEY (founder) REFERENCES persons(id)
    


);


CREATE TABLE IF NOT EXISTS public.persons
(
    id uuid DEFAULT uuid_generate_v4(),
    name text,
    email text,
    _userid uuid,
    url text,
    image text,
    address text,
    alternate_names text ARRAY,
    same_as text ARRAY,
    given_name text,
    family_name text,
    job_title text,
    works_for text DEFAULT (''),
    PRIMARY KEY (id),
    UNIQUE(email)
    --FOREIGN KEY (works_for) REFERENCES organizations(name)
);

CREATE TABLE IF NOT EXISTS public.pointsofcontact
(
    id uuid DEFAULT uuid_generate_v4(),
    userid uuid,
    messageid uuid,
    name text,
    _from bool, --reserved word in postgres, so we can't use from
    reply_to bool,
    _to bool, --reserved
    cc bool,
    bcc bool,
    personid uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (userid, messageid) REFERENCES messages(userid,id),
    FOREIGN KEY (personid) REFERENCES persons(id)

);


CREATE TABLE IF NOT EXISTS public.tags
(
    id uuid DEFAULT uuid_generate_v4(),
    personid uuid,
    userid uuid,
    name text,
    label text,
    reachable int,
    type text,
    PRIMARY KEY (id),
    UNIQUE (personid, name),
    FOREIGN KEY (personid) REFERENCES persons(id)
);


CREATE TABLE IF NOT EXISTS public.refinedpersons
(
    id uuid DEFAULT uuid_generate_v4(),
    personid uuid,
    userid uuid,
    --recency date,
    engagement int,
    occurence int,
    tags text ARRAY,
    name text,
    email text,
    PRIMARY KEY (id),
    UNIQUE(personid),
    FOREIGN KEY (personid) REFERENCES persons(id)
);

begin;

  -- remove the supabase_realtime publication
  drop publication if exists supabase_realtime;

  -- re-create the supabase_realtime publication with no tables
  create publication supabase_realtime;

commit;
-- add a table to the publication
alter publication supabase_realtime add table public.refinedpersons;

create or replace function get_tags_per_person(personid uuid, userid uuid)
returns text[]
language plpgsql
as $$
declare
  tag text[];
begin
    select array_agg(name) into tag from tags where tags.personid=get_tags_per_person.personid and tags.userid=get_tags_per_person.userid;
  return tag;
end;
$$;


create or replace function get_occurrences_per_person(personid uuid,userid uuid)
returns int
language plpgsql
as $$
declare
  occurrences int;
begin
    select count(*) into occurrences filter (where cc or _to or _from or reply_to or bcc)
    FROM pointsofcontact where pointsofcontact.personid=get_occurrences_per_person.personid and pointsofcontact.userid=get_occurrences_per_person.userid;
  return occurrences;
end;
$$;

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
    select array
    (
        select name from public.pointsofcontact
        where public.pointsofcontact.personid=update_names_table_persons.personid
        and public.pointsofcontact.userid=update_names_table_persons.userid and name != ''
        group by name
        order by count(name) desc
    ) into result;

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

create or replace function refined_persons(userid uuid) RETURNS void
language plpgsql
as $$
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
$$



-- HOW TO DROP a FUNCTION 

-- DO $$DECLARE command text;
-- BEGIN
-- command = (SELECT 'DROP FUNCTION ' || ns.nspname || '.' || proname 
--       || '(' || oidvectortypes(proargtypes) || ');'
--  FROM pg_proc INNER JOIN pg_namespace ns ON (pg_proc.pronamespace = ns.oid)
--   WHERE ns.nspname = 'public'  order by proname LIMIT 1);
-- execute command;    
-- END$$;