-- 1. Drop old functions (recreated later)
DROP FUNCTION IF EXISTS private.get_contacts_table(uuid);
DROP FUNCTION IF EXISTS private.get_contacts_table_by_emails(uuid, text[]);

-- 2. Create the fixed contacts view
CREATE OR REPLACE VIEW private.contacts_view WITH (security_invoker = true) AS
WITH ordered_sources AS (
    -- Rank each person row per contact:
    --   primary = imap rows first (source with no colon), then most recently updated
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY email, user_id
            ORDER BY
                (source NOT LIKE '%:%') DESC,  -- imap first
                updated_at DESC
        ) AS rn
    FROM private.persons
),

-- Collect all distinct names and existing alternate_name entries across all sources
all_names AS (
    SELECT
        email,
        user_id,
        array_agg(DISTINCT name)     FILTER (WHERE name IS NOT NULL)     AS distinct_names,
        array_agg(DISTINCT alt_name) FILTER (WHERE alt_name IS NOT NULL) AS distinct_alt_names
    FROM ordered_sources
    LEFT JOIN LATERAL unnest(alternate_name) AS alt_name ON true
    GROUP BY email, user_id
),

-- Determine the primary name: first non‑null name in source‑priority order
primary_name AS (
    SELECT DISTINCT ON (email, user_id)
        email,
        user_id,
        name AS primary_name
    FROM ordered_sources
    WHERE name IS NOT NULL
    ORDER BY email, user_id, rn
),

-- ───── FIX: Pre‑aggregate array columns individually ─────
telephone_agg AS (
    SELECT
        email,
        user_id,
        array_agg(DISTINCT tel) FILTER (WHERE tel IS NOT NULL) AS telephone
    FROM ordered_sources, unnest(telephone) AS tel
    GROUP BY email, user_id
),
same_as_agg AS (
    SELECT
        email,
        user_id,
        array_agg(DISTINCT sa) FILTER (WHERE sa IS NOT NULL) AS same_as
    FROM ordered_sources, unnest(same_as) AS sa
    GROUP BY email, user_id
),
alternate_email_agg AS (
    SELECT
        email,
        user_id,
        array_agg(DISTINCT a_email) FILTER (WHERE a_email IS NOT NULL) AS alternate_email
    FROM ordered_sources, unnest(alternate_email) AS a_email
    GROUP BY email, user_id
),

-- Merge scalar fields and the mining_ids array (mining_id is scalar → safe inside GROUP BY)
merged AS (
    SELECT
        os.email,
        os.user_id,

        -- sources: sorted distinct list of source strings
        array_agg(DISTINCT os.source ORDER BY os.source)                                        AS sources,

        -- primary name resolved above
        COALESCE(pn.primary_name, '')                                                            AS name,

        -- alternate_name: all names except the primary one, plus existing alternate_name entries
        (
            SELECT array_agg(DISTINCT n)
            FROM unnest(an.distinct_names || an.distinct_alt_names) AS n
            WHERE n IS NOT NULL
              AND n <> COALESCE(pn.primary_name, '')
        )                                                                                         AS alternate_name,

        -- Scalar fields: first non‑null value in source‑priority order
        (array_agg(os.status            ORDER BY os.rn) FILTER (WHERE os.status            IS NOT NULL))[1] AS status,
        (array_agg(os.consent_status    ORDER BY os.rn) FILTER (WHERE os.consent_status    IS NOT NULL))[1] AS consent_status,
        (array_agg(os.consent_changed_at ORDER BY os.rn) FILTER (WHERE os.consent_changed_at IS NOT NULL))[1] AS consent_changed_at,
        (array_agg(os.image             ORDER BY os.rn) FILTER (WHERE os.image             IS NOT NULL))[1] AS image,
        (array_agg(os.location          ORDER BY os.rn) FILTER (WHERE os.location          IS NOT NULL))[1] AS location,
        (array_agg(os.location_normalized ORDER BY os.rn) FILTER (WHERE os.location_normalized IS NOT NULL))[1] AS location_normalized,
        (array_agg(os.given_name        ORDER BY os.rn) FILTER (WHERE os.given_name        IS NOT NULL))[1] AS given_name,
        (array_agg(os.family_name       ORDER BY os.rn) FILTER (WHERE os.family_name       IS NOT NULL))[1] AS family_name,
        (array_agg(os.job_title         ORDER BY os.rn) FILTER (WHERE os.job_title         IS NOT NULL))[1] AS job_title,
        (array_agg(os.works_for         ORDER BY os.rn) FILTER (WHERE os.works_for         IS NOT NULL))[1] AS works_for,

        -- Timestamps: updated_at = MAX (most recent source), created_at = MIN (first seen)
        MAX(os.updated_at)                                                                        AS updated_at,
        MIN(os.created_at)                                                                        AS created_at,

        -- mining_ids: scalar per source, safe to aggregate directly
        array_agg(DISTINCT os.mining_id) FILTER (WHERE os.mining_id IS NOT NULL)                 AS mining_ids

    FROM ordered_sources os
    JOIN  all_names    an ON an.email = os.email AND an.user_id = os.user_id
    LEFT JOIN primary_name pn ON pn.email = os.email AND pn.user_id = os.user_id
    GROUP BY os.email, os.user_id, pn.primary_name, an.distinct_names, an.distinct_alt_names
)

-- Final SELECT: join the pre‑aggregated arrays
SELECT
    m.sources,
    m.email,
    m.user_id,
    m.name,
    m.status,
    m.consent_status,
    m.consent_changed_at,
    m.image,
    m.location,
    m.location_normalized,
    m.alternate_name,
    a.alternate_email,       -- from alternate_email_agg
    t.telephone,             -- from telephone_agg
    s.same_as,               -- from same_as_agg
    m.given_name,
    m.family_name,
    m.job_title,
    m.works_for,
    m.updated_at,
    m.created_at,
    m.mining_ids
FROM merged m
LEFT JOIN telephone_agg        t ON t.email = m.email AND t.user_id = m.user_id
LEFT JOIN same_as_agg          s ON s.email = m.email AND s.user_id = m.user_id
LEFT JOIN alternate_email_agg  a ON a.email = m.email AND a.user_id = m.user_id;


-- 3. Recreate get_contacts_table (unchanged)
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
    updated_at            timestamptz,
    created_at            timestamptz,
    mining_ids            text[]
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
        cv.updated_at,
        cv.created_at,
        cv.mining_ids
    FROM private.contacts_view cv
    INNER JOIN private.refinedpersons rp
        ON rp.email = cv.email AND rp.user_id = cv.user_id
    LEFT JOIN private.organizations o
        ON o.id = cv.works_for::uuid
    WHERE cv.user_id = get_contacts_table.user_id
    ORDER BY rp.temperature DESC, rp.occurrence DESC, rp.recency DESC;
$$;


-- 4. Recreate get_contacts_table_by_emails (unchanged)
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
    updated_at            timestamptz,
    created_at            timestamptz,
    mining_ids            text[]
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
        cv.updated_at,
        cv.created_at,
        cv.mining_ids
    FROM private.contacts_view cv
    INNER JOIN private.refinedpersons rp
        ON rp.email = cv.email AND rp.user_id = cv.user_id
    LEFT JOIN private.organizations o
        ON o.id = cv.works_for::uuid
    WHERE cv.user_id = get_contacts_table_by_emails.user_id
      AND cv.email = ANY(get_contacts_table_by_emails.emails)
    ORDER BY rp.temperature DESC, rp.occurrence DESC, rp.recency DESC;
$$;
