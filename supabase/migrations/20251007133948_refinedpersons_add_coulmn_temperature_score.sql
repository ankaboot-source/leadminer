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
    CASE WHEN recency_ts  IS NULL THEN NULL
         ELSE EXTRACT(EPOCH FROM (ref_ts - recency_ts)) / 86400.0 END  AS rec_days,
    CASE WHEN seniority_ts IS NULL THEN NULL
         ELSE EXTRACT(EPOCH FROM (ref_ts - seniority_ts)) / 86400.0 END AS age_days
),
norms AS (
  SELECT
    (1 - EXP(-b.s / p.k_send))                       AS send_norm,
    (1 - EXP(-b.r / p.k_recv))                       AS recv_norm,
    (1 - EXP(-b.rep / p.k_rep))                      AS rep_norm,
    -- récence avec plancher 0.30 pour ne pas “punir” trop fort les anciens
    COALESCE(0.30 + 0.70 * EXP(-b.rec_days / p.k_rec_days), 0.30)   AS rec_norm,
    COALESCE(1 - EXP(-b.age_days / p.k_age_days), 0) AS age_norm,
    b.conv AS conv, b.rep AS rep
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