-- Creates a profiles table on the public schema to expose, manage users data
-- https://supabase.com/docs/guides/auth/managing-user-data#creating-user-tables

create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  credits integer default 1500,
  stripe_customer_id text,
  
  primary key (id)
);

-- Enable RLS
alter table public.profiles enable row level security;
create policy "Users can view their own data."
  on profiles for select
  using ( auth.uid() = id );
create policy "Users can update their own data."
  on profiles for update
  using ( auth.uid() = id );

-- Inserts a row into public.profiles
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Check if the user exists in public.profiles
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.profiles
    SET email = NEW.email
    WHERE id = NEW.id;
  END IF;
  return new;
end;
$$;

-- Trigger the function every time a user is created
create trigger on_auth_user_created_updated
  after INSERT OR UPDATE on auth.users
  for each row execute procedure public.handle_new_user();

