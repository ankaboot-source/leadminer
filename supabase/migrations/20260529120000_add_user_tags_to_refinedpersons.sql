ALTER TABLE private.refinedpersons
  ADD COLUMN IF NOT EXISTS user_tags text[] DEFAULT '{}';

DROP FUNCTION IF EXISTS private.get_contacts_table(uuid);
CREATE OR REPLACE FUNCTION private.get_contacts_table(user_id uuid)
RETURNS TABLE(
    sources               text[],
    email                 text,
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
    SELECT
        cv.sources,
        cv.email,
        cv.name,
        cv.status,
        cv.consent_status,
        cv.consent_changed_at,
        cv.image,
        cv.location,
        cv.location_normalized,
        cv.alternate_name,
        cv.alternate_email,
        cv.telephone,
        cv.same_as,
        cv.given_name,
        cv.family_name,
        cv.job_title,
        o.name          AS works_for,
        rp.recency,
        rp.seniority,
        rp.occurrence,
        rp.temperature,
        rp.sender,
        rp.recipient,
        rp.conversations,
        rp.replied_conversations,
        rp.tags,
        rp.user_tags,
        cv.updated_at,
        cv.created_at,
        cv.mining_id
    FROM private.contacts_view cv
    INNER JOIN private.refinedpersons rp
        ON rp.email = cv.email AND rp.user_id = cv.user_id
    LEFT JOIN private.organizations o
        ON o.id = cv.works_for::uuid
    WHERE cv.user_id = get_contacts_table.user_id
    ORDER BY rp.temperature DESC, rp.occurrence DESC, rp.recency DESC;
$$;

DROP FUNCTION IF EXISTS private.get_contacts_table_by_emails(uuid, text[]);
CREATE OR REPLACE FUNCTION private.get_contacts_table_by_emails(user_id uuid, emails text[])
RETURNS TABLE(
    sources               text[],
    email                 text,
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
    SELECT
        cv.sources,
        cv.email,
        cv.name,
        cv.status,
        cv.consent_status,
        cv.consent_changed_at,
        cv.image,
        cv.location,
        cv.location_normalized,
        cv.alternate_name,
        cv.alternate_email,
        cv.telephone,
        cv.same_as,
        cv.given_name,
        cv.family_name,
        cv.job_title,
        o.name          AS works_for,
        rp.recency,
        rp.seniority,
        rp.occurrence,
        rp.temperature,
        rp.sender,
        rp.recipient,
        rp.conversations,
        rp.replied_conversations,
        rp.tags,
        rp.user_tags,
        cv.updated_at,
        cv.created_at,
        cv.mining_id
    FROM private.contacts_view cv
    INNER JOIN private.refinedpersons rp
        ON rp.email = cv.email AND rp.user_id = cv.user_id
    LEFT JOIN private.organizations o
        ON o.id = cv.works_for::uuid
    WHERE cv.user_id = get_contacts_table_by_emails.user_id
      AND cv.email = ANY(get_contacts_table_by_emails.emails)
    ORDER BY rp.temperature DESC, rp.occurrence DESC, rp.recency DESC;
$$;
