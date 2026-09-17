-- ============================================================================
-- refine_persons: cumulative stats via a messages ledger + transient POC
-- ============================================================================
-- Fixes two problems:
--   1. Perf: refine_persons scanned ALL pointsofcontact for the user (no
--      (user_id, ...) index; HASH(user_id) partitioned) -> full table scan ->
--      Kong ~60s upstream timeout -> "Failed to trigger email notification,
--      refine contacts ... timing out".
--   2. Correctness: pointsofcontact grew unbounded (plain INSERT, never
--      deleted; re-mined folders re-insert duplicates) while refinedpersons
--      was OVERWRITTEN each run -> stats reflected only the last cycle.
--
-- New model:
--   - private.messages becomes a permanent per-user LEDGER: idempotent inserts
--     (ON CONFLICT (message_id, user_id) DO NOTHING) + new `refined_at`
--     marker. Messages are NEVER drained again; a message whose refined_at is
--     set is never re-counted (re-mine idempotent).
--   - private.pointsofcontact becomes TRANSIENT staging: still the join source
--     for the aggregation, but its rows are DELETED once the owning message is
--     refined. Inserts become idempotent via a new unique index.
--   - private.refinedpersons becomes the CUMULATIVE truth via an ACCUMULATE
--     upsert (counts += delta, recency/seniority GREATEST/LEAST, tags union).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. pointsofcontact indexing (partition-aware; propagates to each HASH(user_id) partition)
-- ---------------------------------------------------------------------------

-- Kill the full-table scan on the join / person scoping.
CREATE INDEX IF NOT EXISTS pointsofcontact_user_message_idx
    ON private.pointsofcontact (user_id, message_id);
CREATE INDEX IF NOT EXISTS pointsofcontact_user_person_idx
    ON private.pointsofcontact (user_id, person_id);

-- One-time cleanup: purge POC rows whose message is no longer in the ledger.
-- Such rows were already counted (their messages were drained by old refine),
-- so dropping them loses no statistics; it removes the unbounded dead weight.
DO $$
DECLARE
    v_batch bigint := 100000;
    v_deleted bigint;
    v_total bigint := 0;
BEGIN
    LOOP
        WITH orphans AS (
            SELECT poc.ctid
            FROM private.pointsofcontact poc
            WHERE NOT EXISTS (
                SELECT 1 FROM private.messages m
                WHERE m.message_id = poc.message_id AND m.user_id = poc.user_id
            )
            LIMIT v_batch
            FOR UPDATE
        )
        DELETE FROM private.pointsofcontact poc
        USING orphans o
        WHERE poc.ctid = o.ctid;
        GET DIAGNOSTICS v_deleted := ROW_COUNT;
        v_total := v_total + v_deleted;
        EXIT WHEN v_deleted < v_batch;
    END LOOP;
    RAISE NOTICE 'refine migration: purged % orphan pointsofcontact rows', v_total;
END $$;

-- Deduplicate remaining rows (re-mined folders created dups) before the unique
-- index: deterministic keep-min(id) per (user_id, message_id, person_id).
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id, message_id, person_id ORDER BY id) AS rn
    FROM private.pointsofcontact
)
DELETE FROM private.pointsofcontact d
USING ranked r
WHERE d.id = r.id AND r.rn > 1;

-- Idempotent POC inserts (backed by backend ON CONFLICT DO NOTHING).
CREATE UNIQUE INDEX IF NOT EXISTS pointsofcontact_user_message_person_uq
    ON private.pointsofcontact (user_id, message_id, person_id);

-- Also help the tags aggregation.
CREATE INDEX IF NOT EXISTS tags_user_person_idx
    ON private.tags (user_id, person_id);

-- ---------------------------------------------------------------------------
-- 2. messages ledger: add refined_at marker (propagates to partitions)
-- ---------------------------------------------------------------------------

ALTER TABLE private.messages ADD COLUMN IF NOT EXISTS refined_at timestamptz;
CREATE INDEX IF NOT EXISTS messages_user_refined_at_idx
    ON private.messages (user_id, refined_at);

-- ---------------------------------------------------------------------------
-- 3. refine_persons: ledger + transient POC + accumulate
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS private.refine_persons(uuid);
DROP FUNCTION IF EXISTS private.refine_persons(uuid, uuid[]);

