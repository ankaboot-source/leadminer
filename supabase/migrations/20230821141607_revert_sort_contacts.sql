-- Removes ORDER BY status, reply, occurrence. (Line 38)
CREATE OR REPLACE FUNCTION get_contacts_table(userid uuid)
RETURNS TABLE (
    email TEXT,
    name TEXT,
    status TEXT,
    recency timestamp with time zone,
    seniority timestamp with time zone,
    occurrence INTEGER,
    sender INTEGER,
    recipient INTEGER,
    conversations INTEGER,
    replied_conversations INTEGER,
    tags TEXT []
)
AS
$$
BEGIN
    RETURN QUERY
    SELECT
        p.email,
        p.name,
        p.status,
        rp.recency,
        rp.seniority,
        rp.occurrence,
        rp.sender,
        rp.recipient,
        rp.conversations,
        rp.replied_conversations,
        rp.tags
    FROM 
        persons p
    INNER JOIN 
        refinedpersons rp ON rp.email = p.email 
    WHERE 
        p.user_id = get_contacts_table.userid;
END;
$$
LANGUAGE plpgsql;