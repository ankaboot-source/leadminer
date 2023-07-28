-- Create the PostgreSQL function to delete the user and their related data
-- Update database function permission for authenticated

CREATE OR REPLACE FUNCTION delete_user_data(userid UUID) RETURNS VOID
AS $$
DECLARE
  owner_id uuid;
BEGIN
  owner_id = delete_user_data.userid;
  DELETE FROM messages msg WHERE msg.user_id = owner_id;
  DELETE FROM persons p WHERE p.user_id = owner_id;
  DELETE FROM pointsofcontact poc WHERE poc.user_id = owner_id;
  DELETE FROM tags t WHERE t.user_id = owner_id;
  DELETE FROM refinedpersons r WHERE r.userid = owner_id;
  DELETE from mining_sources ms WHERE ms.user_id = owner_id;
END;
$$ LANGUAGE plpgsql;

-- Change functions permissions
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- Choose which roles can execute functions
GRANT EXECUTE ON FUNCTION delete_user_data TO service_role;
GRANT EXECUTE ON FUNCTION refined_persons TO authenticated;
