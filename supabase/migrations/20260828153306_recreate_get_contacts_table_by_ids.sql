-- Recreates private.get_contacts_table_by_ids.
--
-- The contacts rework (20260821020000_contacts_view_stable_id_person_ids.sql)
-- dropped get_contacts_table_by_ids and changed get_contacts_table to expose
-- contact_id + person_ids as leading columns. The email-campaigns edge function
-- still calls get_contacts_table_by_ids, so it must be recreated to match the
-- NEW get_contacts_table output shape (contact_id, id, person_ids, sources, ...)
-- -- otherwise PostgREST fails with 42P13 (declared vs returned column mismatch)
-- and campaigns cannot resolve contacts.
--
-- Matching predicate uses person-id overlap (person_ids && p_ids) so merged
-- contacts are found by ANY member person, not just the primary id, avoiding
-- silently dropped recipients for merged groups.

CREATE OR REPLACE FUNCTION private.get_contacts_table_by_ids(
    p_user_id uuid,
    p_ids     uuid[]
)
RETURNS TABLE(
    contact_id            uuid,
    id                    uuid,
    person_ids            uuid[],
    sources               text[],
    email                 text,
    identifier            text,
    user_id               uuid,
    name                  text,
    status                text,
    consent_status        private.contact_consent_status,
    consent_changed_at    timestamptz,
    image                 text,
    location              text,
    location_normalized   jsonb,
    alternate_name        text[],
    alternate_email       text[],
    telephone             text[],
    same_as               text[],
    given_name            text,
    family_name           text,
    job_title             text,
    works_for             text,
    recency               timestamptz,
    seniority             timestamptz,
    occurrence            integer,
    temperature           integer,
    sender                integer,
    recipient             integer,
    conversations         integer,
    replied_conversations integer,
    tags                  text[],
    user_tags             text[],
    updated_at            timestamptz,
    created_at            timestamptz,
    mining_id             text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT *
    FROM private.get_contacts_table(p_user_id)
    WHERE person_ids && p_ids
    ORDER BY temperature DESC NULLS LAST, occurrence DESC NULLS LAST, recency DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION private.get_contacts_table_by_ids(uuid, uuid[])
    TO authenticated, service_role;
