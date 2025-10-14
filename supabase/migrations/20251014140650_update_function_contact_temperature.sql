-- =============================================================================
-- MAKE A SCORE OF 100 HARDER TO ACHIEVE
-- =============================================================================
-- 
-- 1. HIGHER SATURATION POINTS (require more activity):
--    - Sent/Received messages: 8 → 12 messages for "active" status
--    - Replied conversations: 3 → 5 conversations to be considered "responsive"
-- 
-- 2. STRICTER TIME DECAY (penalize inactivity more):
--    - Recency half-life: 8 months → 6 months (recent activity matters more)
--    - Seniority half-life: 1 year → 9 months (relationships mature faster)
-- 
-- 3. NEW MINIMUM REQUIREMENTS FOR HIGH SCORES (must meet all):
--    - At least 3 total conversations (was implicit)
--    - At least 2 replied conversations (was 1)
--    - At least 30 days of relationship history (new requirement)
-- 
-- 4. REDUCED BONUSES (harder to get extra points):
--    - Reply bonus: 0.10 → 0.05 (requires 2+ replies now)
--    - Synergy bonus: 0.10 → 0.05 (smaller boost for long-term repliers)
-- 
-- 5. TIGHTER SCORE CAPPING (prevent easy max scores):
--    - No-reply contacts: Capped at 70 (was 80)
--    - Non-qualifying contacts: Capped at 90 (new restriction)
--    - Diminishing returns above 95 raw score
-- 
-- 6. REBALANCED WEIGHTS (changed priorities):
--    - Replies: 45% → 40% (still most important but slightly reduced)
--    - Volume: 30% → 25% (raw activity matters less)
--    - Recency: 5% → 10% (recent activity matters more)
--    - Seniority: 20% → 25% (relationship length matters more)
-- =============================================================================

CREATE OR REPLACE FUNCTION private.contact_temperature(
  sender_cnt            integer,       -- How many times this person sent messages
  recipient_cnt         integer,       -- How many times this person received messages
  conversations_cnt     integer,       -- Total number of conversations
  replied_conversations integer,       -- How many conversations had replies (back-and-forth)
  recency_ts            timestamptz,   -- When was the last interaction
  seniority_ts          timestamptz,   -- When did the relationship start
  ref_ts                timestamptz DEFAULT now()  -- Reference date for calculations
) RETURNS integer
LANGUAGE sql
STABLE
AS $$
-- This function calculates a relationship "temperature" score (0-100)
-- Higher scores mean stronger, more active relationships
-- Score of 100 should be rare - requires high activity, replies, and long-term engagement

WITH config AS (
  -- Tuning parameters - made stricter to make 100 harder to achieve
  SELECT
    -- SATURATION POINTS: Increased to require more activity for high scores
    12.0::double precision   AS saturation_send,      -- Was 8, now 12 sent messages for "active sender"
    12.0::double precision   AS saturation_recv,      -- Was 8, now 12 received messages  
    5.0::double precision    AS saturation_replies,   -- Was 3, now 5 replied conversations for "good responder"
    
    -- TIME DECAY: Made more aggressive to penalize inactivity more
    180.0::double precision  AS recency_half_life,    -- Was 240, now 6 months for recency decay
    270.0::double precision  AS seniority_half_life,  -- Was 365, now 9 months for relationship maturity
    
    -- WEIGHTS: Slightly rebalanced
    0.40::double precision   AS weight_replies,       -- Was 0.45, still most important but slightly reduced
    0.25::double precision   AS weight_volume,        -- Was 0.30, volume matters less
    0.10::double precision   AS weight_recency,       -- Was 0.05, recency matters more now
    0.25::double precision   AS weight_seniority,     -- Was 0.20, seniority matters more
    
    -- MIXING: Slightly adjusted
    0.55::double precision   AS send_receive_ratio,   -- Was 0.60, more balanced
    
    -- NEW: Minimum thresholds to qualify for high scores
    3 AS min_conversations_for_high_score,            -- Need at least 3 conversations
    2 AS min_replies_for_high_score,                  -- Need at least 2 replied conversations
    30 AS min_days_relationship_for_high_score        -- Need at least 30 days of relationship
),

-- STEP 1: Clean and prepare the input data
prepared_data AS (
  SELECT
    -- Ensure counts are not negative
    GREATEST(COALESCE(sender_cnt,0),0)::double precision            AS sent_count,
    GREATEST(COALESCE(recipient_cnt,0),0)::double precision         AS received_count,
    GREATEST(COALESCE(conversations_cnt,0),0)::double precision     AS total_conversations,
    GREATEST(COALESCE(replied_conversations,0),0)::double precision AS replied_conversations,
    
    -- Calculate days since last interaction (recency)
    CASE WHEN recency_ts IS NULL THEN NULL
         ELSE GREATEST(EXTRACT(EPOCH FROM (ref_ts - recency_ts)) / 86400.0, 0) 
    END AS days_since_last_contact,
    
    -- Calculate relationship age in days
    CASE WHEN seniority_ts IS NULL THEN NULL
         ELSE GREATEST(EXTRACT(EPOCH FROM (ref_ts - seniority_ts)) / 86400.0, 0) 
    END AS relationship_age_days
),

