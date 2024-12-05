-- Remove the unnecessary columns from the persons table
create type status_enum as enum('VALID', 'RISKY', 'INVALID', 'UNKNOWN');

alter table public.persons
drop column if exists verification_details;

-- Create the email_status table
create table
  public.email_status (
    email text not null,
    user_id uuid not null,
    status status_enum not null,
    details JSONB null,
    verified_on timestamp without time zone not null,
    created_at timestamp without time zone not null default now(),
    updated_at timestamp without time zone not null default now(),
    constraint email_status_pkey primary key (email)
  );

-- Enable Row-Level Security (RLS) on email_status table
alter table public.email_status enable row level security;

CREATE POLICY "Enable select for users based on user_id" ON "public"."email_status" FOR
SELECT
  TO "authenticated" USING (
    (
      (
        SELECT
          "auth"."uid" () AS "uid"
      ) = "user_id"
    )
  );

CREATE FUNCTION update_person_status () RETURNS TRIGGER AS $$
BEGIN
  -- Update the status in the persons table
  UPDATE public.persons
  SET status = NEW.status
  WHERE email = NEW.email
    AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

CREATE TRIGGER update_persons_status_trigger
AFTER INSERT
OR
UPDATE ON email_status FOR EACH ROW
EXECUTE FUNCTION update_person_status ();

create trigger handle_updated_at_email_status before
update on public.email_status for each row
execute function extensions.moddatetime ('updated_at');
