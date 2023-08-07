-- Adds created_at, updated_at columns to table refinedpersons
ALTER TABLE "public"."refinedpersons"
    ADD COLUMN "created_at" timestamp,
    ADD COLUMN "updated_at" timestamp;

-- Creates an update trigger for updated_at column in refinedpersons
CREATE extension IF NOT EXISTS moddatetime SCHEMA extensions;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.refinedpersons
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- Updates function to copy created_at, updated_at from table persons
CREATE OR REPLACE FUNCTION public.populate_refined(_userid uuid) RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO refinedpersons(userid, tags, name, email, status, created_at, updated_at)
    SELECT populate_refined._userid, t.tags, p.name, p.email, p.status, p.created_at, p.updated_at
    FROM public.persons p
    INNER JOIN public.get_grouped_tags_by_person(_userid) AS t ON t.email = p.email
    WHERE p.user_id=populate_refined._userid
    ON conflict(email, userid) do nothing;
END;
$function$;
