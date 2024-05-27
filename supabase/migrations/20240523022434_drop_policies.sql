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
