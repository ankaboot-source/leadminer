-- Create "get_contacts_table_by_emails" function
CREATE FUNCTION public.update_email_in_profile_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = new.email
  WHERE user_id = new.id;
  RETURN NEW;
END;
$$;

-- Trigger the function every time a user is created
create trigger update_email_in_profile_table_trigger
after UPDATE on auth.users
execute procedure public.update_email_in_profile_table();
