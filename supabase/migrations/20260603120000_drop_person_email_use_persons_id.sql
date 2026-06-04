-- ============================================================================
-- Drop person_email from person-extension tables; key them by persons.id
-- ============================================================================
-- This migration:
--   1. Adds a UUID id PK to private.persons and makes email nullable
--   2. Re-keys private.tags by person_id (dropping person_email)
--   3. Re-keys private.pointsofcontact by person_id (dropping person_email)
--   4. Re-keys private.refinedpersons by person_id (dropping email)
--   5. Re-keys private.engagement by person_id (dropping email)
--   6. Recreates private.contacts_view partitioned by COALESCE(email, id::text)
--   7. Recreates private.get_contacts_table, get_contacts_table_by_ids
--   8. Recreates private.get_mining_source_overview with phone breakdown
--   9. Recreates private.delete_contacts (resolves email[] -> person_ids)
--  10. Recreates private.refine_persons (keyed on person_id)
--  11. Recreates private.enrich_contacts (skips null-email records)
--
-- The migration is atomic: BEGIN here, COMMIT at the end.
-- It must run AFTER all prior migrations and BEFORE any code that
-- uses the new schema.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. persons: add UUID id, swap PK, make email nullable, add CHECK
-- ---------------------------------------------------------------------------

-- Add UUID id column. gen_random_uuid() is provided by pgcrypto (already
-- enabled in supabase); extensions not required.
ALTER TABLE private.persons
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Backfill any NULL ids (defensive: covers rows inserted between
-- ADD COLUMN and the next statement in concurrent migrations)
UPDATE private.persons SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE private.persons ALTER COLUMN id SET NOT NULL;

-- Drop the old composite PK
ALTER TABLE private.persons DROP CONSTRAINT IF EXISTS persons_pkey;

-- New PK on the UUID
ALTER TABLE private.persons ADD PRIMARY KEY (id);

-- Email is now nullable (phone-only contacts have NULL email)
ALTER TABLE private.persons ALTER COLUMN email DROP NOT NULL;

-- Partial unique index: preserves the "no duplicate (user, source, email)" rule
-- for email-bearing rows. Phone-only rows are de-duplicated by (user, source, id)
-- implicitly via the PK.
CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_user_source_email
  ON private.persons (user_id, source, email)
  WHERE email IS NOT NULL;

-- CHECK: at least one of email or telephone must be present
ALTER TABLE private.persons
  ADD CONSTRAINT chk_persons_email_or_phone
  CHECK (email IS NOT NULL OR (telephone IS NOT NULL AND array_length(telephone, 1) > 0));


-- ---------------------------------------------------------------------------
-- 2. tags: add person_id, swap PK to (person_id, name, user_id), drop person_email
-- ---------------------------------------------------------------------------
-- The tags table is partitioned by HASH(user_id) into tags_0/1/2. Every
-- ADD COLUMN / DROP COLUMN on the parent propagates to partitions, but PK
-- constraints are per-partition and must be dropped/added on each.

-- Add nullable person_id to parent. In PostgreSQL, ADD COLUMN on a
-- partitioned parent propagates to all child partitions automatically.
ALTER TABLE private.tags ADD COLUMN IF NOT EXISTS person_id UUID;

-- Backfill person_id from persons on the parent
UPDATE private.tags t
SET person_id = p.id
FROM private.persons p
WHERE p.email = t.person_email
  AND p.user_id = t.user_id
  AND t.person_id IS NULL;

-- The parent UPDATE above backfills all rows in all partitions; no need
-- to UPDATE each partition individually. The CHECK below verifies
-- the backfill succeeded before we enforce NOT NULL on the parent
-- (which propagates to all partitions).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM private.tags WHERE person_id IS NULL) THEN
    RAISE EXCEPTION 'tags.person_id backfill left NULLs; investigate before continuing';
  END IF;
END $$;

-- SET NOT NULL on the parent propagates to all child partitions.
ALTER TABLE private.tags ALTER COLUMN person_id SET NOT NULL;

-- Drop the old PK on the parent. Partition-level PKs are inherited from
-- the parent in PostgreSQL and are removed automatically when the parent
-- constraint is dropped.
ALTER TABLE private.tags DROP CONSTRAINT IF EXISTS tags_pkey;

