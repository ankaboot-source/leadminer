-- Rewrite delete_contacts to use auth.uid() (2-param signature, no p_user_id)
--
-- The old 3-param signature (p_user_id uuid, p_ids uuid[], p_delete_all boolean)
-- accepted an untrusted p_user_id from the frontend, creating a tampering
-- vector. The new 2-param signature reads auth.uid() internally.
--
-- This also drops the engagement delete from delete_contacts — engagement
-- (billing/activity audit) belongs in delete_user_data (full account teardown),
-- not contact deletion.

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