-- STEP 2: Normalize all values to 0-1 scale using saturation curves
normalized_scores AS (
  SELECT
    -- Message volume saturation: higher thresholds make it harder to max out
    (1 - EXP(GREATEST(-d.sent_count / c.saturation_send, -100)))     AS sent_score,
    (1 - EXP(GREATEST(-d.received_count / c.saturation_recv, -100))) AS received_score,
    
    -- Reply saturation: harder to reach maximum
    (1 - EXP(GREATEST(-d.replied_conversations / c.saturation_replies, -100))) AS reply_volume_score,
    
    -- Recency: steeper decay, less floor protection
    COALESCE(0.20 + 0.80 * EXP(GREATEST(-d.days_since_last_contact / c.recency_half_life, -100)), 0.20) AS recency_score,
    
    -- Seniority: harder to max out relationship age bonus
    COALESCE(1 - EXP(GREATEST(-d.relationship_age_days / c.seniority_half_life, -100)), 0) AS seniority_score,
    
    -- Raw counts for later calculations
    d.total_conversations,
    d.replied_conversations,
    d.relationship_age_days,
    d.sent_count,
    d.received_count
    
  FROM prepared_data d
  CROSS JOIN config c
),

-- STEP 3: Calculate individual score components with weights
score_components AS (
  SELECT
    -- VOLUME COMPONENT: Mix of sending and receiving activity
    c.weight_volume * (
      c.send_receive_ratio * n.sent_score + 
      (1 - c.send_receive_ratio) * n.received_score
    ) AS volume_score,
    
    -- REPLY COMPONENT: Harder to max out
    c.weight_replies * (
      0.7 * n.reply_volume_score +  -- Was 0.6, now more weight on volume
      0.3 * (CASE WHEN n.total_conversations > 0 THEN n.replied_conversations / n.total_conversations ELSE 0 END)  -- Was 0.4, now less on rate
    ) AS reply_score,
    
    -- RECENCY COMPONENT: More important now
    c.weight_recency * n.recency_score AS recency_score,
    
    -- SENIORITY COMPONENT: More important now
    c.weight_seniority * n.seniority_score AS seniority_score,
    
    -- BONUSES: Reduced and harder to get
    CASE WHEN n.replied_conversations >= 2 THEN 0.05 ELSE 0 END AS reply_bonus,  -- Was 0.10, now requires 2+ replies
    
    -- SYNERGY BONUS: Reduced and requires more
    CASE WHEN n.replied_conversations >= 2 THEN 0.05 * n.reply_volume_score * n.seniority_score ELSE 0 END AS long_term_reply_bonus,
    
    -- NEW: High score eligibility check
    CASE WHEN 
      n.total_conversations >= c.min_conversations_for_high_score AND
      n.replied_conversations >= c.min_replies_for_high_score AND
      n.relationship_age_days >= c.min_days_relationship_for_high_score
    THEN 1 ELSE 0 END AS qualifies_for_high_score,
    
    n.replied_conversations AS has_replies,
    n.total_conversations,
    n.relationship_age_days
    
  FROM normalized_scores n
  CROSS JOIN config c
),

-- STEP 4: Combine all scores and apply business rules
combined_score AS (
  SELECT 
    (volume_score + reply_score + recency_score + seniority_score + reply_bonus + long_term_reply_bonus) AS raw_score,
    has_replies,
    qualifies_for_high_score,
    total_conversations,
    relationship_age_days
  FROM score_components
),

-- STEP 5: Apply final adjustments and convert to 0-100 scale
final_score AS (
  SELECT
    -- Apply multiple restrictions to make 100 very hard to achieve
    LEAST(
      1.0,
      GREATEST(
        0.0,
        CASE 
          -- No replies? Hard cap at 70 (was 80)
          WHEN has_replies = 0 THEN LEAST(raw_score, 0.70)
          
          -- Doesn't qualify for high score? Cap at 90
          WHEN qualifies_for_high_score = 0 THEN LEAST(raw_score, 0.90)
          
          -- Qualifies but raw score too high? Apply scaling
          WHEN raw_score > 0.95 THEN 0.95 + (raw_score - 0.95) * 0.5  -- Diminishing returns above 95
          
          -- Good to go
          ELSE raw_score
        END
      )
    ) AS final_score_0_to_1,
    
    -- Debug info (you can remove this in production)
    raw_score AS debug_raw_score,
    qualifies_for_high_score AS debug_qualifies
    
  FROM combined_score
)

-- Convert to 0-100 integer and return
SELECT ROUND(100 * final_score_0_to_1)::int AS contact_temperature
FROM final_score;
$$;


-- Update existing records
UPDATE private.refinedpersons 
SET temperature = private.contact_temperature(
  sender, recipient, conversations, replied_conversations, recency, seniority, now()
);
