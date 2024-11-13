  CREATE OR REPLACE FUNCTION public.enriched_most_recent(emails text[])
  RETURNS SETOF jsonb
  LANGUAGE sql
  SET search_path = ''
  STABLE
  AS $$
  WITH
    recent_tasks AS (
      SELECT
        *
      FROM
        public.tasks t
      WHERE
        jsonb_typeof(t.details -> 'result') = 'array'
        AND t.status = 'done'
        AND t.category = 'enriching'
        AND t.type = 'enrich'
        AND t.started_at >= NOW() - INTERVAL '6 months'
    ),
    cached_results AS (
      SELECT DISTINCT
        ON (enriched_raw_data ->> 'email') -- Get distinct emails
        t.id as task_id,
        t.user_id as user_id,
        t.started_at as created_at,
        result ->> 'instance' as instance,
        enriched_raw_data as result
      FROM
        recent_tasks t,
        LATERAL (
          SELECT
            jsonb_array_elements(t.details -> 'result') AS result
        ) AS results_array,
        LATERAL (
          SELECT
            jsonb_array_elements(results_array.result -> 'raw_data') AS enriched_raw_data
        ) AS flattened_raw_data
      WHERE
        enriched_raw_data ->> 'email' = ANY (emails)
      ORDER BY
        enriched_raw_data ->> 'email',
        t.started_at DESC -- Order by email and timestamp to get the most recent
    )
  SELECT
    jsonb_build_object(
      'task_id',
      ce.task_id,
      'user_id',
      ce.user_id,
      'created_at',
      ce.created_at::timestamp,
      'instance',
      ce.instance,
      'result',
      ce.result
    ) AS task
  FROM
    cached_results ce;
  $$;