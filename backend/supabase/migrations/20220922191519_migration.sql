--required for app level authentication layer(not the imap, but leadminer app)
CREATE TABLE IF NOT EXISTS public.users
(
    id uuid DEFAULT uuid_generate_v4(),
    email text, -- email used to connect to leadminer.io
    password text,
    emailHash text,
    PRIMARY KEY (id)  
);


--stores the imapConnections infos(multi-tenancy)
CREATE TABLE IF NOT EXISTS public.imapConnections
(
    id uuid DEFAULT uuid_generate_v4(),
    userID uuid,
    email text, --email used in connecting to imap server
    imapHost text,
    port text,
    usingImap bool,
    apiGoogle bool,
    apiMicrosoft bool,
    refreshToken text, --if it's api connection
    lastConnection timestamptz,
    folders text, --it will be stored as stringfied object
    events text ARRAY, --it could be jsonb, but for now will append small events that are related to this connetion eg:user refetched folders tree, user excutes mining for folders...
    boxStatus text, --mailbox status
   PRIMARY KEY (id),
    FOREIGN KEY (userID) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS public.messages
(
    id text,
    channel text,
    folder text,
    date timestamptz,
    userID uuid,
    connectionID uuid,
    PRIMARY KEY (id,userID),
    FOREIGN KEY (userID) REFERENCES users(id),                 --|
    FOREIGN KEY (connectionID) REFERENCES imapConnections(id)  --|-> the user, and the message should be here


);
CREATE TABLE IF NOT EXISTS public.pointsofcontact
(
    id uuid DEFAULT uuid_generate_v4(),
    userID uuid,
    messageID text,
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
    type text
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
    userID uuid,
    messageID text,
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

