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
  WHERE user_id = _userid AND (reachable = 1 OR reachable = 2)
  GROUP BY email

  UNION

  SELECT 
    person_email,
    array_agg(name) AS tags,
    array_agg(reachable) AS tags_reachability
  FROM tags
  WHERE user_id = _userid
  GROUP BY person_email
  HAVING
    COUNT(DISTINCT name) = 1
    OR MAX(name) = 'newsletter';
END
$function$;
