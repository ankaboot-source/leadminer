DROP VIEW public.grouped_tags_by_person_view;

CREATE OR REPLACE FUNCTION public.get_grouped_tags_by_person(_userid uuid) 
RETURNS table(email text, tags text[], tags_reachability integer[])
LANGUAGE plpgsql AS 
$function$
BEGIN
  RETURN QUERY
  SELECT
    person_email AS email,
    array_agg(name) AS tags,
    array_agg(reachable) AS tags_reachability
  FROM tags
  WHERE user_id = _userid
  GROUP BY email;
END
$function$;


-- UPDATE POPULATE FUNCTION
DROP FUNCTION public.populate_refined;
CREATE OR REPLACE FUNCTION public.populate_refined(_userid uuid) RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO refinedpersons(userid, tags, name, email)
    SELECT populate_refined._userid, t.tags, p.name, p.email
    FROM public.persons p
    INNER JOIN public.get_grouped_tags_by_person(_userid) AS t ON t.email = p.email
    WHERE p.user_id=populate_refined._userid AND NOT t.tags_reachability && '{0}'
    ON conflict(email, userid) do nothing;
END;
$function$;
