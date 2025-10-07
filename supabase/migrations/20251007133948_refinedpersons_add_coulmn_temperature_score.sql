ALTER TABLE private.refinedpersons ADD COLUMN temperature integer;

CREATE OR REPLACE FUNCTION private.contact_temperature(
  sender_cnt            integer,
  recipient_cnt         integer,
  conversations_cnt     integer,
  replied_conversations integer,
  recency_ts            timestamptz,
  seniority_ts          timestamptz,
  ref_ts                timestamptz DEFAULT now()
) RETURNS integer
LANGUAGE sql
STABLE
AS $$
WITH params AS (
  SELECT
    8.0::double precision    AS k_send,      -- demi-saturation occurrences "sender"
    8.0::double precision    AS k_recv,      -- demi-saturation occurrences "recipient"
    3.0::double precision    AS k_rep,       -- demi-saturation nb conv. répondues
    240.0::double precision  AS k_rec_days,  -- récence douce (~8 mois)
    365.0::double precision  AS k_age_days,  -- ancienneté (~1 an)
    0.45::double precision   AS w_rep,       -- réponses (priorité #1)
    0.30::double precision   AS w_occ,       -- volume occ. (priorité #2)
    0.05::double precision   AS w_rec,       -- récence (faible)
    0.20::double precision   AS w_age,       -- ancienneté (renforcée)
    0.60::double precision   AS a_send       -- mix occ: 60% sender / 40% recipient
),
base AS (
  SELECT
    GREATEST(COALESCE(sender_cnt,0),0)::double precision            AS s,
    GREATEST(COALESCE(recipient_cnt,0),0)::double precision         AS r,
    GREATEST(COALESCE(conversations_cnt,0),0)::double precision     AS conv,
    GREATEST(COALESCE(replied_conversations,0),0)::double precision AS rep,
    -- Handle negative recency (future dates) by using absolute value
    CASE WHEN recency_ts  IS NULL THEN NULL
         ELSE GREATEST(EXTRACT(EPOCH FROM (ref_ts - recency_ts)) / 86400.0, 0) END  AS rec_days,
    -- Handle negative seniority (future dates) by using absolute value  
    CASE WHEN seniority_ts IS NULL THEN NULL
         ELSE GREATEST(EXTRACT(EPOCH FROM (ref_ts - seniority_ts)) / 86400.0, 0) END AS age_days
),
norms AS (
  SELECT
    -- Ensure we don't get negative values in EXP
    (1 - EXP(GREATEST(-b.s / p.k_send, -100)))                       AS send_norm,
    (1 - EXP(GREATEST(-b.r / p.k_recv, -100)))                       AS recv_norm,
    (1 - EXP(GREATEST(-b.rep / p.k_rep, -100)))                      AS rep_norm,
    -- récence avec plancher 0.30 pour ne pas "punir" trop fort les anciens
    COALESCE(0.30 + 0.70 * EXP(GREATEST(-b.rec_days / p.k_rec_days, -100)), 0.30)   AS rec_norm,
    COALESCE(1 - EXP(GREATEST(-b.age_days / p.k_age_days, -100)), 0) AS age_norm,
    b.conv AS conv, 
    b.rep AS rep
  FROM base b
  CROSS JOIN params p
),
blocks AS (
  SELECT
    -- Occurrences (mix sender/recipient)
    p.w_occ * (p.a_send * n.send_norm + (1 - p.a_send) * n.recv_norm) AS occ_block,
    -- Réponses = 60% volume (rep_norm) + 40% taux (rep/conv)
    p.w_rep * (0.6 * n.rep_norm + 0.4 * (CASE WHEN n.conv > 0 THEN n.rep / n.conv ELSE 0 END)) AS rep_block,
    -- Récence (faible poids, plancher intégré plus haut)
    p.w_rec * n.rec_norm AS rec_block,
    -- Ancienneté (renforcée)
    p.w_age * n.age_norm AS age_block,
    -- Boost: au moins une réponse
    CASE WHEN n.rep >= 1 THEN 0.10 ELSE 0 END AS reply_boost,
    -- Nouvelle synergie: réponses × ancienneté (soutient les relations longues)
    CASE WHEN n.rep >= 1 THEN 0.10 * n.rep_norm * n.age_norm ELSE 0 END AS synergy_boost,
    n.rep AS rep
  FROM norms n
  CROSS JOIN params p
),
total AS (
  SELECT (occ_block + rep_block + rec_block + age_block + reply_boost + synergy_boost) AS raw_score_0_1,
         rep
  FROM blocks
),
clamped AS (
  SELECT
    LEAST(
      1.0,
      GREATEST(
        0.0,
        CASE WHEN rep = 0 THEN LEAST(raw_score_0_1, 0.80) ELSE raw_score_0_1 END
      )
    ) AS score_0_1
  FROM total
)
SELECT ROUND(100 * score_0_1)::int
FROM clamped;
$$;

-- 2) Trigger function : alimente NEW.temperature automatiquement
CREATE OR REPLACE FUNCTION private.trg_set_contact_temperature()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.temperature :=
    private.contact_temperature(
      NEW.sender,
      NEW.recipient,
      NEW.conversations,
      NEW.replied_conversations,
      NEW.recency,
      NEW.seniority,
      now()
    );

  RETURN NEW;
END;
$$;

-- 3) Trigger : recalcul avant insert/update des champs éligibles
DROP TRIGGER IF EXISTS set_contact_temperature ON private.refinedpersons;
CREATE TRIGGER set_contact_temperature
BEFORE INSERT OR UPDATE OF
  sender, recipient, conversations, replied_conversations, recency, seniority
ON private.refinedpersons
FOR EACH ROW
EXECUTE FUNCTION private.trg_set_contact_temperature();

