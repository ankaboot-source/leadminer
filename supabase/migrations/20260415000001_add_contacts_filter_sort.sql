-- Pagination with proper sorting using ROW_NUMBER

DROP FUNCTION IF EXISTS private.get_contacts_page(uuid, integer, integer, text, text, text);
CREATE FUNCTION private.get_contacts_page(
  user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL, p_sort_field text DEFAULT NULL, p_sort_order text DEFAULT 'DESC'
)
RETURNS TABLE(
  source text, email text, name text, status text, consent_status private.contact_consent_status,
  consent_changed_at timestamptz, image text, location text, location_normalized jsonb,
  alternate_name text[], alternate_email text[], telephone text[], same_as text[],
  given_name text, family_name text, job_title text, works_for text,
  recency timestamptz, seniority timestamptz, occurrence integer, temperature integer,
  sender integer, recipient integer, conversations integer, replied_conversations integer,
  tags text[], updated_at timestamptz, created_at timestamptz, mining_id text
)
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT 
        per.source AS src, per.email AS eml, per.name AS nam, per.status AS sta, per.consent_status AS cstat, per.consent_changed_at AS cchanged,
        per.image AS img, per.location AS loc, per.location_normalized AS locnorm, per.alternate_name AS altname, per.alternate_email AS altemail,
        per.telephone AS tel, per.same_as AS sameas, per.given_name AS gname, per.family_name AS fname, per.job_title AS job,
        COALESCE(org.name, '') AS work_for,
        ref.recency AS rec, ref.seniority AS sen, ref.occurrence AS occ, ref.temperature AS temp,
        ref.sender AS snd, ref.recipient AS rcv, ref.conversations AS conv, ref.replied_conversations AS repl,
        ref.tags AS tag,
        per.updated_at::timestamptz AS upd, per.created_at::timestamptz AS crt, per.mining_id AS mid,
        ROW_NUMBER() OVER (PARTITION BY per.email ORDER BY 
          CASE WHEN p_sort_field = 'temperature' AND p_sort_order = 'ASC' THEN ref.temperature END ASC NULLS FIRST,
          CASE WHEN p_sort_field = 'temperature' THEN ref.temperature END DESC
        ) AS email_rank,
        ROW_NUMBER() OVER (ORDER BY 
          CASE WHEN p_sort_field = 'temperature' AND p_sort_order = 'ASC' THEN COALESCE(ref.temperature, 0) END ASC,
          CASE WHEN p_sort_field = 'temperature' THEN COALESCE(ref.temperature, 0) END DESC,
          CASE WHEN p_sort_field = 'occurrence' AND p_sort_order = 'ASC' THEN COALESCE(ref.occurrence, 0) END ASC,
          CASE WHEN p_sort_field = 'occurrence' THEN COALESCE(ref.occurrence, 0) END DESC,
          CASE WHEN p_sort_field = 'recency' AND p_sort_order = 'ASC' THEN COALESCE(ref.recency, '1970-01-01'::timestamptz) END ASC,
          CASE WHEN p_sort_field = 'recency' THEN COALESCE(ref.recency, '1970-01-01'::timestamptz) END DESC,
          CASE WHEN p_sort_field = 'conversations' AND p_sort_order = 'ASC' THEN COALESCE(ref.conversations, 0) END ASC,
          CASE WHEN p_sort_field = 'conversations' THEN COALESCE(ref.conversations, 0) END DESC,
          CASE WHEN p_sort_field = 'replied_conversations' AND p_sort_order = 'ASC' THEN COALESCE(ref.replied_conversations, 0) END ASC,
          CASE WHEN p_sort_field = 'replied_conversations' THEN COALESCE(ref.replied_conversations, 0) END DESC,
          CASE WHEN p_sort_field = 'sender' AND p_sort_order = 'ASC' THEN COALESCE(ref.sender, 0) END ASC,
          CASE WHEN p_sort_field = 'sender' THEN COALESCE(ref.sender, 0) END DESC,
          CASE WHEN p_sort_field = 'recipient' AND p_sort_order = 'ASC' THEN COALESCE(ref.recipient, 0) END ASC,
          CASE WHEN p_sort_field = 'recipient' THEN COALESCE(ref.recipient, 0) END DESC,
          CASE WHEN p_sort_field = 'seniority' AND p_sort_order = 'ASC' THEN COALESCE(ref.seniority, '1970-01-01'::timestamptz) END ASC,
          CASE WHEN p_sort_field = 'seniority' THEN COALESCE(ref.seniority, '1970-01-01'::timestamptz) END DESC,
          CASE WHEN p_sort_field = 'location' AND p_sort_order = 'ASC' THEN per.location END ASC NULLS LAST,
          CASE WHEN p_sort_field = 'location' THEN per.location END DESC NULLS LAST,
          CASE WHEN p_sort_field = 'works_for' AND p_sort_order = 'ASC' THEN org.name END ASC NULLS LAST,
          CASE WHEN p_sort_field = 'works_for' THEN org.name END DESC NULLS LAST,
          CASE WHEN p_sort_field = 'name' AND p_sort_order = 'ASC' THEN per.name END ASC NULLS LAST,
          CASE WHEN p_sort_field = 'name' THEN per.name END DESC NULLS LAST,
          CASE WHEN p_sort_field = 'email' AND p_sort_order = 'ASC' THEN per.email END ASC,
          CASE WHEN p_sort_field = 'email' THEN per.email END DESC,
          ref.temperature DESC, per.email DESC
        ) AS sort_rank
    FROM private.persons per
    INNER JOIN private.refinedpersons ref ON ref.email = per.email AND ref.user_id = per.user_id
    LEFT JOIN private.organizations org ON org.id = per.works_for
    WHERE per.user_id = get_contacts_page.user_id
      AND (p_search IS NULL OR per.email ILIKE '%' || p_search || '%' OR per.name ILIKE '%' || p_search || '%')
  )
  SELECT src, eml, nam, sta, cstat, cchanged, img, loc, locnorm, altname, altemail, tel, sameas, gname, fname, job, work_for,
      rec, sen, occ, temp, snd, rcv, conv, repl, tag, upd, crt, mid
  FROM ranked
  WHERE email_rank = 1
  ORDER BY sort_rank
  LIMIT p_limit OFFSET p_offset;
END;
$$;

DROP FUNCTION IF EXISTS private.get_contacts_count(uuid, text);
CREATE FUNCTION private.get_contacts_count(user_id uuid, p_search text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE cnt integer;
BEGIN
  SELECT COUNT(DISTINCT p.email)::integer INTO cnt FROM private.persons p
  WHERE p.user_id = get_contacts_count.user_id
    AND (p_search IS NULL OR p.email ILIKE '%' || p_search || '%' OR p.name ILIKE '%' || p_search || '%');
  RETURN COALESCE(cnt, 0);
END;
$$;