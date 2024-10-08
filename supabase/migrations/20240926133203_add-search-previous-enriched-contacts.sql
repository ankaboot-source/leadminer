CREATE OR REPLACE FUNCTION public.search_recent_enriched_emails(emails text[])
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
AS $$
WITH recent_tasks AS (
  SELECT DISTINCT ON (result_item->>'email') 
         result_item,
         id,
         user_id,
         started_at
  FROM public.tasks,
       jsonb_array_elements(details->'result'->'data') AS result_item
  WHERE result_item->>'email' = ANY(emails)
    AND status = 'done'
    AND category = 'enriching'
    AND type = 'enrich'
    AND started_at >= NOW() - INTERVAL '6 months'
  ORDER BY result_item->>'email', started_at DESC
)
SELECT jsonb_build_object(
         'task_id', id,
         'user_id', user_id,
         'created_at', started_at,
         'result', result_item
       ) AS task
FROM recent_tasks;
$$;