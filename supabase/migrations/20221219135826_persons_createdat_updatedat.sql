alter table "public"."persons" add column "created_at" timestamp without time zone not null default now();

alter table "public"."persons" add column "updated_at" timestamp without time zone not null default now();

create extension if not exists moddatetime schema extensions;

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.persons FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');


