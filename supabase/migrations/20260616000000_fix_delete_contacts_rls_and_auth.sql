-- Fix: delete_contacts RLS, auth.uid(), and ownership boundary cleanup
--
-- 1. private.tags had RLS enabled but no DELETE policy — delete_contacts
--    runs as SECURITY INVOKER, so tag deletions were silently blocked.
--    This adds the missing policy.
--
-- 2. delete_contacts accepted p_user_id from the frontend, creating a
--    tampering vector. Switch to auth.uid() internally (only called
--    from frontend with an authenticated session).
--
-- 3. delete_contacts was deleting from private.engagement (billing/activity
--    audit data). Engagement belongs in delete_user_data (full account
--    teardown), not contact deletion.
--
-- 4. delete_user_data called delete_contacts as a sub-step, but
--    delete_contacts now uses auth.uid() which would be NULL under
--    the service role. Instead, delete_user_data directly deletes
--    all contact tables (messages, tags, pointsofcontact,
--    refinedpersons, persons) so it's self-contained for account
--    teardown. Tags and refinedpersons move from delete_contacts
--    into delete_user_data's direct delete list.

-- 1. Add missing DELETE policy for private.tags
CREATE POLICY "Enable delete for users based on user_id"
  ON private.tags
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Rewrite delete_contacts to use auth.uid() and remove engagement deletes
-- Drop old overload (3 params: p_user_id, p_ids, p_delete_all) — the new
-- signature has only 2 params (p_ids, p_delete_all).
DROP FUNCTION IF EXISTS private.delete_contacts(uuid, uuid[], boolean);

CREATE OR REPLACE FUNCTION private.delete_contacts(
    p_ids uuid[],
    p_delete_all boolean
) RETURNS void
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
DECLARE
  v_person_ids uuid[];
BEGIN
  IF p_delete_all THEN
    DELETE FROM private.messages       m  WHERE m.user_id = auth.uid();
    DELETE FROM private.persons        p  WHERE p.user_id = auth.uid();
    DELETE FROM private.refinedpersons rp WHERE rp.user_id = auth.uid();
    DELETE FROM private.pointsofcontact poc WHERE poc.user_id = auth.uid();
    DELETE FROM private.tags           t  WHERE t.user_id = auth.uid();
  ELSE
    SELECT array_agg(id) INTO v_person_ids
    FROM private.persons p
    WHERE p.user_id = auth.uid()
      AND p.id = ANY(p_ids);

    IF v_person_ids IS NOT NULL THEN
      DELETE FROM private.messages m
      WHERE m.user_id = auth.uid()
        AND m.message_id IN (
            SELECT message_id
            FROM private.pointsofcontact poc
            WHERE poc.user_id = auth.uid() AND poc.person_id = ANY(v_person_ids)
        );

      DELETE FROM private.pointsofcontact poc WHERE poc.user_id = auth.uid() AND poc.person_id = ANY(v_person_ids);
      DELETE FROM private.tags           t   WHERE t.user_id = auth.uid() AND t.person_id = ANY(v_person_ids);
      DELETE FROM private.refinedpersons rp  WHERE rp.user_id = auth.uid() AND rp.person_id = ANY(v_person_ids);
      DELETE FROM private.persons        p   WHERE p.user_id = auth.uid() AND p.id = ANY(v_person_ids);
    END IF;
  END IF;
END;
$$;

-- 3. Self-contained delete_user_data: directly deletes all user-owned
--    contact tables instead of delegating to delete_contacts (which now
--    uses auth.uid() and would break under the service role).
--    Tags moved here from the original (tags are contact-related, not
--    user-activity); engagement stays here (user activity audit data).
CREATE OR REPLACE FUNCTION private.delete_user_data(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
BEGIN
  owner_id = delete_user_data.user_id;

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

  -- Contact data (self-contained, no longer delegating to delete_contacts)
  DELETE FROM private.messages msg WHERE msg.user_id = owner_id;
  DELETE FROM private.refinedpersons rp WHERE rp.user_id = owner_id;
  DELETE FROM private.pointsofcontact poc WHERE poc.user_id = owner_id;
  DELETE FROM private.tags t WHERE t.user_id = owner_id;
  DELETE FROM private.persons p WHERE p.user_id = owner_id;
  DELETE FROM private.mining_sources ms WHERE ms.user_id = owner_id;

  -- User activity / billing audit data
  DELETE FROM private.engagement eg WHERE eg.user_id = owner_id;
END;
$$;
