alter table "public"."domains" enable row level security;

alter table "public"."messages" enable row level security;

alter table "public"."mining_sources" enable row level security;

alter table "public"."organizations" enable row level security;

alter table "public"."persons" enable row level security;

alter table "public"."pointsofcontact" enable row level security;

alter table "public"."refinedpersons" enable row level security;

alter table "public"."tags" enable row level security;

create policy "Enable select for users based on user_id"
on "public"."messages"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Enable select for users based on user_id"
on "public"."persons"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Enable select for users based on user_id"
on "public"."pointsofcontact"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Allow all operations for authenticated users on their own data"
on "public"."refinedpersons"
as permissive
for all
to public
using ((auth.uid() = userid))
with check ((auth.uid() = userid));


create policy "Enable select for users based on user_id"
on "public"."tags"
as permissive
for select
to public
using ((auth.uid() = user_id));
