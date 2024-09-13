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
  WHERE
      user_id = _userid
      AND reachable IN (1, 2)
      AND person_email NOT IN (
          SELECT person_email
          FROM tags
          WHERE user_id = _userid
          GROUP BY person_email
          HAVING
            MAX(reachable) = 3
              OR (count(DISTINCT reachable) = 1 AND MAX(reachable) = 3)
              OR (count(DISTINCT reachable) = 2 AND ARRAY[1, 3] <@ array_agg(DISTINCT reachable))
      )
  GROUP BY person_email;
END
$function$;