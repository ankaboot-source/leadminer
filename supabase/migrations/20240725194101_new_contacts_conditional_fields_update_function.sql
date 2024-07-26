DROP FUNCTION IF EXISTS update_contact_by_email;

/**
 * enrich_contacts
 *
 * Updates existing contact information, either updates all fields or only empty fields
 * based on the p_update_empty_fields_only parameter.
 *
 * Parameters:
 * @param p_contacts_data JSONB[] - An array of JSON objects, each containing enriched contact data.
 *                                  Each object should have the following structure:
 *                                  {
 *                                    "email": TEXT,           -- Required. Part of primary key.
 *                                    "user_id": UUID,         -- Required. Part of primary key.
 *                                    "name": TEXT,            -- Optional. Full name of the contact.
 *                                    "url": TEXT,             -- Optional. Personal or professional URL.
 *                                    "image": TEXT,           -- Optional. Profile image URL.
 *                                    "address": TEXT,         -- Optional. Physical address.
 *                                    "alternate_names": TEXT[],  -- Optional. Other known names.
 *                                    "same_as": TEXT[],       -- Optional. Links to same person on other platforms.
 *                                    "given_name": TEXT,      -- Optional. First name.
 *                                    "family_name": TEXT,     -- Optional. Last name.
 *                                    "job_title": TEXT,       -- Optional. Current job title.
 *                                    "works_for": UUID,       -- Optional. Company UUID.
 *                                    "identifiers": TEXT[],   -- Optional. Other identifying information.
 *                                    "status": TEXT,          -- Optional. Current status of the contact.
 *                                  }
 * @param p_update_empty_fields_only BOOLEAN - Determines the update behavior.
 *                            When TRUE (default), only updates empty fields in existing records.
 *                            When FALSE, updates all fields, potentially overwriting existing data.
 */
CREATE OR REPLACE FUNCTION enrich_contacts(
  p_contacts_data JSONB[],
  p_update_empty_fields_only BOOLEAN DEFAULT true
)
RETURNS VOID AS $$
DECLARE
  contact_record JSONB;
  organization_id UUID;
  works_for_name TEXT;
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
      FROM organizations
      WHERE name = works_for_name
      LIMIT 1;
      
      IF NOT FOUND THEN
        INSERT INTO organizations (name)
        VALUES (works_for_name)
        RETURNING id INTO organization_id;
      END IF;
    ELSE
      organization_id := NULL;
    END IF;

    IF p_update_empty_fields_only THEN
      UPDATE persons
      SET 
        name = COALESCE(persons.name, (contact_record->>'name')::TEXT),
        url = COALESCE(persons.url, (contact_record->>'url')::TEXT),
        image = COALESCE(persons.image, (contact_record->>'image')::TEXT),
        address = COALESCE(persons.address, (contact_record->>'address')::TEXT),
        alternate_names = COALESCE(persons.alternate_names, string_to_array(contact_record->>'alternate_names', ',')::TEXT[]),
        same_as = COALESCE( persons.same_as, string_to_array(contact_record->>'same_as', ',')::TEXT[]),
        given_name = COALESCE(persons.given_name, (contact_record->>'given_name')::TEXT),
        family_name = COALESCE(persons.family_name, (contact_record->>'family_name')::TEXT),
        job_title = COALESCE(persons.job_title, (contact_record->>'job_title')::TEXT),
        works_for = COALESCE(persons.works_for, organization_id),
        identifiers = COALESCE(persons.identifiers, string_to_array(contact_record->>'identifiers', ',')::TEXT[]),
        status = COALESCE(persons.status, (contact_record->>'status')::TEXT)
      WHERE 
        email = (contact_record->>'email')::TEXT AND
        user_id = (contact_record->>'user_id')::UUID;
    ELSE
      UPDATE persons
      SET 
        name = COALESCE((contact_record->>'name')::TEXT, persons.name),
        url = COALESCE((contact_record->>'url')::TEXT, persons.url),
        image = COALESCE((contact_record->>'image')::TEXT, persons.image),
        address = COALESCE((contact_record->>'address')::TEXT, persons.address),
        alternate_names = COALESCE(string_to_array(contact_record->>'alternate_names', ',')::TEXT[], persons.alternate_names),
        same_as = COALESCE(string_to_array(contact_record->>'same_as', ',')::TEXT[], persons.same_as),
        given_name = COALESCE((contact_record->>'given_name')::TEXT, persons.given_name),
        family_name = COALESCE((contact_record->>'family_name')::TEXT, persons.family_name),
        job_title = COALESCE((contact_record->>'job_title')::TEXT, persons.job_title),
        works_for = COALESCE(organization_id, persons.works_for),
        identifiers = COALESCE(string_to_array(contact_record->>'identifiers', ',')::TEXT[], persons.identifiers),
        status = COALESCE((contact_record->>'status')::TEXT, persons.status)
      WHERE 
        email = (contact_record->>'email')::TEXT AND
        user_id = (contact_record->>'user_id')::UUID;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
