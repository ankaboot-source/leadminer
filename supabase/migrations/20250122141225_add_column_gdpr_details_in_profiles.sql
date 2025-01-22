ALTER TABLE private.profiles 
ADD COLUMN gdpr_details JSONB DEFAULT '{"hasAcceptedEnriching": false }' NOT NULL;
