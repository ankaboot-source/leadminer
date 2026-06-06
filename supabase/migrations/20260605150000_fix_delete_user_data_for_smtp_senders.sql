-- Fix: delete-user edge function failed with FK violation on
-- smtp_senders_mining_source_id_fkey. The smtp_senders table was added
-- in 20260530120000_add_smtp_senders.sql with a mining_source_id FK
-- lacking ON DELETE CASCADE. The private.delete_user_data RPC tried to
-- delete mining_sources before clearing smtp_senders, violating the FK.
--
-- This migration (1) adds ON DELETE CASCADE to the FK so the order
-- becomes safe, and (2) updates the RPC to explicitly delete from
-- smtp_senders and all other user-owned tables added since the RPC
-- was last updated on 2025-01-16.
--
-- Side effect: deleting a mining source now cascades to its linked
-- smtp_senders (previously a foreign key violation).

ALTER TABLE private.smtp_senders
  DROP CONSTRAINT smtp_senders_mining_source_id_fkey;

ALTER TABLE private.smtp_senders
  ADD CONSTRAINT smtp_senders_mining_source_id_fkey
  FOREIGN KEY (mining_source_id) REFERENCES private.mining_sources(id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION private.delete_user_data(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
BEGIN
  owner_id = delete_user_data.user_id;

  -- All user_id references below are qualified with the table alias
  -- (e.g. "s.user_id") on purpose. The function parameter is named
  -- "user_id", and in plpgsql an unqualified identifier resolves to
  -- variables/parameters before columns, so writing the bare column
  -- name would compare the parameter to itself and either error or
  -- delete the wrong rows. Do not "clean up" the aliases.
  -- Tables referencing other user-owned tables; delete dependents first.
  DELETE FROM private.smtp_senders s WHERE s.user_id = owner_id;
  DELETE FROM private.email_campaign_links l
    USING private.email_campaign_recipients r
    WHERE l.recipient_id = r.id AND r.user_id = owner_id;
  DELETE FROM private.email_campaign_events e
    USING private.email_campaign_recipients r
    WHERE e.recipient_id = r.id AND r.user_id = owner_id;
  DELETE FROM private.email_campaign_recipients r WHERE r.user_id = owner_id;
  DELETE FROM private.email_campaigns ec WHERE ec.user_id = owner_id;
  -- sms_campaign_recipients has no user_id column; join via sms_campaigns
  -- (which has ON DELETE CASCADE down to recipients, link_clicks, and
  -- recipient_gateways). sms_campaign_unsubscribes does NOT cascade
  -- through campaign_id (FK is ON DELETE SET NULL), so it must be
  -- deleted explicitly by user_id.
  DELETE FROM private.sms_campaign_link_clicks c
    USING private.sms_campaigns camp
    WHERE c.campaign_id = camp.id AND camp.user_id = owner_id;
  DELETE FROM private.sms_campaign_unsubscribes u WHERE u.user_id = owner_id;
  DELETE FROM private.sms_campaign_recipient_gateways g
    USING private.sms_campaigns camp
    WHERE g.campaign_id = camp.id AND camp.user_id = owner_id;
  DELETE FROM private.sms_campaign_recipients sr
    USING private.sms_campaigns camp
    WHERE sr.campaign_id = camp.id AND camp.user_id = owner_id;
  DELETE FROM private.sms_campaigns sc WHERE sc.user_id = owner_id;
  DELETE FROM private.sms_fleet_gateways f WHERE f.user_id = owner_id;
  DELETE FROM private.whatsapp_sessions w WHERE w.user_id = owner_id;

  -- Original RPC body (unchanged)
  DELETE FROM private.messages msg WHERE msg.user_id = owner_id;
  DELETE FROM private.tags t WHERE t.user_id = owner_id;
  DELETE FROM private.mining_sources ms WHERE ms.user_id = owner_id;
  DELETE FROM private.engagement eg WHERE eg.user_id = owner_id;
  PERFORM private.delete_contacts(owner_id, NULL, TRUE);
END;
$$;
