alter table "public"."messages_0" enable row level security;

alter table "public"."messages_1" enable row level security;

alter table "public"."messages_2" enable row level security;

alter table "public"."pointsofcontact_0" enable row level security;

alter table "public"."pointsofcontact_1" enable row level security;

alter table "public"."pointsofcontact_2" enable row level security;

alter table "public"."tags_0" enable row level security;

alter table "public"."tags_1" enable row level security;

alter table "public"."tags_2" enable row level security;

drop policy "Enable select for users based on user_id"
on "public"."messages";

drop policy "Enable select for users based on user_id"
on "public"."persons";

drop policy "Enable select for users based on user_id"
on "public"."pointsofcontact";

drop policy "Allow all operations for authenticated users on their own data"
on "public"."refinedpersons";

drop policy "Enable select for users based on user_id"
on "public"."tags";

drop policy "Users can view their own data."
on profiles;

drop policy "Users can update their own data."
on profiles;

create policy "Users can view their own data"
on "public"."profiles"
as permissive
for select
to public
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can update their own data"
on "public"."profiles"
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
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
