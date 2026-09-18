-- User-scoped contacts aggregation.
--
-- Problem: private.contacts_view aggregates ALL tenants on every call, because
-- `ordered_sources` is a multi-referenced (materialized) CTE and the outer
-- `WHERE user_id = ...` cannot be pushed into the base `persons` scan. For the
-- frontend this is masked by RLS (auth.uid() is pushed into the scan), but
-- service-role callers (backend exports, campaign preview/create) still pay for
-- every tenant.
--
-- Fix: move the aggregation into a parameterized SQL function
-- `private.get_contacts_view(p_user_id)` whose `ordered_sources` filters
-- `(p_user_id IS NULL OR user_id = p_user_id)` up front, so the argument prunes
-- tenants. `contacts_view` becomes a thin wrapper over `get_contacts_view(NULL)`
-- for all-tenant consumers (email-campaigns compliance), and `get_contacts_table`
-- reads the scoped function.
--
-- The visibility predicate is unchanged from the previous migration
-- (keep refined contacts + phone-only, hide rejected mined contacts).

-- ---------------------------------------------------------------------------
-- 1. Core user-scoped aggregation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_contacts_view(p_user_id uuid DEFAULT NULL)
RETURNS TABLE(
    contact_id            uuid,
    id                    uuid,
    person_ids            uuid[],
    sources               text[],
    email                 text,
    identifier            text,
    user_id               uuid,
    name                  text,
    alternate_name        text[],
    given_name            text,
    family_name           text,
    job_title             text,
    works_for             text,
    image                 text,
    location              text,
    location_normalized   jsonb,
    status                text,
    consent_status        private.contact_consent_status,
    consent_changed_at    timestamptz,
    telephone             text[],
    same_as               text[],
    alternate_email       text[],
    updated_at            timestamptz,
    created_at            timestamptz,
    mining_id             text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
WITH ordered_sources AS (
    SELECT
        id,
        email,
        user_id,
        source,
        name,
        alternate_name,
        telephone,
        same_as,
        alternate_email,
        works_for,
        updated_at,
        created_at,
        mining_id,
        image,
        location,
        location_normalized,
        consent_status,
        consent_changed_at,
        given_name,
        family_name,
        job_title,
        status,
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(email, id::text), user_id
            ORDER BY (source NOT LIKE '%:%') DESC, updated_at DESC
        ) AS rn
    FROM private.persons
    -- Scopes the whole aggregation to one tenant; NULL keeps the all-tenant view.
    WHERE p_user_id IS NULL OR user_id = p_user_id
),

all_names AS (
    SELECT
        COALESCE(email, id::text) AS group_key,
        user_id,
        array_agg(DISTINCT name)     FILTER (WHERE name IS NOT NULL)     AS distinct_names,
        array_agg(DISTINCT alt_name) FILTER (WHERE alt_name IS NOT NULL) AS distinct_alt_names
    FROM ordered_sources
    LEFT JOIN LATERAL unnest(alternate_name) AS alt_name ON true
    GROUP BY COALESCE(email, id::text), user_id
),

primary_name AS (
    SELECT DISTINCT ON (COALESCE(email, id::text), user_id)
        COALESCE(email, id::text) AS group_key,
        user_id,
        name AS primary_name
    FROM ordered_sources
    WHERE name IS NOT NULL
    ORDER BY COALESCE(email, id::text), user_id, rn
),

telephone_agg AS (
    SELECT
        COALESCE(email, id::text) AS group_key,
        user_id,
        array_agg(DISTINCT tel) FILTER (WHERE tel IS NOT NULL) AS telephone
    FROM ordered_sources, unnest(telephone) AS tel
    GROUP BY COALESCE(email, id::text), user_id
),

same_as_agg AS (
    SELECT
        COALESCE(email, id::text) AS group_key,
        user_id,
        array_agg(DISTINCT sa) FILTER (WHERE sa IS NOT NULL) AS same_as
    FROM ordered_sources, unnest(same_as) AS sa
    GROUP BY COALESCE(email, id::text), user_id
),

alternate_email_agg AS (
    SELECT
        COALESCE(email, id::text) AS group_key,
        user_id,
        array_agg(DISTINCT a_email) FILTER (WHERE a_email IS NOT NULL) AS alternate_email
    FROM ordered_sources, unnest(alternate_email) AS a_email
    GROUP BY COALESCE(email, id::text), user_id
),

