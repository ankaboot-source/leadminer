CREATE OR REPLACE FUNCTION public.enriched_most_recent(emails text[])
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
AS $$
WITH recent_tasks AS (
  SELECT DISTINCT ON (enriched_raw_data->>'email')
    t.id,
    t.user_id,
    t.started_at,
    enriched_raw_data,
    result->>'instance' AS enricher
  FROM public.tasks t,
    LATERAL (
      SELECT jsonb_array_elements(t.details->'result') AS result
      WHERE jsonb_typeof(t.details->'result') = 'array'
    ) AS results_array,
    LATERAL (
      SELECT jsonb_array_elements(inner_raw) AS enriched_raw_data
      FROM jsonb_array_elements(results_array.result->'raw_data') AS inner_raw
    ) AS flattened_raw_data
  WHERE enriched_raw_data->>'email' = ANY(emails)
    AND t.status = 'done'
    AND t.category = 'enriching'
    AND t.type = 'enrich'
    AND t.started_at >= NOW() - INTERVAL '6 months'
  ORDER BY enriched_raw_data->>'email', t.started_at DESC
)
SELECT jsonb_build_object(
  'task_id', id,
  'user_id', user_id,
  'created_at', started_at,
  'instance', enricher,
  'result', enriched_raw_data
) AS task
FROM recent_tasks;
$$;