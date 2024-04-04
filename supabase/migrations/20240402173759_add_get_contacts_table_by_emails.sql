-- Create "get_contacts_table_by_emails" function
CREATE OR REPLACE FUNCTION get_contacts_table_by_emails(userid uuid, emails TEXT[])
RETURNS TABLE (
    email TEXT,
    name TEXT,
    status TEXT,
    recency TIMESTAMP WITH TIME ZONE,
    seniority TIMESTAMP WITH TIME ZONE,
    occurrence INTEGER,
    sender INTEGER,
    recipient INTEGER,
    conversations INTEGER,
    replied_conversations INTEGER,
    tags TEXT[]
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
        p.user_id = get_contacts_table_by_emails.userid
        AND p.email = ANY(get_contacts_table_by_emails.emails);
END;
$$
LANGUAGE plpgsql;
