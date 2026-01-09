ALTER TABLE private.engagement DROP CONSTRAINT engagement_pkey;
ALTER TABLE private.engagement ADD COLUMN service TEXT;

UPDATE private.engagement
SET service = CASE 
    WHEN engagement_type::text = 'ENRICH' THEN 'thedig'
    WHEN engagement_type::text = 'CSV' THEN 'csv'
END;


ALTER TYPE private.engagement_type_enum RENAME TO engagement_type_enum_old;

CREATE TYPE private.engagement_type_enum AS ENUM ('EXPORT', 'ENRICH');

ALTER TABLE private.engagement 
  ALTER COLUMN engagement_type TYPE private.engagement_type_enum 
  USING (
    CASE 
      WHEN engagement_type::text = 'CSV' THEN 'EXPORT'::private.engagement_type_enum
      ELSE engagement_type::text::private.engagement_type_enum
    END
  );

DROP TYPE private.engagement_type_enum_old;

ALTER TABLE private.engagement ALTER COLUMN service SET NOT NULL;
ALTER TABLE private.engagement 
ADD CONSTRAINT engagement_pkey PRIMARY KEY (email, user_id, engagement_type, service);