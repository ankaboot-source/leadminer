alter table "public"."persons" alter column "status" drop default;
alter table "public"."persons" alter column "status" drop not null;