merged AS (
    SELECT
        COALESCE(os.email, os.id::text)                                  AS group_key,
        os.email,
        os.user_id,
        (array_agg(os.id ORDER BY os.rn))[1]                            AS id,
        array_agg(DISTINCT os.id ORDER BY os.id)                        AS person_ids,
        array_agg(DISTINCT os.source ORDER BY os.source)               AS sources,
        COALESCE(pn.primary_name, '')                                  AS name,
        (
            SELECT array_agg(DISTINCT n)
            FROM unnest(an.distinct_names || an.distinct_alt_names) AS n
            WHERE n IS NOT NULL
              AND n <> COALESCE(pn.primary_name, '')
        )                                                                AS alternate_name,
        (array_agg(os.status             ORDER BY os.rn) FILTER (WHERE os.status             IS NOT NULL))[1] AS status,
        (array_agg(os.consent_status     ORDER BY os.rn) FILTER (WHERE os.consent_status     IS NOT NULL))[1] AS consent_status,
        (array_agg(os.consent_changed_at ORDER BY os.rn) FILTER (WHERE os.consent_changed_at IS NOT NULL))[1] AS consent_changed_at,
        (array_agg(os.image              ORDER BY os.rn) FILTER (WHERE os.image              IS NOT NULL))[1] AS image,
        (array_agg(os.location           ORDER BY os.rn) FILTER (WHERE os.location           IS NOT NULL))[1] AS location,
        (array_agg(os.location_normalized ORDER BY os.rn) FILTER (WHERE os.location_normalized IS NOT NULL))[1] AS location_normalized,
        (array_agg(os.given_name         ORDER BY os.rn) FILTER (WHERE os.given_name         IS NOT NULL))[1] AS given_name,
        (array_agg(os.family_name        ORDER BY os.rn) FILTER (WHERE os.family_name        IS NOT NULL))[1] AS family_name,
        (array_agg(os.job_title          ORDER BY os.rn) FILTER (WHERE os.job_title          IS NOT NULL))[1] AS job_title,
        (array_agg(os.works_for          ORDER BY os.rn) FILTER (WHERE os.works_for          IS NOT NULL))[1] AS works_for,
        MAX(os.updated_at)                                              AS updated_at,
        MIN(os.created_at)                                              AS created_at,
        (array_agg(os.mining_id ORDER BY os.rn) FILTER (WHERE os.mining_id IS NOT NULL))[1] AS mining_id
    FROM ordered_sources os
    JOIN all_names an ON an.group_key = COALESCE(os.email, os.id::text) AND an.user_id = os.user_id
    LEFT JOIN primary_name pn ON pn.group_key = COALESCE(os.email, os.id::text) AND pn.user_id = os.user_id
    GROUP BY COALESCE(os.email, os.id::text), os.email, os.user_id, pn.primary_name,
             an.distinct_names, an.distinct_alt_names
)

SELECT
    extensions.uuid_generate_v5(
        '00000000-0000-4000-8000-000000000000',
        m.group_key || '|' || m.user_id::text
    )                                                                    AS contact_id,
    m.id,
    m.person_ids,
    m.sources,
    m.email,
    COALESCE(m.email, t.telephone[1])                                    AS identifier,
    m.user_id,
    m.name,
    m.alternate_name,
    m.given_name,
    m.family_name,
    m.job_title,
    m.works_for,
    m.image,
    m.location,
    m.location_normalized,
    m.status,
    m.consent_status,
    m.consent_changed_at,
    COALESCE(t.telephone,        '{}'::text[]) AS telephone,
    COALESCE(s.same_as,          '{}'::text[]) AS same_as,
    COALESCE(a.alternate_email,  '{}'::text[]) AS alternate_email,
    m.updated_at,
    m.created_at,
    m.mining_id
FROM merged m
LEFT JOIN telephone_agg       t ON t.group_key = m.group_key AND t.user_id = m.user_id
LEFT JOIN same_as_agg         s ON s.group_key = m.group_key AND s.user_id = m.user_id
LEFT JOIN alternate_email_agg a ON a.group_key = m.group_key AND a.user_id = m.user_id
WHERE
    -- Keep contacts that were materialized as refined (mined valid, Google Contacts,
    -- CSV/XLSX/PostgreSQL imports). Any member owning a refined row keeps the group.
    EXISTS (
        SELECT 1
        FROM private.refinedpersons rp
        WHERE rp.user_id = m.user_id
          AND rp.person_id = ANY (m.person_ids)
    )
    OR
    -- Keep phone-only contacts: they have no email and never get a refined row.
    m.email IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION private.get_contacts_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_contacts_view(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. contacts_view becomes a thin compatibility wrapper (all tenants; RLS and
--    consumer filters still apply). Heavy callers use get_contacts_view(uuid).
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS private.contacts_view;

CREATE VIEW private.contacts_view WITH (security_invoker = true) AS
SELECT * FROM private.get_contacts_view(NULL);

GRANT SELECT ON private.contacts_view TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_contacts_table: read the user-scoped function instead of the view so
--    service-role callers no longer aggregate all tenants.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_contacts_table(p_user_id uuid)
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
    SELECT
        cv.contact_id,
        cv.id,
        cv.person_ids,
        cv.sources,
        cv.email,
        cv.identifier,
        cv.user_id,
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
    FROM private.get_contacts_view(p_user_id) cv
    LEFT JOIN private.refinedpersons rp
        ON rp.person_id = cv.id AND rp.user_id = cv.user_id
    LEFT JOIN private.organizations o
        ON o.id = cv.works_for::uuid
    WHERE cv.user_id = p_user_id
    ORDER BY rp.temperature DESC NULLS LAST,
             rp.occurrence  DESC NULLS LAST,
             rp.recency     DESC NULLS LAST;
$$;