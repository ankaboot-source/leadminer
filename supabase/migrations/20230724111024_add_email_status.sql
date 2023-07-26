-- Adds a new column 'status' to 'persons' and 'refinedpersons' tables

alter table "public"."persons" add column "status" text not null default 'UNKNOWN'::text;

alter table "public"."refinedpersons" add column "status" text;

-- UPDATE POPULATE FUNCTION
CREATE OR REPLACE FUNCTION public.populate_refined(_userid uuid) RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO refinedpersons(userid, tags, name, email, status)
    SELECT populate_refined._userid, t.tags, p.name, p.email, p.status
    FROM public.persons p
    INNER JOIN public.get_grouped_tags_by_person(_userid) AS t ON t.email = p.email
    WHERE p.user_id=populate_refined._userid
    ON conflict(email, userid) do nothing;
END;
$function$;
