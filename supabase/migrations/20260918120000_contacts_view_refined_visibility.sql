-- Hide mined contacts that refine_persons() rejected (newsletter-only, transactional,
-- no-reply, role-only, ...) from private.contacts_view, while preserving every contact
-- that legitimately has no refinedpersons row.
--
-- Background: before the contacts rework, get_contacts_table used
--   INNER JOIN private.refinedpersons rp ON rp.email = cv.email
-- which applied the refine_persons() tag rule by construction. The rework replaced it
-- with contacts_view + LEFT JOIN refinedpersons (see 20260603120000, "was INNER JOIN"),
-- and contacts_view is built from ALL of private.persons, so rejected mined contacts
-- leaked into the contacts table, source counts, exports and campaigns.
--
-- A plain INNER JOIN is not safe either:
--   * phone-only file/PostgreSQL imports never get a refinedpersons row
--     (see backend PgContacts.ts, refined upsert is guarded by email + personId);
--   * the aggregate group representative (cv.id) is not necessarily the member that
--     owns the refined row, because persons is unique per (user_id, source, email).
--
-- Visibility is therefore decided per merged group:
--   * keep if ANY member has a refinedpersons row (mined valid + Google Contacts +
--     file/PostgreSQL imports, which insert refined rows directly), OR
--   * keep if NO member has a `refined#email_address` tag (the group was never
--     evaluated by the mining tag rule, e.g. phone-only contacts).
-- Rejected mined contacts have `refined#email_address` tags but no refined row -> hidden.
--
-- The refine_persons() HAVING rule remains the single source of truth; this view only
-- mirrors its outcome and does not duplicate the rule.

DROP VIEW IF EXISTS private.contacts_view;

CREATE VIEW private.contacts_view WITH (security_invoker = true) AS
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
    uuid_generate_v5(
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
    -- Keep contacts never evaluated by the mining tag rule (e.g. phone-only imports:
    -- they only carry a refined#phone_only tag, never a refined#email_address one).
    NOT EXISTS (
        SELECT 1
        FROM private.tags t
        WHERE t.user_id = m.user_id
          AND t.person_id = ANY (m.person_ids)
          AND t.source = 'refined#email_address'
    );

GRANT SELECT ON private.contacts_view TO authenticated;