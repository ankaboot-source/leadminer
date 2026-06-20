ALTER TABLE private.mining_sources
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN private.mining_sources.config IS
  'Per-source configuration flags stored as JSONB, e.g. {"google_contacts_sync": true, "cleaning_enabled": true, "extract_signatures": false}';

DROP FUNCTION IF EXISTS private.get_mining_source_credentials_for_user(uuid, text);

CREATE FUNCTION private.get_mining_source_credentials_for_user(
  _user_id UUID,
  _encryption_key TEXT
)
RETURNS TABLE(
  id UUID,
  email TEXT,
  type TEXT,
  credentials JSONB
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ms.id,
    ms.email,
    ms.type::TEXT,
    extensions.pgp_sym_decrypt(ms.credentials, _encryption_key)::JSONB AS credentials
  FROM private.mining_sources ms
  WHERE ms.user_id = _user_id;
END;
$$;

DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON private.tags;

CREATE POLICY "Enable delete for users based on user_id"
  ON private.tags
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

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

DROP FUNCTION IF EXISTS private.delete_user_data(uuid);

CREATE OR REPLACE FUNCTION private.delete_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM private.email_campaign_links l
    USING private.email_campaign_recipients r
    WHERE l.recipient_id = r.id AND r.user_id = auth.uid();
  DELETE FROM private.email_campaign_events e
    USING private.email_campaign_recipients r
    WHERE e.recipient_id = r.id AND r.user_id = auth.uid();
  DELETE FROM private.email_campaign_recipients r WHERE r.user_id = auth.uid();
  DELETE FROM private.email_campaigns ec WHERE ec.user_id = auth.uid();

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

  DELETE FROM private.smtp_senders s WHERE s.user_id = auth.uid();
  DELETE FROM private.sms_fleet_gateways f WHERE f.user_id = auth.uid();
  DELETE FROM private.whatsapp_sessions w WHERE w.user_id = auth.uid();
  DELETE FROM private.signatures sig WHERE sig.user_id = auth.uid();
  DELETE FROM private.notifications n WHERE n.user_id = auth.uid();

  PERFORM private.delete_contacts(NULL, TRUE);

  DELETE FROM private.mining_sources ms WHERE ms.user_id = auth.uid();
  DELETE FROM private.engagement eg WHERE eg.user_id = auth.uid();
END;
$$;