-- New PK on the parent keyed by person_id. PostgreSQL propagates the
-- constraint to all child partitions automatically.
ALTER TABLE private.tags ADD PRIMARY KEY (person_id, name, user_id);

-- Drop person_email from parent (propagates to partitions because the
-- column is inherited, not redefined per-partition)
ALTER TABLE private.tags DROP COLUMN person_email;


-- ---------------------------------------------------------------------------
-- 3. pointsofcontact: add person_id, drop person_email (PK is (id, user_id))
-- ---------------------------------------------------------------------------
-- POC's natural PK is its own synthetic id, so we don't need a PK swap.
-- We just add person_id, backfill, and drop person_email.

-- Add nullable person_id to parent. In PostgreSQL, ADD COLUMN on a
-- partitioned parent propagates to all child partitions automatically.
ALTER TABLE private.pointsofcontact ADD COLUMN IF NOT EXISTS person_id UUID;

UPDATE private.pointsofcontact poc
SET person_id = p.id
FROM private.persons p
WHERE p.email = poc.person_email
  AND p.user_id = poc.user_id
  AND poc.person_id IS NULL;

-- The parent UPDATE above backfills all rows in all partitions; no need
-- to UPDATE each partition individually. The CHECK below verifies
-- the backfill succeeded before we enforce NOT NULL on the parent
-- (which propagates to all partitions).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM private.pointsofcontact WHERE person_id IS NULL) THEN
    RAISE EXCEPTION 'pointsofcontact.person_id backfill left NULLs';
  END IF;
END $$;

-- SET NOT NULL on the parent propagates to all child partitions.
ALTER TABLE private.pointsofcontact ALTER COLUMN person_id SET NOT NULL;

ALTER TABLE private.pointsofcontact DROP COLUMN person_email;


-- ---------------------------------------------------------------------------
-- 4. refinedpersons: swap PK from (email, user_id) to (person_id, user_id)
-- ---------------------------------------------------------------------------
-- The PK currently uses 'email' as the column name (not 'person_email').
-- We swap the PK and then drop the email column entirely.
-- Add user_tags defensively (idempotent): this column was added in
-- 20260529120000_add_user_tags_to_refinedpersons.sql. Including it here
-- makes the migration self-contained for environments that don't have
-- that prior migration applied.
ALTER TABLE private.refinedpersons
  ADD COLUMN IF NOT EXISTS user_tags text[] DEFAULT '{}';

ALTER TABLE private.refinedpersons ADD COLUMN IF NOT EXISTS person_id UUID;

UPDATE private.refinedpersons r
SET person_id = p.id
FROM private.persons p
WHERE p.email = r.email
  AND p.user_id = r.user_id
  AND r.person_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM private.refinedpersons WHERE person_id IS NULL) THEN
    RAISE EXCEPTION 'refinedpersons.person_id backfill left NULLs';
  END IF;
END $$;

ALTER TABLE private.refinedpersons ALTER COLUMN person_id SET NOT NULL;

ALTER TABLE private.refinedpersons DROP CONSTRAINT IF EXISTS refinedpersons_pkey;

ALTER TABLE private.refinedpersons ADD PRIMARY KEY (person_id, user_id);

ALTER TABLE private.refinedpersons DROP COLUMN email;


-- ---------------------------------------------------------------------------
-- 5. engagement: swap PK from (email, user_id, engagement_type, service)
--    to (person_id, user_id, engagement_type, service)
-- ---------------------------------------------------------------------------
-- The PK currently uses 'email' as the column name. We swap the PK and
-- drop the email column entirely. Engagement tracks per-person events
-- (exports, enrichments) so the natural key is person_id.

ALTER TABLE private.engagement ADD COLUMN IF NOT EXISTS person_id UUID;

UPDATE private.engagement e
SET person_id = p.id
FROM private.persons p
WHERE p.email = e.email
  AND p.user_id = e.user_id
  AND e.person_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM private.engagement WHERE person_id IS NULL) THEN
    RAISE EXCEPTION 'engagement.person_id backfill left NULLs';
  END IF;
END $$;

ALTER TABLE private.engagement ALTER COLUMN person_id SET NOT NULL;

ALTER TABLE private.engagement DROP CONSTRAINT IF EXISTS engagement_pkey;

ALTER TABLE private.engagement ADD PRIMARY KEY (person_id, user_id, engagement_type, service);

ALTER TABLE private.engagement DROP COLUMN email;


