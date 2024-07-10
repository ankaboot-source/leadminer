CREATE OR REPLACE FUNCTION get_contacts_table(userid uuid) RETURNS TABLE (
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
) AS $$
BEGIN
  RETURN QUERY WITH ExportedContacts AS (
    SELECT
      pr.email as source_col,
      p.email as email_col,
      p.name as name_col,
      p.status as status_col,
      rp.recency as recency_col,
      rp.seniority as seniority_col,
      rp.occurrence as occurrence_col,
      rp.sender as sender_col,
      rp.recipient as recipient_col,
      rp.conversations as conversations_col,
      rp.replied_conversations as replied_conversations_col,
      rp.tags as tags_col,
      ROW_NUMBER() OVER (
        PARTITION BY p.email
        ORDER BY rp.recency DESC
      ) AS rn
    FROM
      persons p
    INNER JOIN
      refinedpersons rp ON rp.email = p.email
    INNER JOIN
      public.profiles pr ON pr.user_id = p.user_id
    WHERE
      p.user_id = get_contacts_table.userid
  )
  SELECT
    source_col AS source,
    email_col AS email,
    name_col AS name,
    status_col AS status,
    recency_col AS recency,
    seniority_col AS seniority,
    occurrence_col AS occurrence,
    sender_col AS sender,
    recipient_col AS recipient,
    conversations_col AS conversations,
    replied_conversations_col AS replied_conversations,
    tags_col AS tags
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_contacts_table_by_emails(userid uuid, emails TEXT []) RETURNS TABLE (
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
  tags TEXT []
) AS $$
BEGIN
  RETURN QUERY WITH ExportedContacts AS (
    SELECT
      pr.email as source_col,
      p.email as email_col,
      p.name as name_col,
      p.status as status_col,
      rp.recency as recency_col,
      rp.seniority as seniority_col,
      rp.occurrence as occurrence_col,
      rp.sender as sender_col,
      rp.recipient as recipient_col,
      rp.conversations as conversations_col,
      rp.replied_conversations as replied_conversations_col,
      rp.tags as tags_col,
      ROW_NUMBER() OVER (
        PARTITION BY p.email
        ORDER BY rp.recency DESC
      ) AS rn
    FROM
      persons p
    INNER JOIN
      refinedpersons rp ON rp.email = p.email
    INNER JOIN
      public.profiles pr ON pr.user_id = p.user_id
    WHERE
      p.user_id = get_contacts_table_by_emails.userid
    AND
      p.email = ANY(get_contacts_table_by_emails.emails)
  )
  SELECT
    source_col AS source,
    email_col AS email,
    name_col AS name,
    status_col AS status,
    recency_col AS recency,
    seniority_col AS seniority,
    occurrence_col AS occurrence,
    sender_col AS sender,
    recipient_col AS recipient,
    conversations_col AS conversations,
    replied_conversations_col AS replied_conversations,
    tags_col AS tags
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$ LANGUAGE plpgsql;
