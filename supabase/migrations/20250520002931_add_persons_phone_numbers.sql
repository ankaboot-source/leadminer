ALTER TABLE private.persons
    ADD COLUMN phone_numbers text[] NULL;

CREATE OR REPLACE FUNCTION private.enrich_contacts(p_contacts_data jsonb[], p_update_empty_fields_only boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
DECLARE
  contact_record JSONB;
  organization_id UUID;
  works_for_name TEXT;
  new_name TEXT;
  new_alternate_name TEXT[];
  old_name TEXT;
  old_alternate_name TEXT[];
  
  phone_number TEXT;
  new_phone_numbers TEXT[];
  old_phone_numbers TEXT[];
  merged_phone_numbers TEXT[];

BEGIN
  -- Assert that all records have email and user_id
  IF EXISTS (
    SELECT 1
    FROM unnest(p_contacts_data) AS contact
    WHERE contact->>'email' IS NULL OR contact->>'user_id' IS NULL
  ) THEN
    RAISE EXCEPTION 'All records in p_contacts_data must contain email and user_id fields';
  END IF;

  FOREACH contact_record IN ARRAY p_contacts_data
  LOOP
    
    
    works_for_name := contact_record->>'works_for';
    IF works_for_name IS NOT NULL THEN
      SELECT id INTO organization_id
      FROM private.organizations
      WHERE name = works_for_name
      LIMIT 1;
      
      IF NOT FOUND THEN
        INSERT INTO private.organizations (name)
        VALUES (works_for_name)
        RETURNING id INTO organization_id;
      END IF;
    ELSE
      organization_id := NULL;
    END IF;

    -- Merge incoming phone numbers into phone_numbers array
    new_phone_numbers := (
        string_to_array(contact_record->>'phone_numbers', ',')
    );

    IF new_phone_numbers IS NOT NULL THEN
        SELECT p.phone_numbers
            INTO old_phone_numbers
            FROM private.persons p
        WHERE p.email = contact_record->>'email'
            AND p.user_id = (contact_record->>'user_id')::UUID
        LIMIT 1;

        IF old_phone_numbers IS NOT NULL THEN
            -- append only the truly new ones
            FOREACH phone_number IN ARRAY new_phone_numbers LOOP
            IF NOT phone_number = ANY(old_phone_numbers) THEN
                old_phone_numbers := ARRAY_APPEND(old_phone_numbers, phone_number);
            END IF;
            END LOOP;
            merged_phone_numbers := old_phone_numbers;
        ELSE
            -- no existing array → just take new
            merged_phone_numbers := new_phone_numbers;
        END IF;
    END IF;

    -- Add name into alternate_name if name is already filled
    new_name := contact_record->>'name';
    IF new_name IS NOT NULL THEN
      SELECT p.name, p.alternate_name 
      INTO old_name, old_alternate_name
      FROM private.persons p
      WHERE p.email = contact_record->>'email' AND p.user_id = (contact_record->>'user_id')::UUID
      LIMIT 1;
      IF old_name IS NOT NULL THEN
        IF (old_name != new_name AND (old_alternate_name IS NULL OR NOT(new_name = ANY(old_alternate_name)))) THEN
          new_alternate_name := ARRAY_APPEND(old_alternate_name, new_name);
        END IF;
        new_name := old_name;
      END IF;
    END IF;

    IF p_update_empty_fields_only THEN
      UPDATE private.persons pp
      SET 
        name = COALESCE(pp.name, new_name::TEXT),
        url = COALESCE(pp.url, (contact_record->>'url')::TEXT),
        image = COALESCE(pp.image, (contact_record->>'image')::TEXT),
        location = COALESCE(pp.location, string_to_array(contact_record->>'location', ',')::TEXT[]),
        alternate_name = COALESCE(pp.alternate_name, (new_alternate_name)::TEXT[]),
        same_as = COALESCE(pp.same_as, string_to_array(contact_record->>'same_as', ',')::TEXT[]),
        given_name = COALESCE(pp.given_name, (contact_record->>'given_name')::TEXT),
        family_name = COALESCE(pp.family_name, (contact_record->>'family_name')::TEXT),
        job_title = COALESCE(pp.job_title, (contact_record->>'job_title')::TEXT),
        works_for = COALESCE(pp.works_for, organization_id),
        identifiers = COALESCE(pp.identifiers, string_to_array(contact_record->>'identifiers', ',')::TEXT[]),
        status = COALESCE(pp.status, (contact_record->>'status')::TEXT),
        phone_numbers = COALESCE(pp.phone_numbers, (merged_phone_numbers)::TEXT[])
      WHERE 
        email = (contact_record->>'email')::TEXT AND
        user_id = (contact_record->>'user_id')::UUID;
    ELSE
      UPDATE private.persons pp
      SET 
        name = COALESCE(new_name::TEXT, pp.name),
        url = COALESCE((contact_record->>'url')::TEXT, pp.url),
        image = COALESCE((contact_record->>'image')::TEXT, pp.image),
        location = COALESCE(string_to_array(contact_record->>'location', ',')::TEXT[], pp.location),
        alternate_name = COALESCE((new_alternate_name)::TEXT[], pp.alternate_name),
        same_as = COALESCE(string_to_array(contact_record->>'same_as', ',')::TEXT[], pp.same_as),
        given_name = COALESCE((contact_record->>'given_name')::TEXT, pp.given_name),
        family_name = COALESCE((contact_record->>'family_name')::TEXT, pp.family_name),
        job_title = COALESCE((contact_record->>'job_title')::TEXT, pp.job_title),
        works_for = COALESCE(organization_id, pp.works_for),
        identifiers = COALESCE(string_to_array(contact_record->>'identifiers', ',')::TEXT[], pp.identifiers),
        status = COALESCE((contact_record->>'status')::TEXT, pp.status),
        phone_numbers = COALESCE((merged_phone_numbers)::TEXT[], pp.phone_numbers)

      WHERE 
        email = (contact_record->>'email')::TEXT AND
        user_id = (contact_record->>'user_id')::UUID;
    END IF;
  END LOOP;
END;
$$;