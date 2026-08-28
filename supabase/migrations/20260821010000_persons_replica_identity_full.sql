-- Realtime reconciliation of contacts relies on knowing which email-group a
-- changed persons row belonged to. Default replica identity (primary key) only
-- carries the id, so DELETE/UPDATE payloads lack old.email and deleted/renamed
-- groups could never be re-read from contacts_view. FULL identity makes the
-- whole old row available on DELETE and UPDATE.
ALTER TABLE private.persons REPLICA IDENTITY FULL;