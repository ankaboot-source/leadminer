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
    sender bool,
    recipient bool,
    toRecipient bool,
    ccRecipient bool,
    bccRecipient bool,
    _personid uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (userID, messageID) REFERENCES messages(userID,id),
    FOREIGN KEY (_personid) REFERENCES persons(personID)

);


CREATE TABLE IF NOT EXISTS public.tags
(
    id uuid DEFAULT uuid_generate_v4(),
    personid uuid,
    name text,
    label text,
    reachable int,
    type text,
    PRIMARY KEY (id),
    UNIQUE (personid, name),
    FOREIGN KEY (personid) REFERENCES persons(personID)
);