-- ---------------------------------------------------------------------------
-- 6. contacts_view: recreate with COALESCE(email, id::text) partition,
--    id + identifier columns. All downstream UDFs that join this view do so
--    by person_id, not email.
-- ---------------------------------------------------------------------------

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
        COALESCE(email, id::text) AS contact_id,
        user_id,
        array_agg(DISTINCT name)     FILTER (WHERE name IS NOT NULL)     AS distinct_names,
        array_agg(DISTINCT alt_name) FILTER (WHERE alt_name IS NOT NULL) AS distinct_alt_names
    FROM ordered_sources
    LEFT JOIN LATERAL unnest(alternate_name) AS alt_name ON true
    GROUP BY COALESCE(email, id::text), user_id
),

primary_name AS (
    SELECT DISTINCT ON (COALESCE(email, id::text), user_id)
        COALESCE(email, id::text) AS contact_id,
        user_id,
        name AS primary_name
    FROM ordered_sources
    WHERE name IS NOT NULL
    ORDER BY COALESCE(email, id::text), user_id, rn
),

telephone_agg AS (
    SELECT
        COALESCE(email, id::text) AS contact_id,
        user_id,
        array_agg(DISTINCT tel) FILTER (WHERE tel IS NOT NULL) AS telephone
    FROM ordered_sources, unnest(telephone) AS tel
    GROUP BY COALESCE(email, id::text), user_id
),

same_as_agg AS (
    SELECT
        COALESCE(email, id::text) AS contact_id,
        user_id,
        array_agg(DISTINCT sa) FILTER (WHERE sa IS NOT NULL) AS same_as
    FROM ordered_sources, unnest(same_as) AS sa
    GROUP BY COALESCE(email, id::text), user_id
),

alternate_email_agg AS (
    SELECT
        COALESCE(email, id::text) AS contact_id,
        user_id,
        array_agg(DISTINCT a_email) FILTER (WHERE a_email IS NOT NULL) AS alternate_email
    FROM ordered_sources, unnest(alternate_email) AS a_email
    GROUP BY COALESCE(email, id::text), user_id
),

merged AS (
    SELECT
        COALESCE(os.email, os.id::text) AS contact_id,
        os.email,
        os.user_id,
        (array_agg(os.id ORDER BY os.rn))[1]                            AS id,
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
    JOIN all_names an ON an.contact_id = COALESCE(os.email, os.id::text) AND an.user_id = os.user_id
    LEFT JOIN primary_name pn ON pn.contact_id = COALESCE(os.email, os.id::text) AND pn.user_id = os.user_id
    GROUP BY COALESCE(os.email, os.id::text), os.email, os.user_id, pn.primary_name,
             an.distinct_names, an.distinct_alt_names
)

SELECT
    m.id,
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
LEFT JOIN telephone_agg       t ON t.contact_id = m.contact_id AND t.user_id = m.user_id
LEFT JOIN same_as_agg         s ON s.contact_id = m.contact_id AND s.user_id = m.user_id
LEFT JOIN alternate_email_agg a ON a.contact_id = m.contact_id AND a.user_id = m.user_id;

GRANT SELECT ON private.contacts_view TO authenticated;


-- ---------------------------------------------------------------------------
-- 7. get_contacts_table: re-key refinedpersons join on person_id; expose id + identifier
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS private.get_contacts_table(uuid);

CREATE OR REPLACE FUNCTION private.get_contacts_table(p_user_id uuid)
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
    SELECT
        cv.id,
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
    FROM private.contacts_view cv
    LEFT JOIN private.refinedpersons rp                 -- CHANGED: was INNER JOIN
        ON rp.person_id = cv.id AND rp.user_id = cv.user_id   -- CHANGED: email -> person_id
    LEFT JOIN private.organizations o
        ON o.id = cv.works_for::uuid
    WHERE cv.user_id = p_user_id
    ORDER BY rp.temperature DESC NULLS LAST,
             rp.occurrence  DESC NULLS LAST,
             rp.recency     DESC NULLS LAST;
$$;


-- Renamed from get_contacts_table_by_emails: now takes person ids (UUIDs)
DROP FUNCTION IF EXISTS private.get_contacts_table_by_emails(uuid, text[]);
DROP FUNCTION IF EXISTS private.get_contacts_table_by_ids(uuid, uuid[]);

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


