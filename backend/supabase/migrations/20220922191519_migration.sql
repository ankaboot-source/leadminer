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
    folder text,
    date timestamptz,
    userID uuid,
    listid text,
    messageid text,
    reference text,
    PRIMARY KEY (id,userID)
);



CREATE TABLE IF NOT EXISTS public.domains
(
    id SERIAL PRIMARY KEY,
    name text,
    lastCheck timestamptz,
    emailServertype text
);

CREATE TABLE IF NOT EXISTS public.organizations
(
    name text,
    domain SERIAL,
    CONSTRAINT name PRIMARY KEY (name),
    FOREIGN KEY (domain) REFERENCES domains(id)
);


CREATE TABLE IF NOT EXISTS public.persons
(
    personID uuid DEFAULT uuid_generate_v4(),
    name text,
    email text,
    url text,
    image text,
    address text,
    alternateNames text ARRAY,
    sameAs text ARRAY,
    givenName text,
    familyName text,
    jobTitle text,
    worksFor text,
    PRIMARY KEY (personID),
    UNIQUE(email),
    FOREIGN KEY (worksFor) REFERENCES organizations(name)
    
);

CREATE TABLE IF NOT EXISTS public.pointsofcontact
(
    id uuid DEFAULT uuid_generate_v4(),
    userID uuid,
    messageID uuid,
    _from bool,
    reply_to bool,
    _to bool,
    cc bool,
    bcc bool,
    _personid uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (userID, messageID) REFERENCES messages(userID,id),
    FOREIGN KEY (_personid) REFERENCES persons(personID)

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
    FOREIGN KEY (personid) REFERENCES persons(personID)
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
    FOREIGN KEY (personid) REFERENCES persons(personID)
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
    FROM pointsofcontact where _personid=get_occurences_per_person.personid and pointsofcontact.userid=get_occurences_per_person.userid;
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
        SELECT * FROM persons
    LOOP
        t=public.get_tags_per_person(person.personid, refined_persons.userid);
        occurences=public.get_occurences_per_person(person.personid, refined_persons.userid);
        pid=person.personid;
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