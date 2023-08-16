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
            MAX(name) = 'newsletter'
              OR (count(DISTINCT name) = 1 AND MAX(name) = 'newsletter')
              OR (count(DISTINCT name) = 2 AND ARRAY['professional', 'newsletter'] <@ array_agg(DISTINCT name))
              OR (count(DISTINCT name) = 3 AND ARRAY['professional', 'newsletter', 'role'] <@ array_agg(DISTINCT name))
              
      )
  GROUP BY person_email;
END
$function$;