-- Update existing records
UPDATE private.refinedpersons 
SET temperature = private.contact_temperature(
  sender, recipient, conversations, replied_conversations, recency, seniority, now()
);


-- Update get_contacts

DROP FUNCTION private.get_contacts_table;
CREATE FUNCTION private.get_contacts_table(user_id uuid) RETURNS TABLE(source text, email text, name text, status text, image text, location text[], alternate_name text[], alternate_email text[], telephone text[], same_as text[], given_name text, family_name text, job_title text, works_for text, recency timestamptz, seniority timestamptz, occurrence integer, temperature integer, sender integer, recipient integer, conversations integer, replied_conversations integer, tags text[], updated_at timestamptz, created_at timestamptz)
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
BEGIN
  RETURN QUERY WITH ExportedContacts AS (
    SELECT
      p.source as source_col,
      p.email as email_col,
      p.name as name_col,
      p.status as status_col,
      p.image as image_col,
      p.location as location_col,
      p.alternate_name as alternate_name_col,
      p.alternate_email as alternate_email_col,
      p.telephone as telephone_col,
      p.same_as as same_as_col,
      p.given_name as given_name_col,
      p.family_name as family_name_col,
      p.job_title as job_title_col,
      o.name as works_for_col,
      rp.recency as recency_col,
      rp.seniority as seniority_col,
      rp.occurrence as occurrence_col,
      rp.temperature as temperature_col,
      rp.sender as sender_col,
      rp.recipient as recipient_col,
      rp.conversations as conversations_col,
      rp.replied_conversations as replied_conversations_col,
      rp.tags as tags_col,
      p.updated_at as updated_at_col,
      p.created_at as created_at_col,
      ROW_NUMBER() OVER (
        PARTITION BY p.email
      ) AS rn
    FROM
      private.persons p
    INNER JOIN
      private.refinedpersons rp ON rp.email = p.email
    LEFT JOIN
      private.organizations o ON o.id = p.works_for
    WHERE
      p.user_id = get_contacts_table.user_id
    ORDER BY 
      rp.temperature DESC, rp.occurrence DESC, rp.recency DESC
	  )
  SELECT
    source_col AS source,
    email_col AS email,
    name_col AS name,
    status_col AS status,
    image_col as image,
    location_col as location,
    alternate_name_col as alternate_name,
    alternate_email_col as alternate_email,
    telephone_col as telephone,
    same_as_col as same_as,
    given_name_col as given_name,
    family_name_col as family_name,
    job_title_col as job_title,
    works_for_col as works_for,
    recency_col AS recency,
    seniority_col AS seniority,
    occurrence_col AS occurrence,
	temperature_col AS temperature,
    sender_col AS sender,
    recipient_col AS recipient,
    conversations_col AS conversations,
    replied_conversations_col AS replied_conversations,
    tags_col AS tags,
	updated_at_col AS updated_at,
	created_at_col AS created_at
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$;

DROP FUNCTION private.get_contacts_table_by_emails;
CREATE FUNCTION private.get_contacts_table_by_emails(user_id uuid, emails text[]) RETURNS TABLE(source text, email text, name text, status text, image text, location text[], alternate_name text[], alternate_email text[], telephone text[], same_as text[], given_name text, family_name text, job_title text, works_for text, recency timestamptz, seniority timestamptz, occurrence integer, temperature integer, sender integer, recipient integer, conversations integer, replied_conversations integer, tags text[], updated_at timestamptz, created_at timestamptz)
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
BEGIN
  RETURN QUERY WITH ExportedContacts AS (
    SELECT
      p.source as source_col,
      p.email as email_col,
      p.name as name_col,
      p.status as status_col,
      p.image as image_col,
      p.location as location_col,
      p.alternate_name as alternate_name_col,
      P.alternate_email as alternate_email_col,
      p.telephone as telephone_col,
      p.same_as as same_as_col,
      p.given_name as given_name_col,
      p.family_name as family_name_col,
      p.job_title as job_title_col,
      o.name as works_for_col,
      rp.recency as recency_col,
      rp.seniority as seniority_col,
      rp.occurrence as occurrence_col,
      rp.temperature as temperature_col,
      rp.sender as sender_col,
      rp.recipient as recipient_col,
      rp.conversations as conversations_col,
      rp.replied_conversations as replied_conversations_col,
      rp.tags as tags_col,
      p.updated_at as updated_at_col,
      p.created_at as created_at_col,
      ROW_NUMBER() OVER (
      PARTITION BY p.email
      ) AS rn
    FROM
      private.persons p
    INNER JOIN
      private.refinedpersons rp ON rp.email = p.email
    LEFT JOIN
      private.organizations o ON o.id = p.works_for
    WHERE
      p.user_id = get_contacts_table_by_emails.user_id
    AND
      p.email = ANY(get_contacts_table_by_emails.emails)
	ORDER BY 
      rp.temperature DESC, rp.occurrence DESC, rp.recency DESC
  )
  SELECT
    source_col AS source,
    email_col AS email,
    name_col AS name,
    status_col AS status,
    image_col as image,
    location_col as location,
    alternate_name_col as alternate_name,
    alternate_email_col as alternate_email,
    telephone_col as telephone,
    same_as_col as same_as,
    given_name_col as given_name,
    family_name_col as family_name,
    job_title_col as job_title,
    works_for_col as works_for,
    recency_col AS recency,
    seniority_col AS seniority,
    temperature_col AS temperature,
    sender_col AS sender,
    recipient_col AS recipient,
    conversations_col AS conversations,
    replied_conversations_col AS replied_conversations,
    tags_col AS tags,
	updated_at_col AS updated_at,
	created_at_col AS created_at
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$;