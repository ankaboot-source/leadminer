create table private.signatures (
  user_id uuid not null references auth.users(id) on delete cascade,
  person_email text not null,
  message_id text not null,
  raw_signature text not null,
  extracted_signature jsonb not null,
  details jsonb not null,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  primary key (user_id, person_email)
);

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
before update on "private".signatures
for each row
execute procedure update_updated_at_column();

alter table private.signatures enable row level security;
