-- Comprehensive fix: update private.delete_user_data to cover ALL user-owned tables
--
-- The 20260605150000 fix added smtp_senders, email/sms campaigns and
-- whatsapp_sessions, but missed three user-owned tables that leave
-- orphaned rows behind:
--
--   - private.email_status    (existing since Nov 2024, no FK cascade)
--   - private.signatures      (existing since Nov 2025, ON DELETE CASCADE
--                              to auth.users — no FK issues, but still
--                              orphaned data)
--   - private.notifications   (existing since Jun 2026, no FK at all)
--
-- Since none of these tables are referenced by FK from other user-owned
-- tables, they do not cause delete failures — they just waste space.
-- This migration brings them into the function for completeness.
--
-- Also removes the explicit tags deletion: tags are already handled by
-- private.delete_contacts (called below), which cleans up tags per person.
-- The duplicate DELETE was harmless but unnecessary.
--
-- Deletion order remains: children before parents, to avoid FK violations.

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

  -- Tables with direct user_id and no FK dependencies
  DELETE FROM private.email_status es WHERE es.user_id = owner_id;
  DELETE FROM private.signatures sig WHERE sig.user_id = owner_id;
  DELETE FROM private.notifications n WHERE n.user_id = owner_id;

  -- Original RPC body (tags removed — handled by delete_contacts below)
  DELETE FROM private.messages msg WHERE msg.user_id = owner_id;
  DELETE FROM private.mining_sources ms WHERE ms.user_id = owner_id;
  DELETE FROM private.engagement eg WHERE eg.user_id = owner_id;
  PERFORM private.delete_contacts(owner_id, NULL, TRUE);
END;
$$;
