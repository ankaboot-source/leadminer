-- 1. Create ENUM type for notification types
create type notification_type as enum ('enrich', 'clean', 'extract', 'signature');

-- 2. Create notifications table
create table "private".notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  type notification_type not null,
  details jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  primary key (user_id, id)
);

-- 3. Auto-update updated_at on row updates
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
before update on "private".notifications
for each row
execute procedure update_updated_at_column();

-- 4. Enable Row-Level Security (RLS)
alter table "private".notifications enable row level security;

-- 5. Add RLS policy for read-only access (own rows)
create policy "Read own notifications"
on "private".notifications
for select
using (auth.uid() = user_id);

-- 6. Enable Supabase Realtime for the table
-- This assumes the 'supabase_realtime' publication is being used
alter publication supabase_realtime add table "private".notifications;
