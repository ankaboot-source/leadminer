-- Creates a profiles table on the public schema to expose, manage users data
-- https://supabase.com/docs/guides/auth/managing-user-data#creating-user-tables

create table public.profiles (
  user_id uuid not null references auth.users on delete cascade,
  full_name text,
  credits integer default 1500,
  stripe_customer_id text,
  
  primary key (user_id)
);

-- Enable RLS
alter table public.profiles enable row level security;
create policy "Users can view their own data."
  on profiles for select
  using ( auth.uid() = user_id );
create policy "Users can update their own data."
  on profiles for update
  using ( auth.uid() = user_id );

-- Inserts a row into public.profiles
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

-- Trigger the function every time a user is created
create trigger on_auth_user_created_updated
  after INSERT on auth.users
  for each row execute procedure public.handle_new_user();

