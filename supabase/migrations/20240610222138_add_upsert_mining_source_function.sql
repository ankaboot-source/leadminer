-- Create the new function
CREATE OR REPLACE FUNCTION upsert_mining_source(
    _user_id uuid,
    _email text,
    _type text,
    _credentials text,
    _encryption_key text
) RETURNS void AS $$
BEGIN
    INSERT INTO mining_sources ("user_id", "email", "type", "credentials")
    VALUES (_user_id, _email, _type, pgp_sym_encrypt(_credentials, _encryption_key))
    ON CONFLICT (email, user_id)
    DO UPDATE 
    SET credentials = EXCLUDED.credentials,
        type = EXCLUDED.type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO extentions, public;
