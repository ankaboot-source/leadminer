DROP FUNCTION IF EXISTS get_grouped_tags_by_person;
CREATE FUNCTION "public"."get_grouped_tags_by_person"("_userid" "uuid") RETURNS TABLE("email" "text", "tags" "text"[], "tags_reachability" integer[])
    LANGUAGE "plpgsql"
    SET search_path = ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    person_email AS email,
    CASE
      WHEN COUNT(name) > 1 THEN array_agg(name) FILTER (WHERE name NOT IN ('professional', 'personal'))
      ELSE array_agg(name)
    END AS tags,
    CASE
      WHEN COUNT(name) > 1 THEN array_agg(reachable) FILTER (WHERE name NOT IN ('professional', 'personal'))
      ELSE array_agg(reachable)
    END AS tags_reachability
  FROM public.tags
  WHERE
      user_id = _userid
      AND reachable IN (1, 2)
      AND person_email NOT IN (
          SELECT person_email
          FROM public.tags
          WHERE user_id = _userid
          GROUP BY person_email
          HAVING
            MAX(reachable) = 3
              OR (count(DISTINCT reachable) = 1 AND MAX(reachable) = 3)
              OR (count(DISTINCT reachable) = 2 AND ARRAY[1, 3] <@ array_agg(DISTINCT reachable))
      )
  GROUP BY person_email;
END
$$;