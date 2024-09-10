
SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

CREATE ROLE "supabase_realtime_admin";
ALTER ROLE "supabase_realtime_admin" WITH NOINHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOBYPASSRLS;

ALTER ROLE "anon" SET "statement_timeout" TO '120s';

ALTER ROLE "authenticated" SET "statement_timeout" TO '120s';

ALTER ROLE "authenticator" SET "statement_timeout" TO '120s';

ALTER ROLE "service_role" SET "statement_timeout" TO '120s';

RESET ALL;
