create policy "Enable delete for users based on user_id" on "private"."persons" as permissive for delete to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

CREATE OR REPLACE FUNCTION private.delete_contacts(user_id uuid, emails text[], deleteallcontacts boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$ 
DECLARE
  owner_id uuid;
BEGIN
	owner_id = delete_contacts.user_id;
	IF deleteallcontacts THEN
		DELETE FROM private.persons p WHERE p.user_id = owner_id;
		DELETE FROM private.refinedpersons rp WHERE rp.user_id = owner_id;
		DELETE FROM private.pointsofcontact poc WHERE poc.user_id = owner_id;
	ELSE
		DELETE FROM private.persons p WHERE p.user_id = owner_id AND email = ANY(emails);
		DELETE FROM private.refinedpersons rp WHERE rp.user_id = owner_id AND email = ANY(emails);
		DELETE FROM private.pointsofcontact poc WHERE poc.user_id = owner_id AND person_email = ANY(emails);
	END IF;
END;
$$;


CREATE OR REPLACE FUNCTION private.delete_user_data(user_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
DECLARE
  owner_id uuid;
BEGIN
  owner_id = delete_user_data.user_id;
  DELETE FROM private.messages msg WHERE msg.user_id = owner_id;
  DELETE FROM private.tags t WHERE t.user_id = owner_id;
  DELETE FROM private.mining_sources ms WHERE ms.user_id = owner_id;
  DELETE FROM private.engagement eg WHERE eg.user_id = owner_id;
  PERFORM private.delete_contacts(owner_id, NULL, TRUE);
END;
$$;

