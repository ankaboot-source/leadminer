-- This migration removes partitioning from the 'refinedpersons' table 
-- that was introduced in the previous migration.
-- Reason: Realtime does not work on partitioned tables.

DROP TABLE "public"."refinedpersons" CASCADE;

CREATE TABLE "public"."refinedpersons" (
    "userid" uuid,
    "engagement" integer,
    "occurence" integer,
    "tags" text[],
    "name" text,
    "alternate_names" text[],
    "email" text,
    "recency" timestamp with time zone,
    PRIMARY KEY (email, userid)
    );

ALTER PUBLICATION supabase_realtime
ADD TABLE public.refinedpersons; -- Enable realtime
