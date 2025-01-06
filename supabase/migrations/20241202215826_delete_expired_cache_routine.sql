create extension pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;


CREATE FUNCTION public.delete_expired_clean_cache (delete_interval INTERVAL) RETURNS void AS $$
BEGIN
    DELETE FROM public.email_status
    WHERE verified_on <= NOW() - delete_interval;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

SELECT cron.schedule(
    'delete-expired-clean-cache',
    '0 0 */100 * *', -- Every 100 days at midnight
    $$SELECT public.delete_expired_clean_cache(INTERVAL '100 days');$$
);

CREATE FUNCTION public.delete_expired_enrich_cache(delete_interval INTERVAL)
RETURNS void AS $$
BEGIN
    DELETE FROM public.tasks
    WHERE status = 'done'
      AND category = 'enriching'
      AND type = 'enrich'
      AND started_at <= NOW() - delete_interval;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

SELECT cron.schedule(
    'delete-expired-enrich-cache',
    '0 0 1 */6 *',
    $$SELECT delete_expired_enrich_cache(INTERVAL '6 months');$$
);
