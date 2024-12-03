create extension pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;


CREATE FUNCTION private.delete_expired_clean_cache (delete_interval INTERVAL) RETURNS void AS $$
BEGIN
    DELETE FROM public.public.email_status
    WHERE verified_on < now() - delete_interval;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

SELECT cron.schedule(
    'delete-expired-clean-cache',
    '0 0 1 */6 *', --  Every 6 months
    $$SELECT private.delete_expired_cache_enrich_function('6 months');$$
);

CREATE FUNCTION private.delete_expired_enrich_cache(delete_interval INTERVAL)
RETURNS void AS $$
BEGIN
    DELETE FROM public.tasks
        WHERE
        AND t.status = 'done'
        AND t.category = 'enriching'
        AND t.type = 'enrich'
        AND t.started_at < NOW() - delete_interval;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

SELECT cron.schedule(
    'delete-expired-enrich-cache',
    '0 0 */100 * *', -- Every 100 days at midnight
    $$SELECT delete_expired_enrich_cache('100 days');$$
);
