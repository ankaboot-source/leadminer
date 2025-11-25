CREATE OR REPLACE FUNCTION private.get_distinct_or_exclude_from_array(
    input_array text[],
    exclude_array text[] DEFAULT NULL
)
RETURNS text[]
LANGUAGE sql
AS $$
    WITH normalized AS (
        SELECT
            val AS original,
            lower(trim(val)) AS norm,
            array_position(input_array, val) AS ord
        FROM unnest(input_array) val
        WHERE val IS NOT NULL
    ),
    dedup AS (
        SELECT DISTINCT ON (norm)
            original,
            norm,
            ord
        FROM normalized
        ORDER BY norm, ord
    ),
    filtered AS (
        SELECT original, ord
        FROM dedup
        WHERE exclude_array IS NULL
           OR NOT EXISTS (
               SELECT 1
               FROM unnest(exclude_array) e
               WHERE e IS NOT NULL
                AND (lower(trim(e)) = norm OR norm LIKE '%' || lower(trim(e)) || '%')
           )
    )
    SELECT array_agg(original ORDER BY ord)
    FROM filtered;
$$;
