alter table "public"."messages_0" enable row level security;

alter table "public"."messages_1" enable row level security;

alter table "public"."messages_2" enable row level security;

alter table "public"."pointsofcontact_0" enable row level security;

alter table "public"."pointsofcontact_1" enable row level security;

alter table "public"."pointsofcontact_2" enable row level security;

alter table "public"."tags_0" enable row level security;

alter table "public"."tags_1" enable row level security;

alter table "public"."tags_2" enable row level security;

drop policy if exists "Enable select for users based on user_id"
on "public"."messages";

drop policy if exists "Enable select for users based on user_id"
on "public"."persons";

drop policy if exists "Enable select for users based on user_id"
on "public"."pointsofcontact";

drop policy if exists "Allow all operations for authenticated users on their own data"
on "public"."refinedpersons";

drop policy if exists "Enable select for users based on user_id"
on "public"."tags";

drop policy if exists "Users can view their own data"
on profiles;

drop policy if exists "Users can update their own data"
on profiles;

create policy "Users can view their own data"
on "public"."profiles"
as permissive
for select
to public
using ((select auth.uid()) = user_id);

create policy "Users can update their own data"
on "public"."profiles"
as permissive
for update
to public
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Enable select for users based on user_id"
on "public"."messages"
as permissive
for select
to public
using ((select auth.uid()) = user_id);

create policy "Enable select for users based on user_id"
on "public"."pointsofcontact"
as permissive
for select
to public
using ((select auth.uid()) = user_id);

create policy "Enable select for users based on user_id"
on "public"."tags"
as permissive
for select
to public
using ((select auth.uid()) = user_id);

create policy "Enable select for users based on user_id"
on "public"."persons"
as permissive
for select
to public
using ((select auth.uid()) = user_id);

create policy "Enable update for users based on user_id"
on "public"."persons"
as permissive
for update
to public
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Allow all operations for authenticated users on their own data"
on "public"."refinedpersons"
as permissive
for all
to public
using ((select auth.uid()) = userid)
with check ((select auth.uid()) = userid);
