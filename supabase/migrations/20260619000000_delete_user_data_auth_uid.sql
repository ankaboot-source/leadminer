-- Update private.delete_user_data to use auth.uid() and delegate contact cleanup.
--
-- The old function accepted a user_id parameter and called the obsolete
-- private.delete_contacts(uuid, uuid[], boolean) overload. That overload was
-- dropped when delete_contacts was rewritten to use auth.uid().
--
-- This migration:
--   1. Drops the old private.delete_user_data(uuid) signature.
--   2. Creates a new parameter-less private.delete_user_data() that reads
--      auth.uid() and runs as SECURITY DEFINER so it can clean all user-owned
--      tables without being blocked by RLS.
--   3. Delegates all contact-table deletes to private.delete_contacts(NULL, TRUE).
--   4. Preserves private.email_status rows because that table is a shared cache
--      used to enrich other users' data.

DROP FUNCTION IF EXISTS private.delete_user_data(uuid);

CREATE OR REPLACE FUNCTION private.delete_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Campaign tables (children before parents)
  DELETE FROM private.email_campaign_links l
    USING private.email_campaign_recipients r
    WHERE l.recipient_id = r.id AND r.user_id = auth.uid();
  DELETE FROM private.email_campaign_events e
    USING private.email_campaign_recipients r
    WHERE e.recipient_id = r.id AND r.user_id = auth.uid();
  DELETE FROM private.email_campaign_recipients r WHERE r.user_id = auth.uid();
  DELETE FROM private.email_campaigns ec WHERE ec.user_id = auth.uid();

  -- SMS campaign tables (children before parents)
  DELETE FROM private.sms_campaign_link_clicks c
    USING private.sms_campaigns camp
    WHERE c.campaign_id = camp.id AND camp.user_id = auth.uid();
  DELETE FROM private.sms_campaign_recipient_gateways g
    USING private.sms_campaigns camp
    WHERE g.campaign_id = camp.id AND camp.user_id = auth.uid();
  DELETE FROM private.sms_campaign_recipients sr
    USING private.sms_campaigns camp
    WHERE sr.campaign_id = camp.id AND camp.user_id = auth.uid();
  DELETE FROM private.sms_campaign_unsubscribes u WHERE u.user_id = auth.uid();
  DELETE FROM private.sms_campaigns sc WHERE sc.user_id = auth.uid();

  -- Other user-owned tables
  DELETE FROM private.smtp_senders s WHERE s.user_id = auth.uid();
  DELETE FROM private.sms_fleet_gateways f WHERE f.user_id = auth.uid();
  DELETE FROM private.whatsapp_sessions w WHERE w.user_id = auth.uid();
  DELETE FROM private.signatures sig WHERE sig.user_id = auth.uid();
  DELETE FROM private.notifications n WHERE n.user_id = auth.uid();

  -- Contact data (delegated to the auth.uid()-aware contact deletion RPC)
  PERFORM private.delete_contacts(NULL, TRUE);

  -- Remaining user-owned tables that may be referenced by contacts
  DELETE FROM private.mining_sources ms WHERE ms.user_id = auth.uid();
  DELETE FROM private.engagement eg WHERE eg.user_id = auth.uid();
END;
$$;
