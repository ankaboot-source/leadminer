-- ============================================================================
-- Deduplicate pointsofcontact and enforce uniqueness for idempotent inserts
-- ============================================================================
-- The backend inserts POC rows with
--   ON CONFLICT (user_id, message_id, person_id) DO NOTHING,
-- which requires a matching unique index. Re-mined folders created
-- duplicate rows over time, so purge them first (deterministic keep-min(id)
-- per key) — otherwise the unique index build fails on existing duplicates.
-- Single-statement, atomic: either the table is clean with the index built,
-- or nothing changed.
-- ============================================================================

-- Deduplicate: keep the oldest row per (user_id, message_id, person_id).
DELETE FROM private.pointsofcontact d
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, message_id, person_id ORDER BY id
         ) AS rn
  FROM private.pointsofcontact
) r
WHERE d.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS pointsofcontact_user_message_person_uq
    ON private.pointsofcontact (user_id, message_id, person_id);
