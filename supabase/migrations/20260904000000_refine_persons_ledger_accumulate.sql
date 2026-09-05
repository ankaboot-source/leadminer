-- ============================================================================
-- refine_persons: cumulative stats via a messages ledger + transient POC
-- ============================================================================
-- Problems fixed:
--   1. Slow: pointsofcontact had no (user_id, ...) index -> full table scan ->
--      Kong ~60s upstream timeout on refine.
--   2. Wrong stats: pointsofcontact grew unbounded and refinedpersons was
--      overwritten each run, so it only reflected the last mining cycle.
--
-- New model:
--   - messages: permanent per-user ledger with a refined_at marker (never
--     drained, never re-counted). Inserts stay idempotent.
--   - pointsofcontact: transient staging, purged once its messages are refined.
--   - refinedpersons: cumulative via an accumulate upsert (counts += delta,
--     recency/seniority GREATEST/LEAST, tags distinct union).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. pointsofcontact indexes (created on each HASH(user_id) partition)
-- ---------------------------------------------------------------------------

-- Support refine's join and person scoping.
CREATE INDEX IF NOT EXISTS pointsofcontact_user_message_idx
    ON private.pointsofcontact (user_id, message_id);
CREATE INDEX IF NOT EXISTS pointsofcontact_user_person_idx
    ON private.pointsofcontact (user_id, person_id);

-- Purge POC rows whose message no longer exists. These were already counted by
-- the old drain-based refine, so dropping them loses no statistics.
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

-- Deduplicate remaining rows from re-mined folders before the unique index.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id, message_id, person_id ORDER BY id) AS rn
    FROM private.pointsofcontact
)
DELETE FROM private.pointsofcontact d
USING ranked r
WHERE d.id = r.id AND r.rn > 1;

-- Backs the backend's idempotent POC inserts.
CREATE UNIQUE INDEX IF NOT EXISTS pointsofcontact_user_message_person_uq
    ON private.pointsofcontact (user_id, message_id, person_id);

-- Supports the tags aggregation.
CREATE INDEX IF NOT EXISTS tags_user_person_idx
    ON private.tags (user_id, person_id);

-- Key join index for refine's hot path (POC join messages). The (message_id,
-- user_id) PK is unusable after HASH(user_id) partition pruning, so index
-- messages by user_id first to avoid a nested-loop seq scan.
CREATE INDEX IF NOT EXISTS messages_user_message_idx
    ON private.messages (user_id, message_id);

-- ---------------------------------------------------------------------------
-- 2. messages ledger: add refined_at marker (propagates to partitions)
-- ---------------------------------------------------------------------------

ALTER TABLE private.messages ADD COLUMN IF NOT EXISTS refined_at timestamptz;
CREATE INDEX IF NOT EXISTS messages_user_refined_at_idx
    ON private.messages (user_id, refined_at);

-- ---------------------------------------------------------------------------
-- 3. refine_persons: ledger + transient POC + accumulate
-- ---------------------------------------------------------------------------

-- Compute temperature only when not supplied, so refine can precompute it
-- inline and skip the per-row cost. Inserts without a temperature (backend)
-- still get it computed here as before.
CREATE OR REPLACE FUNCTION private.trg_set_contact_temperature()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.temperature IS NULL THEN
    NEW.temperature := private.contact_temperature(
      NEW.sender,
      NEW.recipient,
      NEW.conversations,
      NEW.replied_conversations,
      NEW.recency,
      NEW.seniority,
      now()
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP FUNCTION IF EXISTS private.refine_persons(uuid);
DROP FUNCTION IF EXISTS private.refine_persons(uuid, uuid[]);

CREATE FUNCTION private.refine_persons(p_user_id uuid, p_person_ids uuid[] DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_scope uuid[];
    v_is_scoped boolean := p_person_ids IS NOT NULL AND cardinality(p_person_ids) > 0;
BEGIN
    -- NULL = whole-user backfill; ids = only those persons' unrefined messages.
    -- Callers always pass a message's full person set, so shared messages are
    -- refined for every touched person in one pass.
    IF v_is_scoped THEN
        v_scope := p_person_ids;
        DROP TABLE IF EXISTS tmp_scope;
        CREATE TEMP TABLE tmp_scope ON COMMIT DROP AS
            SELECT unnest(v_scope) AS person_id;
    END IF;

    -- Stage each unrefined message's POC rows (optionally scoped to persons).
    IF v_is_scoped THEN
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
            JOIN tmp_scope sc ON sc.person_id = poc.person_id
            WHERE poc.user_id = p_user_id
              AND m.refined_at IS NULL;
    ELSE
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
            WHERE poc.user_id = p_user_id
              AND m.refined_at IS NULL;
    END IF;

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

    -- Refresh person identity, skipping unchanged rows to avoid redundant updates
    -- (and their realtime events).
    UPDATE private.persons p
    SET
        name = cd.name,
        alternate_name = cd.alternate_name,
        alternate_email = cd.alternate_email
    FROM combined_data cd
    WHERE p.id = cd.person_id
      AND p.user_id = p_user_id
      AND (
        p.name IS DISTINCT FROM cd.name
        OR p.alternate_name IS DISTINCT FROM cd.alternate_name
        OR p.alternate_email IS DISTINCT FROM cd.alternate_email
      );

    -- Accumulate into refinedpersons (never overwrite). Temperature is computed
    -- inline on both branches so the per-row trigger does not recompute it.
    INSERT INTO private.refinedpersons (
        person_id, user_id, occurrence, recency, seniority,
        sender, recipient, conversations, replied_conversations, tags, temperature
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
        cd.tags,
        private.contact_temperature(
            cd.sender::integer, cd.recipient::integer, cd.conversations::integer,
            cd.replied_conversations::integer, cd.recency, cd.seniority, now()
        )
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
        temperature = private.contact_temperature(
            (COALESCE(private.refinedpersons.sender, 0) + EXCLUDED.sender)::integer,
            (COALESCE(private.refinedpersons.recipient, 0) + EXCLUDED.recipient)::integer,
            (COALESCE(private.refinedpersons.conversations, 0) + EXCLUDED.conversations)::integer,
            (COALESCE(private.refinedpersons.replied_conversations, 0) + EXCLUDED.replied_conversations)::integer,
            GREATEST(private.refinedpersons.recency, EXCLUDED.recency),
            LEAST(private.refinedpersons.seniority, EXCLUDED.seniority),
            now()
        ),
        updated_at = now();

    -- Flag processed messages so they are never re-counted.
    UPDATE private.messages m
    SET refined_at = now()
    FROM (SELECT DISTINCT message_id FROM user_points_of_contact) t
    WHERE m.user_id = p_user_id
      AND m.refined_at IS NULL
      AND m.message_id = t.message_id;

    -- Drop the processed POC rows (transient staging).
    DELETE FROM private.pointsofcontact poc
    USING (SELECT DISTINCT message_id FROM user_points_of_contact) t
    WHERE poc.user_id = p_user_id
      AND poc.message_id = t.message_id;

    DROP TABLE IF EXISTS user_points_of_contact;
    DROP TABLE IF EXISTS tmp_scope;
    DROP TABLE IF EXISTS grouped_tags;
    DROP TABLE IF EXISTS name_aggregates;
    DROP TABLE IF EXISTS real_names;
    DROP TABLE IF EXISTS email_aggregates;
    DROP TABLE IF EXISTS combined_data;
END;
$$;
COMMIT;

-- After deploying: run one full refine per active user so any residual
-- unrefined messages are accounted for:
--   SELECT private.refine_persons('<user_id>');