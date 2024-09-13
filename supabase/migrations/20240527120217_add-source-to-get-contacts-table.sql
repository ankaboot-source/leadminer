-- Add source two get_contacts_table & get_contacts_table_by_emails

DROP FUNCTION get_contacts_table;
CREATE OR REPLACE FUNCTION get_contacts_table(userid uuid)
RETURNS TABLE (
    source TEXT,
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
        pr.email as source,
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
    INNER JOIN
        public.profiles pr ON pr.user_id = p.user_id
    WHERE 
        p.user_id = get_contacts_table.userid;
END;
$$
LANGUAGE plpgsql;

DROP FUNCTION get_contacts_table_by_emails;
CREATE OR REPLACE FUNCTION get_contacts_table_by_emails(userid uuid, emails TEXT[])
RETURNS TABLE (
    source TEXT,
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
        pr.email as source,
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
    INNER JOIN
        public.profiles pr ON pr.user_id = p.user_id
    WHERE 
        p.user_id = get_contacts_table_by_emails.userid
        AND p.email = ANY(get_contacts_table_by_emails.emails);
END;
$$
LANGUAGE plpgsql;
