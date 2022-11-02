-- --required for app level authentication layer(not the imap, but leadminer app)
-- CREATE TABLE IF NOT EXISTS public.users
-- (
--     id uuid DEFAULT uuid_generate_v4(),
--     email text, -- email used to connect to leadminer.io
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
    PRIMARY KEY (messageid,userid)
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
    _from bool, --reserved word in postgres, so we can't use from
    reply_to bool,
    _to bool, --reserved
    cc bool,
    bcc bool,
    personid uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (userid, messageid) REFERENCES messages(userid,messageid),
    FOREIGN KEY (personid) REFERENCES persons(id)

);


CREATE TABLE IF NOT EXISTS public.tags
(
    tagid uuid DEFAULT uuid_generate_v4(),
    personid uuid,
    userid uuid,
    name text,
    label text,
    reachable int,
    type text,
    PRIMARY KEY (tagid),
    UNIQUE (personid, name),
    FOREIGN KEY (personid) REFERENCES persons(id)
);


CREATE TABLE IF NOT EXISTS public.refinedpersons
(
    refinedid uuid DEFAULT uuid_generate_v4(),
    personid uuid,
    userid uuid,
    --recency date,
    engagement int,
    occurence int,
    tags text ARRAY,
    name text,
    email text,
    PRIMARY KEY (refinedid),
    UNIQUE(personid),
    FOREIGN KEY (personid) REFERENCES persons(id)
);


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


create or replace function get_occurences_per_person(personid uuid,userid uuid)
returns int
language plpgsql
as $$
declare
  occurences int;
begin
    select count(*) into occurences filter (where cc or _to or _from or reply_to or bcc)
    FROM pointsofcontact where pointsofcontact.personid=get_occurences_per_person.personid and pointsofcontact.userid=get_occurences_per_person.userid;
  return occurences;
end;
$$;


create or replace function refined_persons(userid uuid) RETURNS void
language plpgsql
as $$
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