ALTER TABLE private.profiles
ALTER COLUMN gdpr_details SET DEFAULT '{"hasAcceptedEnriching": false, "hasAcceptedNewsletter": null}'::jsonb;
