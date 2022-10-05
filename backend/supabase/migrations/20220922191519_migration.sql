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

CREATE TABLE IF NOT EXISTS public.pointsofcontact
(
    id uuid DEFAULT uuid_generate_v4(),
    userID uuid,
    messageID uuid,
    name text,
    sender bool,
    recipient bool,
    toRecipient bool,
    ccRecipient bool,
    bccRecipient bool,
    PRIMARY KEY (id),
    FOREIGN KEY (userID, messageID) REFERENCES messages(userID,id)
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
    pointofcontact uuid,
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
    FOREIGN KEY (pointofcontact) REFERENCES pointsofcontact(id),
    FOREIGN KEY (worksFor) REFERENCES organizations(name)
);

