-- Recreates private.get_contacts_table_by_ids.
--
-- The function was introduced in 20260603120000_drop_person_email_use_persons_id.sql,
-- but some environments applied an earlier revision of that migration (which only
-- shipped get_contacts_table) while recording the version as applied, so the
-- function was never actually created. This migration restores it so PostgREST
-- can resolve private.get_contacts_table_by_ids(p_user_id, p_ids).

CREATE OR REPLACE FUNCTION private.get_contacts_table_by_ids(
    p_user_id uuid,
    p_ids     uuid[]
)
RETURNS TABLE(
    id                    uuid,
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
    WHERE id = ANY(p_ids)
    ORDER BY temperature DESC NULLS LAST, occurrence DESC NULLS LAST, recency DESC NULLS LAST;
$$;