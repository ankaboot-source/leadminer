-- Pagination with proper sorting AND filtering using ROW_NUMBER

CREATE OR REPLACE FUNCTION private.get_contacts_page(
  user_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_sort_field text DEFAULT NULL,
  p_sort_order text DEFAULT 'DESC',
  p_status text[] DEFAULT NULL,
  p_consent_status text[] DEFAULT NULL,
  p_has_job_details boolean DEFAULT NULL,
  p_has_location boolean DEFAULT NULL,
  p_has_telephone boolean DEFAULT NULL,
  p_has_valid_email boolean DEFAULT NULL
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
          CASE WHEN p_sort_field = 'temperature' THEN COALESCE(ref.temperature, 0) END DESC
        ) AS email_rank,
        ROW_NUMBER() OVER (ORDER BY 
          CASE WHEN p_sort_field = 'temperature' AND p_sort_order = 'ASC' THEN COALESCE(ref.temperature, -1) END ASC,
          CASE WHEN p_sort_field = 'temperature' THEN COALESCE(ref.temperature, 0) END DESC,
          CASE WHEN p_sort_field = 'occurrence' AND p_sort_order = 'ASC' THEN COALESCE(ref.occurrence, -1) END ASC,
          CASE WHEN p_sort_field = 'occurrence' THEN COALESCE(ref.occurrence, 0) END DESC,
          CASE WHEN p_sort_field = 'recency' AND p_sort_order = 'ASC' THEN COALESCE(ref.recency, '1970-01-01'::timestamptz) END ASC,
          CASE WHEN p_sort_field = 'recency' THEN COALESCE(ref.recency, '1970-01-01'::timestamptz) END DESC,
          CASE WHEN p_sort_field = 'conversations' AND p_sort_order = 'ASC' THEN COALESCE(ref.conversations, -1) END ASC,
          CASE WHEN p_sort_field = 'conversations' THEN COALESCE(ref.conversations, 0) END DESC,
          CASE WHEN p_sort_field = 'replied_conversations' AND p_sort_order = 'ASC' THEN COALESCE(ref.replied_conversations, -1) END ASC,
          CASE WHEN p_sort_field = 'replied_conversations' THEN COALESCE(ref.replied_conversations, 0) END DESC,
          CASE WHEN p_sort_field = 'sender' AND p_sort_order = 'ASC' THEN COALESCE(ref.sender, -1) END ASC,
          CASE WHEN p_sort_field = 'sender' THEN COALESCE(ref.sender, 0) END DESC,
          CASE WHEN p_sort_field = 'recipient' AND p_sort_order = 'ASC' THEN COALESCE(ref.recipient, -1) END ASC,
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
      AND (
        p_status IS NULL OR 
        per.status = ANY(p_status) OR 
        (p_status && ARRAY['VALID', 'UNKNOWN'] AND (per.status IS NULL OR per.status = ''))
      )
      AND (p_consent_status IS NULL OR per.consent_status::text = ANY(p_consent_status))
      AND (p_has_job_details IS NULL OR 
           (p_has_job_details = TRUE AND (per.job_title IS NOT NULL AND per.job_title <> '' OR org.name IS NOT NULL)) OR
           (p_has_job_details = FALSE AND (per.job_title IS NULL OR per.job_title = '') AND org.name IS NULL))
      AND (p_has_location IS NULL OR 
           (p_has_location = TRUE AND per.location IS NOT NULL) OR
           (p_has_location = FALSE AND per.location IS NULL))
      AND (p_has_telephone IS NULL OR
           (p_has_telephone = TRUE AND per.telephone IS NOT NULL) OR
           (p_has_telephone = FALSE AND per.telephone IS NULL))
      AND (p_has_valid_email IS NULL OR
           (p_has_valid_email = TRUE AND per.email IS NOT NULL) OR
           (p_has_valid_email = FALSE AND per.email IS NULL))
  )
  SELECT src, eml, nam, sta, cstat, cchanged, img, loc, locnorm, altname, altemail, tel, sameas, gname, fname, job, work_for,
      rec, sen, occ, temp, snd, rcv, conv, repl, tag, upd, crt, mid
  FROM ranked
  WHERE email_rank = 1
  ORDER BY sort_rank
  LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_contacts_count(
  user_id uuid,
  p_search text DEFAULT NULL,
  p_status text[] DEFAULT NULL,
  p_consent_status text[] DEFAULT NULL,
  p_has_job_details boolean DEFAULT NULL,
  p_has_location boolean DEFAULT NULL,
  p_has_telephone boolean DEFAULT NULL,
  p_has_valid_email boolean DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE cnt integer;
BEGIN
  SELECT COUNT(DISTINCT per.email)::integer INTO cnt
  FROM private.persons per
  INNER JOIN private.refinedpersons ref ON ref.email = per.email AND ref.user_id = per.user_id
  LEFT JOIN private.organizations org ON org.id = per.works_for
  WHERE per.user_id = get_contacts_count.user_id
    AND (p_search IS NULL OR per.email ILIKE '%' || p_search || '%' OR per.name ILIKE '%' || p_search || '%')
    AND (
      p_status IS NULL OR 
      per.status = ANY(p_status) OR 
      (p_status && ARRAY['VALID', 'UNKNOWN'] AND (per.status IS NULL OR per.status = ''))
    )
    AND (p_consent_status IS NULL OR per.consent_status::text = ANY(p_consent_status))
    AND (p_has_job_details IS NULL OR 
         (p_has_job_details = TRUE AND (per.job_title IS NOT NULL AND per.job_title <> '' OR org.name IS NOT NULL)) OR
         (p_has_job_details = FALSE AND (per.job_title IS NULL OR per.job_title = '') AND org.name IS NULL))
    AND (p_has_location IS NULL OR 
         (p_has_location = TRUE AND per.location IS NOT NULL) OR
         (p_has_location = FALSE AND per.location IS NULL))
    AND (p_has_telephone IS NULL OR
         (p_has_telephone = TRUE AND per.telephone IS NOT NULL) OR
         (p_has_telephone = FALSE AND per.telephone IS NULL))
    AND (p_has_valid_email IS NULL OR
         (p_has_valid_email = TRUE AND per.email IS NOT NULL) OR
         (p_has_valid_email = FALSE AND per.email IS NULL));
  RETURN COALESCE(cnt, 0);
END;
$$;