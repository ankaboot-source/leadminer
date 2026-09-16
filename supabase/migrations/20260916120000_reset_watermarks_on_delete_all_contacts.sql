-- When a user deletes ALL of their mined contacts, the folder watermarks on
-- their mining sources no longer describe reality: the contacts those runs
-- produced are gone, so the next mining run must treat every folder as
-- unmined and re-scan from scratch.
DROP FUNCTION IF EXISTS private.delete_contacts(uuid[], boolean);

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

    UPDATE private.mining_sources ms
    SET config = ms.config
      #- '{mining,last,folders}'
      #- '{mining,last,folders_mined}'
    WHERE ms.user_id = auth.uid();
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