create table "public"."domains" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text,
    "last_check" timestamp with time zone,
    "email_server_type" text
);


create table "public"."messages" (
    "id" uuid not null default uuid_generate_v4(),
    "channel" text,
    "folder_path" text,
    "date" timestamp with time zone,
    "userid" uuid not null,
    "listid" text,
    "message_id" text,
    "reference" text
);


create table "public"."organizations" (
    "name" text not null,
    "alternate_name" text,
    "address" text,
    "url" text,
    "legal_name" text,
    "telephone" text,
    "email" text,
    "image" text,
    "founder" uuid,
    "employee" uuid,
    "_domain" uuid
);


create table "public"."persons" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text,
    "email" text,
    "_userid" uuid,
    "url" text,
    "image" text,
    "address" text,
    "alternate_names" text[],
    "same_as" text[],
    "given_name" text,
    "family_name" text,
    "job_title" text,
    "works_for" text default ''::text
);


create table "public"."pointsofcontact" (
    "id" uuid not null default uuid_generate_v4(),
    "userid" uuid,
    "messageid" uuid,
    "name" text,
    "_from" boolean,
    "reply_to" boolean,
    "_to" boolean,
    "cc" boolean,
    "bcc" boolean,
    "personid" uuid
);


create table "public"."refinedpersons" (
    "id" uuid not null default uuid_generate_v4(),
    "personid" uuid,
    "userid" uuid,
    "engagement" integer,
    "occurence" integer,
    "tags" text[],
    "name" text,
    "email" text
);


create table "public"."tags" (
    "id" uuid not null default uuid_generate_v4(),
    "personid" uuid,
    "userid" uuid,
    "name" text,
    "label" text,
    "reachable" integer,
    "type" text
);


CREATE UNIQUE INDEX domains_pkey ON public.domains USING btree (id);

CREATE UNIQUE INDEX messages_message_id_key ON public.messages USING btree (message_id);

CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id, userid);

CREATE UNIQUE INDEX name ON public.organizations USING btree (name);

CREATE UNIQUE INDEX persons_email_key ON public.persons USING btree (email);

CREATE UNIQUE INDEX persons_pkey ON public.persons USING btree (id);

CREATE UNIQUE INDEX pointsofcontact_pkey ON public.pointsofcontact USING btree (id);

CREATE UNIQUE INDEX refinedpersons_personid_key ON public.refinedpersons USING btree (personid);

CREATE UNIQUE INDEX refinedpersons_pkey ON public.refinedpersons USING btree (id);

CREATE UNIQUE INDEX tags_personid_name_key ON public.tags USING btree (personid, name);

CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id);

alter table "public"."domains" add constraint "domains_pkey" PRIMARY KEY using index "domains_pkey";

alter table "public"."messages" add constraint "messages_pkey" PRIMARY KEY using index "messages_pkey";

alter table "public"."organizations" add constraint "name" PRIMARY KEY using index "name";

alter table "public"."persons" add constraint "persons_pkey" PRIMARY KEY using index "persons_pkey";

alter table "public"."pointsofcontact" add constraint "pointsofcontact_pkey" PRIMARY KEY using index "pointsofcontact_pkey";

alter table "public"."refinedpersons" add constraint "refinedpersons_pkey" PRIMARY KEY using index "refinedpersons_pkey";

alter table "public"."tags" add constraint "tags_pkey" PRIMARY KEY using index "tags_pkey";

alter table "public"."messages" add constraint "messages_message_id_key" UNIQUE using index "messages_message_id_key";

alter table "public"."organizations" add constraint "organizations__domain_fkey" FOREIGN KEY (_domain) REFERENCES domains(id) not valid;

alter table "public"."organizations" validate constraint "organizations__domain_fkey";

alter table "public"."persons" add constraint "persons_email_key" UNIQUE using index "persons_email_key";

alter table "public"."pointsofcontact" add constraint "pointsofcontact_personid_fkey" FOREIGN KEY (personid) REFERENCES persons(id) not valid;

alter table "public"."pointsofcontact" validate constraint "pointsofcontact_personid_fkey";

alter table "public"."pointsofcontact" add constraint "pointsofcontact_userid_messageid_fkey" FOREIGN KEY (userid, messageid) REFERENCES messages(userid, id) not valid;

alter table "public"."pointsofcontact" validate constraint "pointsofcontact_userid_messageid_fkey";

alter table "public"."refinedpersons" add constraint "refinedpersons_personid_fkey" FOREIGN KEY (personid) REFERENCES persons(id) not valid;

alter table "public"."refinedpersons" validate constraint "refinedpersons_personid_fkey";

alter table "public"."refinedpersons" add constraint "refinedpersons_personid_key" UNIQUE using index "refinedpersons_personid_key";

alter table "public"."tags" add constraint "tags_personid_fkey" FOREIGN KEY (personid) REFERENCES persons(id) not valid;

alter table "public"."tags" validate constraint "tags_personid_fkey";

alter table "public"."tags" add constraint "tags_personid_name_key" UNIQUE using index "tags_personid_name_key";

-- SETUP REALTIME --
begin;
  drop publication if exists supabase_realtime;
  -- Re-create the supabase_realtime publication with no tables and 
	-- for insert, update and delete operation
  create publication supabase_realtime with (publish = 'insert,update,delete');
commit;

-- Add a table to the publication
alter publication supabase_realtime add table public.refinedpersons;