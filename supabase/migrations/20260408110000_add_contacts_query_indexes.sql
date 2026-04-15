-- Performance indexes for contacts pagination queries
CREATE INDEX IF NOT EXISTS idx_persons_user_status ON private.persons(user_id, status);
CREATE INDEX IF NOT EXISTS idx_refinedpersons_user_temperature ON private.refinedpersons(user_id, temperature DESC);
CREATE INDEX IF NOT EXISTS idx_refinedpersons_user_recency ON private.refinedpersons(user_id, recency DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_refinedpersons_user_seniority ON private.refinedpersons(user_id, seniority DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_refinedpersons_user_occurrence ON private.refinedpersons(user_id, occurrence DESC);
CREATE INDEX IF NOT EXISTS idx_refinedpersons_user_replies ON private.refinedpersons(user_id, replied_conversations DESC);
CREATE INDEX IF NOT EXISTS idx_refinedpersons_email_user ON private.refinedpersons(email, user_id);