CREATE FUNCTION private.refine_persons(p_user_id uuid, p_person_ids uuid[] DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_scope uuid[];
BEGIN
    -- Resolve the person scope. NULL => the user's persons (natural backfill).
    IF p_person_ids IS NULL THEN
        SELECT array_agg(id) INTO v_scope FROM private.persons WHERE user_id = p_user_id;
    ELSE
        v_scope := p_person_ids;
    END IF;

    IF v_scope IS NULL OR cardinality(v_scope) = 0 THEN
        RETURN;
    END IF;

    -- Eligible messages: unrefined messages carrying a POC row for a scoped
    -- person. We then process ALL POC of those messages (all persons) so a
    -- multi-person message is added to every touched person exactly once.
    CREATE TEMP TABLE eligible_messages ON COMMIT DROP AS
        SELECT DISTINCT poc.message_id
        FROM private.pointsofcontact poc
        JOIN private.messages m
            ON poc.message_id = m.message_id AND poc.user_id = m.user_id
        WHERE poc.user_id = p_user_id
          AND m.refined_at IS NULL
          AND poc.person_id = ANY(v_scope);

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
            ON poc.message_id = m.message_id AND poc.user_id = m.user_id
        JOIN eligible_messages em ON em.message_id = poc.message_id
        WHERE poc.user_id = p_user_id
          AND m.refined_at IS NULL;

    CREATE TEMP TABLE grouped_tags ON COMMIT DROP AS
        SELECT
            t.person_id,
            array_agg(t.name) AS tags
        FROM private.tags t
        WHERE t.user_id = p_user_id
          AND t.person_id IN (SELECT person_id FROM user_points_of_contact)
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

    -- Persons identity: keep today's name/alternate name/alternate email update.
    UPDATE private.persons p
    SET
        name = cd.name,
        alternate_name = cd.alternate_name,
        alternate_email = cd.alternate_email
    FROM combined_data cd
    WHERE p.id = cd.person_id
      AND p.user_id = p_user_id;

    -- Accumulate: never overwrite. Each message adds to the running stats.
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
        occurrence = COALESCE(private.refinedpersons.occurrence, 0) + EXCLUDED.occurrence,
        recency    = GREATEST(private.refinedpersons.recency, EXCLUDED.recency),
        seniority  = LEAST(private.refinedpersons.seniority, EXCLUDED.seniority),
        sender     = COALESCE(private.refinedpersons.sender, 0) + EXCLUDED.sender,
        recipient  = COALESCE(private.refinedpersons.recipient, 0) + EXCLUDED.recipient,
        conversations = COALESCE(private.refinedpersons.conversations, 0) + EXCLUDED.conversations,
        replied_conversations = COALESCE(private.refinedpersons.replied_conversations, 0) + EXCLUDED.replied_conversations,
        tags = ARRAY(
            SELECT DISTINCT unnest(
                COALESCE(private.refinedpersons.tags, '{}'::text[]) ||
                COALESCE(EXCLUDED.tags, '{}'::text[])
            )
        ),
        updated_at = now();

    -- Mark the processed messages on the ledger => never re-counted.
    UPDATE private.messages m
    SET refined_at = now()
    WHERE m.user_id = p_user_id
      AND m.refined_at IS NULL
      AND m.message_id IN (SELECT DISTINCT message_id FROM user_points_of_contact);

    -- Transient staging: remove the POC rows of the processed messages.
    DELETE FROM private.pointsofcontact poc
    WHERE poc.user_id = p_user_id
      AND poc.message_id IN (SELECT DISTINCT message_id FROM user_points_of_contact);

    DROP TABLE IF EXISTS eligible_messages;
    DROP TABLE IF EXISTS user_points_of_contact;
    DROP TABLE IF EXISTS grouped_tags;
    DROP TABLE IF EXISTS name_aggregates;
    DROP TABLE IF EXISTS real_names;
    DROP TABLE IF EXISTS email_aggregates;
    DROP TABLE IF EXISTS combined_data;
END;
$$;

COMMIT;

-- Notes for ops:
-- Post-migration: run one full refine (p_person_ids = NULL) so any residual
-- unrefined messages (already in the ledger) are accounted for:
--   SELECT private.refine_persons('<user_id>');