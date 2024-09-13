create table "public"."mining_sources" (
    "created_at" timestamp with time zone default now(),
    "credentials" bytea not null,
    "email" text not null,
    "type" text not null,
    "user_id" uuid not null
);


CREATE UNIQUE INDEX mining_sources_pkey ON public.mining_sources USING btree (email, user_id);

alter table "public"."mining_sources" add constraint "mining_sources_pkey" PRIMARY KEY using index "mining_sources_pkey";

alter table "public"."mining_sources" add constraint "mining_sources_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."mining_sources" validate constraint "mining_sources_user_id_fkey";


