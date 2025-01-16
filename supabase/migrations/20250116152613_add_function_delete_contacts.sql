CREATE FUNCTION private.delete_contacts(emails text[], deleteallcontacts boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$ 
BEGIN
	IF deleteallcontacts THEN
		DELETE FROM private.persons WHERE (TRUE);
		DELETE FROM private.refinedpersons WHERE (TRUE);
	ELSE
		DELETE FROM private.persons WHERE email = ANY(emails);
		DELETE FROM private.refinedpersons WHERE email = ANY(emails);
	END IF;
END;
$$;