-- ---------------------------------------------------------------------------
-- 8. get_mining_source_overview: count by identifier, add phone breakdown
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS private.get_mining_source_overview(uuid);

CREATE OR REPLACE FUNCTION private.get_mining_source_overview(p_user_id uuid)
RETURNS TABLE(
    source_email           text,
    total_contacts         bigint,
    total_email_contacts   bigint,
    total_phone_contacts   bigint,
    last_mining_date       timestamptz,
    total_from_last_mining bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH source_emails AS (
    SELECT DISTINCT p.source AS src
    FROM private.persons p
    WHERE p.user_id = p_user_id
      AND p.source IS NOT NULL
  ),
  latest_mining_per_source AS (
    SELECT
      p.source AS src,
      p.mining_id,
      MAX(p.created_at) AS mining_date
    FROM private.persons p
    WHERE p.user_id = p_user_id
      AND p.source IS NOT NULL
      AND p.mining_id IS NOT NULL
    GROUP BY p.source, p.mining_id
  ),
  latest_mining AS (
    SELECT DISTINCT ON (src)
      src,
      mining_id,
      mining_date
    FROM latest_mining_per_source
    ORDER BY src, mining_date DESC
  ),
  visible_contacts AS (
    SELECT
      cv.identifier,
      cv.email,
      unnest(cv.sources) AS src,
      cv.mining_id
    FROM private.contacts_view cv
    WHERE cv.user_id = p_user_id
  ),
  total_per_source AS (
    SELECT
      vc.src,
      COUNT(DISTINCT vc.identifier)::bigint                                                       AS total_contacts,
      COUNT(DISTINCT vc.email)        FILTER (WHERE vc.email IS NOT NULL)::bigint               AS total_email_contacts,
      COUNT(DISTINCT vc.identifier)   FILTER (WHERE vc.email IS NULL)::bigint                   AS total_phone_contacts
    FROM visible_contacts vc
    WHERE vc.src IS NOT NULL
    GROUP BY vc.src
  ),
  last_mining_counts AS (
    SELECT
      lm.src,
      COUNT(DISTINCT vc.identifier)::bigint AS total_from_last_mining
    FROM latest_mining lm
    JOIN visible_contacts vc
      ON vc.src = lm.src
     AND lm.mining_id = vc.mining_id
    WHERE lm.mining_id IS NOT NULL
    GROUP BY lm.src
  )
  SELECT
    se.src::text,
    COALESCE(tps.total_contacts, 0)::bigint,
    COALESCE(tps.total_email_contacts, 0)::bigint,
    COALESCE(tps.total_phone_contacts, 0)::bigint,
    lm.mining_date,
    COALESCE(lmc.total_from_last_mining, 0)::bigint
  FROM source_emails se
  LEFT JOIN total_per_source   tps ON tps.src = se.src
  LEFT JOIN latest_mining      lm  ON lm.src = se.src
  LEFT JOIN last_mining_counts lmc ON lmc.src = se.src;
END;
$$;


-- ---------------------------------------------------------------------------
-- 9. delete_contacts: accept either person_ids or emails for partial deletes
-- ---------------------------------------------------------------------------
-- New signature: (user_id uuid, ids uuid[], deleteallcontacts boolean)
-- Behavior: ids[] is used to identify the persons to delete. The previous
-- email-based signature is dropped; callers should pass person UUIDs. For
-- bulk delete, pass deleteallcontacts = true and an empty ids array.

DROP FUNCTION IF EXISTS private.delete_contacts(uuid, text[], boolean);

CREATE FUNCTION private.delete_contacts(
    user_id uuid,
    ids uuid[],
    deleteallcontacts boolean
) RETURNS void
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
DECLARE
  owner_id uuid;
  v_person_ids uuid[];
BEGIN
  owner_id = delete_contacts.user_id;

  IF deleteallcontacts THEN
    DELETE FROM private.messages       m  WHERE m.user_id = owner_id;
    DELETE FROM private.persons        p  WHERE p.user_id = owner_id;
    DELETE FROM private.refinedpersons rp WHERE rp.user_id = owner_id;
    DELETE FROM private.pointsofcontact poc WHERE poc.user_id = owner_id;
    DELETE FROM private.tags           t  WHERE t.user_id = owner_id;
    DELETE FROM private.engagement     e  WHERE e.user_id = owner_id;
  ELSE
    -- ids[] already contains person_ids; we just need to filter to the
    -- user's own persons (defense in depth).
    SELECT array_agg(id) INTO v_person_ids
    FROM private.persons p
    WHERE p.user_id = owner_id
      AND p.id = ANY(ids);

    -- Cascade-delete by person_id (covers POC, tags, refinedpersons, engagement)
    IF v_person_ids IS NOT NULL THEN
      DELETE FROM private.messages m
      WHERE m.message_id IN (
          SELECT message_id
          FROM private.pointsofcontact poc
          WHERE poc.user_id = owner_id AND poc.person_id = ANY(v_person_ids)
      );

      DELETE FROM private.pointsofcontact poc WHERE poc.user_id = owner_id AND poc.person_id = ANY(v_person_ids);
      DELETE FROM private.tags           t   WHERE t.user_id = owner_id AND t.person_id = ANY(v_person_ids);
      DELETE FROM private.refinedpersons rp  WHERE rp.user_id = owner_id AND rp.person_id = ANY(v_person_ids);
      DELETE FROM private.engagement     e   WHERE e.user_id = owner_id AND e.person_id = ANY(v_person_ids);
      DELETE FROM private.persons        p   WHERE p.user_id = owner_id AND p.id = ANY(v_person_ids);
    END IF;
  END IF;
END;
$$;


-- ---------------------------------------------------------------------------
-- 10. refine_persons: rebuild by person_id, not person_email
-- ---------------------------------------------------------------------------
-- This is a structural rewrite of the latest refine_persons. All the
-- aggregations (occurrence, recency, seniority, temperature, sender, recipient,
-- conversations, replied_conversations) are preserved verbatim, only the
-- GROUP BY / JOIN keys change from person_email to person_id.
--
-- Deviation from plan: refinedpersons has no `name` column, so the INSERT
-- omits it (the source refine_persons also omits it). The `name` is still
-- computed in combined_data and used to UPDATE private.persons.name.

DROP FUNCTION IF EXISTS private.refine_persons(uuid);

CREATE OR REPLACE FUNCTION private.refine_persons(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    CREATE TEMP TABLE user_points_of_contact ON COMMIT DROP AS
        SELECT
            poc.person_id,
            poc.name,
            poc.plus_address,
            poc.message_id,
            poc."from",
            poc."to",
            poc.bcc,
            poc.cc,
            poc.reply_to,
            m.date,
            m.conversation
        FROM private.pointsofcontact poc
        JOIN private.messages m
            ON poc.message_id = m.message_id
            AND poc.user_id = m.user_id
        WHERE poc.user_id = p_user_id;

    CREATE TEMP TABLE grouped_tags ON COMMIT DROP AS
        SELECT
            t.person_id,
            array_agg(t.name) AS tags
        FROM private.tags t
        WHERE t.user_id = p_user_id
        GROUP BY t.person_id
        HAVING
            BOOL_OR(t.source = 'refined#email_address' AND t.reachable = 1)
            AND (
                NOT BOOL_OR(t.source = 'refined#message_header')
                OR BOOL_OR(t.source = 'refined#message_header' AND t.reachable != 3)
            );

    CREATE TEMP TABLE name_aggregates ON COMMIT DROP AS
        SELECT
            upc.person_id,
            upc.name,
            MAX(upc.date) AS recent_date,
            COUNT(*) AS total,
            array_agg(upc.name) OVER (PARTITION BY upc.person_id) AS alternate_name
        FROM user_points_of_contact upc
        WHERE upc.name IS NOT NULL
        GROUP BY upc.person_id, upc.name;

    CREATE TEMP TABLE real_names ON COMMIT DROP AS
        SELECT DISTINCT
            na.person_id,
            FIRST_VALUE(na.name) OVER (
                PARTITION BY na.person_id
                ORDER BY na.total DESC, na.recent_date DESC
            ) AS preferred_name,
            na.alternate_name
        FROM name_aggregates na;

    CREATE TEMP TABLE email_aggregates ON COMMIT DROP AS
        SELECT
            upc.person_id,
            MAX(upc.date) AS recency,
            MIN(upc.date) AS seniority,
            private.get_distinct_or_exclude_from_array(
                array_agg(upc.plus_address)::text[],
                ARRAY[]::text[]
            ) AS alternate_email,
            COUNT(*) AS occurrence,
            COUNT(CASE WHEN upc."from" = true OR upc.reply_to = true THEN 1 END) AS sender,
            COUNT(CASE WHEN upc."to" = true OR upc.bcc = true OR upc.cc = true THEN 1 END) AS recipient,
            COUNT(CASE WHEN upc.conversation = true THEN 1 END) AS conversations,
            COUNT(CASE WHEN upc.conversation = true AND upc."from" = true THEN 1 END) AS replied_conversations
        FROM user_points_of_contact upc
        GROUP BY upc.person_id;

    CREATE TEMP TABLE combined_data ON COMMIT DROP AS
        SELECT
            ea.person_id,
            ea.recency,
            ea.seniority,
            ea.occurrence,
            ea.sender,
            ea.recipient,
            ea.conversations,
            ea.replied_conversations,
            ea.alternate_email,
            gt.tags AS tags,
            pn.preferred_name AS name,
            private.get_distinct_or_exclude_from_array(
                pn.alternate_name,
                ARRAY[pn.preferred_name]
            ) AS alternate_name
        FROM email_aggregates ea
        LEFT JOIN real_names pn ON ea.person_id = pn.person_id
        JOIN grouped_tags gt ON ea.person_id = gt.person_id;

    UPDATE private.persons p
    SET
        name = cd.name,
        alternate_name = cd.alternate_name,
        alternate_email = cd.alternate_email
    FROM combined_data cd
    WHERE p.id = cd.person_id
      AND p.user_id = p_user_id;

    INSERT INTO private.refinedpersons (
        person_id, user_id, occurrence, recency, seniority,
        sender, recipient, conversations, replied_conversations, tags
    )
    SELECT
        cd.person_id,
        p_user_id,
        cd.occurrence,
        cd.recency,
        cd.seniority,
        cd.sender,
        cd.recipient,
        cd.conversations,
        cd.replied_conversations,
        cd.tags
    FROM combined_data cd
    ON CONFLICT (person_id, user_id) DO UPDATE
    SET
        occurrence = EXCLUDED.occurrence,
        recency = EXCLUDED.recency,
        seniority = EXCLUDED.seniority,
        sender = EXCLUDED.sender,
        recipient = EXCLUDED.recipient,
        conversations = EXCLUDED.conversations,
        replied_conversations = EXCLUDED.replied_conversations,
        tags = EXCLUDED.tags;

    DROP TABLE IF EXISTS user_points_of_contact;
    DROP TABLE IF EXISTS grouped_tags;
    DROP TABLE IF EXISTS name_aggregates;
    DROP TABLE IF EXISTS real_names;
    DROP TABLE IF EXISTS email_aggregates;
    DROP TABLE IF EXISTS combined_data;

    DELETE FROM private.messages m WHERE m.user_id = p_user_id;
END;
$$;


-- ---------------------------------------------------------------------------
-- 11. enrich_contacts: skip records without email (phone-only)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS private.enrich_contacts(jsonb[], boolean);

CREATE OR REPLACE FUNCTION private.enrich_contacts(
    p_contacts_data jsonb[],
    p_update_empty_fields_only boolean DEFAULT true
) RETURNS void
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
DECLARE
  contact_record JSONB;
  organization_id UUID;
  works_for_name TEXT;
  new_name TEXT;
  new_alternate_name TEXT[];
  old_name TEXT;
  old_alternate_name TEXT[];

  phone_number TEXT;
  new_telephone TEXT[];
  old_telephone TEXT[];
  merged_telephone TEXT[];

BEGIN
  -- Assert that all records have user_id; email is now optional
  IF EXISTS (
    SELECT 1
    FROM unnest(p_contacts_data) AS contact
    WHERE contact->>'user_id' IS NULL
  ) THEN
    RAISE EXCEPTION 'All records in p_contacts_data must contain user_id field';
  END IF;

  FOREACH contact_record IN ARRAY p_contacts_data
  LOOP
    -- Skip phone-only records (no email to enrich against)
    IF contact_record->>'email' IS NULL THEN
      CONTINUE;
    END IF;

    works_for_name := contact_record->>'works_for';
    IF works_for_name IS NOT NULL THEN
      SELECT id INTO organization_id
      FROM private.organizations
      WHERE name = works_for_name
      LIMIT 1;

      IF NOT FOUND THEN
        INSERT INTO private.organizations (name)
        VALUES (works_for_name)
        RETURNING id INTO organization_id;
      END IF;
    ELSE
      organization_id := NULL;
    END IF;

    new_telephone := string_to_array(NULLIF(contact_record->>'telephone', ''), ',');

    IF new_telephone IS NOT NULL THEN
        SELECT p.telephone
            INTO old_telephone
            FROM private.persons p
        WHERE p.email = contact_record->>'email'
            AND p.user_id = (contact_record->>'user_id')::UUID
        LIMIT 1;

        IF old_telephone IS NOT NULL THEN
            FOREACH phone_number IN ARRAY new_telephone LOOP
            IF NOT phone_number = ANY(old_telephone) THEN
                old_telephone := ARRAY_APPEND(old_telephone, phone_number);
            END IF;
            END LOOP;
            merged_telephone := old_telephone;
        ELSE
            merged_telephone := new_telephone;
        END IF;
    END IF;

    new_name := contact_record->>'name';
    IF new_name IS NOT NULL THEN
      SELECT p.name, p.alternate_name
      INTO old_name, old_alternate_name
      FROM private.persons p
      WHERE p.email = contact_record->>'email' AND p.user_id = (contact_record->>'user_id')::UUID
      LIMIT 1;
      IF old_name IS NOT NULL THEN
        IF (old_name != new_name AND (old_alternate_name IS NULL OR NOT(new_name = ANY(old_alternate_name)))) THEN
          new_alternate_name := ARRAY_APPEND(old_alternate_name, new_name);
        END IF;
        new_name := old_name;
      END IF;
    END IF;

    IF p_update_empty_fields_only THEN
      UPDATE private.persons pp
      SET
        name = COALESCE(pp.name, new_name::TEXT),
        url = COALESCE(pp.url, (contact_record->>'url')::TEXT),
        image = COALESCE(pp.image, (contact_record->>'image')::TEXT),
        location = COALESCE(pp.location, NULLIF(contact_record->>'location', '')),
        alternate_name = COALESCE(pp.alternate_name, (new_alternate_name)::TEXT[]),
        same_as = COALESCE(pp.same_as, string_to_array(NULLIF(contact_record->>'same_as', ''), ',')::TEXT[]),
        given_name = COALESCE(pp.given_name, (contact_record->>'given_name')::TEXT),
        family_name = COALESCE(pp.family_name, (contact_record->>'family_name')::TEXT),
        job_title = COALESCE(pp.job_title, (contact_record->>'job_title')::TEXT),
        works_for = COALESCE(pp.works_for, organization_id),
        identifiers = COALESCE(pp.identifiers, string_to_array(NULLIF(contact_record->>'identifiers', ''), ',')::TEXT[]),
        status = COALESCE(pp.status, (contact_record->>'status')::TEXT),
        telephone = COALESCE(pp.telephone, (merged_telephone)::TEXT[])
      WHERE
        email = (contact_record->>'email')::TEXT AND
        user_id = (contact_record->>'user_id')::UUID;
    ELSE
      UPDATE private.persons pp
      SET
        name = COALESCE(new_name::TEXT, pp.name),
        url = COALESCE((contact_record->>'url')::TEXT, pp.url),
        image = COALESCE((contact_record->>'image')::TEXT, pp.image),
        location = COALESCE(pp.location, NULLIF(contact_record->>'location', '')),
        alternate_name = COALESCE((new_alternate_name)::TEXT[], pp.alternate_name),
        same_as = COALESCE(string_to_array(NULLIF(contact_record->>'same_as', ''), ',')::TEXT[], pp.same_as),
        given_name = COALESCE((contact_record->>'given_name')::TEXT, pp.given_name),
        family_name = COALESCE((contact_record->>'family_name')::TEXT, pp.family_name),
        job_title = COALESCE((contact_record->>'job_title')::TEXT, pp.job_title),
        works_for = COALESCE(organization_id, pp.works_for),
        identifiers = COALESCE(string_to_array(NULLIF(contact_record->>'identifiers', ''), ',')::TEXT[], pp.identifiers),
        status = COALESCE((contact_record->>'status')::TEXT, pp.status),
        telephone = COALESCE((merged_telephone)::TEXT[], pp.telephone)
      WHERE
        email = (contact_record->>'email')::TEXT AND
        user_id = (contact_record->>'user_id')::UUID;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
