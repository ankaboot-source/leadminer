CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    claims JSONB;
    user_metadata JSONB;
    email_template_language JSONB;
BEGIN
    -- Extract claims from the event
    claims := event->'claims';
    claims := jsonb_build_object(
        'aud', claims->'aud',
        'exp', claims->'exp',
        'iat', claims->'iat',
        'sub', claims->'sub',
        'email', claims->'email',
        'phone', claims->'phone',
        'role', claims->'role',
        'aal', claims->'aal',
        'session_id', claims->'session_id',
        'is_anonymous', claims->'is_anonymous'
    );

    -- Check for user_metadata and update claims if EmailTemplate exists
    IF jsonb_typeof(event->'claims'->'user_metadata') IS NOT NULL THEN
        user_metadata := event->'claims'->'user_metadata';

        IF jsonb_typeof(user_metadata->'EmailTemplate') IS NOT NULL THEN
            email_template_language := jsonb_build_object(
                'language', user_metadata->'EmailTemplate'->'language'
            );
            user_metadata := jsonb_set('{}'::JSONB, '{EmailTemplate}', email_template_language);
            claims := jsonb_set(claims, '{user_metadata}', user_metadata);
        END IF;
    END IF;

    -- Update the event with modified claims and return it
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$;

grant execute
  on function public.custom_access_token_hook
  to supabase_auth_admin;

grant usage on schema public to supabase_auth_admin;
revoke execute
  on function public.custom_access_token_hook
  from authenticated, anon, public;