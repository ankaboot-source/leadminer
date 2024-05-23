alter table "public"."messages_0" enable row level security;

alter table "public"."messages_1" enable row level security;

alter table "public"."messages_2" enable row level security;

alter table "public"."pointsofcontacts_0" enable row level security;

alter table "public"."pointsofcontacts_1" enable row level security;

alter table "public"."pointsofcontacts_2" enable row level security;

alter table "public"."tags_0" enable row level security;

alter table "public"."tags_1" enable row level security;

alter table "public"."tags_2" enable row level security;

create policy "Enable select for users based on user_id"
on "public"."messages_0"
as permissive
for select
to public
using ((auth.uid() = user_id));

create policy "Enable select for users based on user_id"
on "public"."messages_1"
as permissive
for select
to public
using ((auth.uid() = user_id));

create policy "Enable select for users based on user_id"
on "public"."messages_2"
as permissive
for select
to public
using ((auth.uid() = user_id));

create policy "Enable select for users based on user_id"
on "public"."pointsofcontacts_0"
as permissive
for select
to public
using ((auth.uid() = user_id));

create policy "Enable select for users based on user_id"
on "public"."pointsofcontacts_1"
as permissive
for select
to public
using ((auth.uid() = user_id));

create policy "Enable select for users based on user_id"
on "public"."pointsofcontacts_2"
as permissive
for select
to public
using ((auth.uid() = user_id));

create policy "Enable select for users based on user_id"
on "public"."tags_0"
as permissive
for select
to public
using ((auth.uid() = user_id));

create policy "Enable select for users based on user_id"
on "public"."tags_1"
as permissive
for select
to public
using ((auth.uid() = user_id));

create policy "Enable select for users based on user_id"
on "public"."tags_2"
as permissive
for select
to public
using ((auth.uid() = user_id));
