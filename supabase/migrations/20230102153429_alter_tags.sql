alter table "public"."tags" drop column "label";

alter table "public"."tags" drop column "type";

alter table "public"."tags" add column "source" text;