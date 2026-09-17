-- ============================================================================
-- Add (user_id) indexes backing refine_persons / delete_contacts scans
-- ============================================================================
-- Incident: refine_persons on a user with ~2M pointsofcontact rows timed out
-- at Kong (60s). Root cause: pointsofcontact, tags and messages are
-- HASH-partitioned on user_id but carry no secondary index on user_id, so
-- every per-user scan (WHERE user_id = ?) reads the whole partition:
--
--   refine_persons:  SELECT ... FROM pointsofcontact poc JOIN messages m ...
--                    WHERE poc.user_id = ?            (~2M rows, no index)
--   refine_persons:  SELECT ... FROM tags WHERE user_id = ? GROUP BY ...
--   refine_persons:  DELETE FROM messages WHERE user_id = ?
--   delete_contacts: DELETE ... WHERE user_id = ? (+ person_id)
--
-- The join side on messages is additionally covered by its PK
-- (message_id, user_id). Composite (user_id, ...) form, NOT plain (user_id):
-- the leading column serves pure user_id filters identically, while the
-- second column also covers the join (message_id) and GROUP BY (person_id)
-- keys. This matches the indexing already designed in the (unlanded) ledger
-- overhaul, so the two do not stack redundant indexes when that lands
-- (IF NOT EXISTS). Plain CREATE INDEX (not CONCURRENTLY): supabase db push
-- runs each migration in a transaction, and the build briefly locks writes.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pointsofcontact_user_message
    ON private.pointsofcontact (user_id, message_id);
CREATE INDEX IF NOT EXISTS idx_pointsofcontact_user_person
    ON private.pointsofcontact (user_id, person_id);

CREATE INDEX IF NOT EXISTS idx_tags_user_person
    ON private.tags (user_id, person_id);

CREATE INDEX IF NOT EXISTS idx_messages_user_id
    ON private.messages (user_id);

-- Fresh stats so the very first refine call after this migration (the one
-- that motivated it) plans against the new indexes immediately instead of
-- waiting for autovacuum. Transaction-safe.
ANALYZE private.pointsofcontact;
ANALYZE private.tags;
ANALYZE private.messages;
