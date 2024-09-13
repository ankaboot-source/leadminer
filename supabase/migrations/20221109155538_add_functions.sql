CREATE FUNCTION "public"."delete_user_data"("user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  owner_id uuid;
BEGIN
  owner_id = delete_user_data.user_id;
  DELETE FROM messages msg WHERE msg.user_id = owner_id;
  DELETE FROM persons p WHERE p.user_id = owner_id;
  DELETE FROM pointsofcontact poc WHERE poc.user_id = owner_id;
  DELETE FROM tags t WHERE t.user_id = owner_id;
  DELETE FROM refinedpersons r WHERE r.user_id = owner_id;
  DELETE from mining_sources ms WHERE ms.user_id = owner_id;
  DELETE from engagement eg WHERE eg.user_id = owner_id;
END;
$$;

CREATE FUNCTION "public"."enrich_contacts"("p_contacts_data" "jsonb"[], "p_update_empty_fields_only" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  contact_record JSONB;
  organization_id UUID;
  works_for_name TEXT;
  new_name TEXT;
  new_alternate_names TEXT[];
  old_name TEXT;
  old_alternate_names TEXT[];
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

    -- Add name into alternate_names if name is already filled
    new_name := contact_record->>'name';
    IF new_name IS NOT NULL THEN
      SELECT p.name, p.alternate_names 
      INTO old_name, old_alternate_names
      FROM persons p
      WHERE p.email = contact_record->>'email' AND p.user_id = (contact_record->>'user_id')::UUID
      LIMIT 1;
      IF old_name IS NOT NULL THEN
        IF (old_name != new_name AND (old_alternate_names IS NULL OR NOT(new_name = ANY(old_alternate_names)))) THEN
          new_alternate_names := ARRAY_APPEND(old_alternate_names, new_name);
        END IF;
        new_name := old_name;
      END IF;
    END IF;

    IF p_update_empty_fields_only THEN
      UPDATE persons
      SET 
        name = COALESCE(persons.name, new_name::TEXT),
        url = COALESCE(persons.url, (contact_record->>'url')::TEXT),
        image = COALESCE(persons.image, (contact_record->>'image')::TEXT),
        location = COALESCE(persons.location, string_to_array(contact_record->>'location', ',')::TEXT[]),
        alternate_names = COALESCE(persons.alternate_names, (new_alternate_names)::TEXT[]),
        same_as = COALESCE(persons.same_as, string_to_array(contact_record->>'same_as', ',')::TEXT[]),
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
        name = COALESCE(new_name::TEXT, persons.name),
        url = COALESCE((contact_record->>'url')::TEXT, persons.url),
        image = COALESCE((contact_record->>'image')::TEXT, persons.image),
        location = COALESCE(string_to_array(contact_record->>'location', ',')::TEXT[], persons.location),
        alternate_names = COALESCE((new_alternate_names)::TEXT[], persons.alternate_names),
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
$$;

CREATE FUNCTION "public"."get_contacts_table"("user_id" "uuid") RETURNS TABLE("source" "text", "email" "text", "name" "text", "status" "text", "image" "text", "location" "text"[], "alternate_names" "text"[], "same_as" "text"[], "given_name" "text", "family_name" "text", "job_title" "text", "works_for" "text", "recency" timestamp with time zone, "seniority" timestamp with time zone, "occurrence" integer, "sender" integer, "recipient" integer, "conversations" integer, "replied_conversations" integer, "tags" "text"[], "updated_at" timestamp without time zone, "created_at" timestamp without time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY WITH ExportedContacts AS (
    SELECT
      p.source as source_col,
      p.email as email_col,
      p.name as name_col,
      p.status as status_col,
      p.image as image_col,
      p.location as location_col,
      p.alternate_names as alternate_names_col,
      p.same_as as same_as_col,
      p.given_name as given_name_col,
      p.family_name as family_name_col,
      p.job_title as job_title_col,
      o.name as works_for_col,
      rp.recency as recency_col,
      rp.seniority as seniority_col,
      rp.occurrence as occurrence_col,
      rp.sender as sender_col,
      rp.recipient as recipient_col,
      rp.conversations as conversations_col,
      rp.replied_conversations as replied_conversations_col,
      rp.tags as tags_col,
      p.updated_at as updated_at_col,
      p.created_at as created_at_col,
      ROW_NUMBER() OVER (
        PARTITION BY p.email
      ) AS rn
    FROM
      persons p
    INNER JOIN
      refinedpersons rp ON rp.email = p.email
    LEFT JOIN
      organizations o ON o.id = p.works_for
    WHERE
      p.user_id = get_contacts_table.user_id
    ORDER BY 
      rp.occurrence DESC, rp.recency DESC
	  )
  SELECT
    source_col AS source,
    email_col AS email,
    name_col AS name,
    status_col AS status,
    image_col as image,
    location_col as location,
    alternate_names_col as alternate_names,
    same_as_col as same_as,
    given_name_col as given_name,
    family_name_col as family_name,
    job_title_col as job_title,
    works_for_col as works_for,
    recency_col AS recency,
    seniority_col AS seniority,
    occurrence_col AS occurrence,
    sender_col AS sender,
    recipient_col AS recipient,
    conversations_col AS conversations,
    replied_conversations_col AS replied_conversations,
    tags_col AS tags,
	updated_at_col AS updated_at,
	created_at_col AS created_at
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$;

CREATE FUNCTION "public"."get_contacts_table_by_emails"("user_id" "uuid", "emails" "text"[]) RETURNS TABLE("source" "text", "email" "text", "name" "text", "status" "text", "image" "text", "location" "text"[], "alternate_names" "text"[], "same_as" "text"[], "given_name" "text", "family_name" "text", "job_title" "text", "works_for" "text", "recency" timestamp with time zone, "seniority" timestamp with time zone, "occurrence" integer, "sender" integer, "recipient" integer, "conversations" integer, "replied_conversations" integer, "tags" "text"[], "updated_at" timestamp without time zone, "created_at" timestamp without time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY WITH ExportedContacts AS (
    SELECT
      p.source as source_col,
      p.email as email_col,
      p.name as name_col,
      p.status as status_col,
      p.image as image_col,
      p.location as location_col,
      p.alternate_names as alternate_names_col,
      p.same_as as same_as_col,
      p.given_name as given_name_col,
      p.family_name as family_name_col,
      p.job_title as job_title_col,
      o.name as works_for_col,
      rp.recency as recency_col,
      rp.seniority as seniority_col,
      rp.occurrence as occurrence_col,
      rp.sender as sender_col,
      rp.recipient as recipient_col,
      rp.conversations as conversations_col,
      rp.replied_conversations as replied_conversations_col,
      rp.tags as tags_col,
      p.updated_at as updated_at_col,
      p.created_at as created_at_col,
      ROW_NUMBER() OVER (
      PARTITION BY p.email
      ) AS rn
    FROM
      persons p
    INNER JOIN
      refinedpersons rp ON rp.email = p.email
    LEFT JOIN
      organizations o ON o.id = p.works_for
    WHERE
      p.user_id = get_contacts_table_by_emails.user_id
    AND
      p.email = ANY(get_contacts_table_by_emails.emails)
	ORDER BY 
      rp.occurrence DESC, rp.recency DESC
  )
  SELECT
    source_col AS source,
    email_col AS email,
    name_col AS name,
    status_col AS status,
    image_col as image,
    location_col as location,
    alternate_names_col as alternate_names,
    same_as_col as same_as,
    given_name_col as given_name,
    family_name_col as family_name,
    job_title_col as job_title,
    works_for_col as works_for,
    recency_col AS recency,
    seniority_col AS seniority,
    occurrence_col AS occurrence,
    sender_col AS sender,
    recipient_col AS recipient,
    conversations_col AS conversations,
    replied_conversations_col AS replied_conversations,
    tags_col AS tags,
	updated_at_col AS updated_at,
	created_at_col AS created_at
  FROM
    ExportedContacts
  WHERE
    rn = 1;
END;
$$;

CREATE FUNCTION "public"."get_grouped_tags_by_person"("_userid" "uuid") RETURNS TABLE("email" "text", "tags" "text"[], "tags_reachability" integer[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    person_email AS email,
    array_agg(name) AS tags,
    array_agg(reachable) AS tags_reachability
  FROM tags
  WHERE
      user_id = _userid
      AND reachable IN (1, 2)
      AND person_email NOT IN (
          SELECT person_email
          FROM tags
          WHERE user_id = _userid
          GROUP BY person_email
          HAVING
            MAX(reachable) = 3
              OR (count(DISTINCT reachable) = 1 AND MAX(reachable) = 3)
              OR (count(DISTINCT reachable) = 2 AND ARRAY[1, 3] <@ array_agg(DISTINCT reachable))
      )
  GROUP BY person_email;
END
$$;

CREATE FUNCTION "public"."populate_refined"("_userid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO refinedpersons(user_id, tags, name, email, status, created_at, updated_at)
    SELECT populate_refined._userid, t.tags, p.name, p.email, p.status, p.created_at, p.updated_at
    FROM public.persons p
    INNER JOIN public.get_grouped_tags_by_person(_userid) AS t ON t.email = p.email
    WHERE p.user_id=populate_refined._userid
    ON conflict(email, user_id) do nothing;
END;
$$;

CREATE FUNCTION "public"."refine_persons"("user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$ 
DECLARE
    record_row record;
BEGIN
    FOR record_row IN (
        SELECT distinct
            subquery.person_email,
            first_value(name) over (partition by person_email order by total desc, source desc, recent_date desc) AS name,
            subquery.occurrence,
            subquery.recency,
            subquery.seniority,
            subquery.sender,
            subquery.recipient,
            subquery.conversations,
            subquery.replied_conversations,
            subquery.tags
        FROM (
            SELECT
                person_email,
                "from" as source,
                name,
                MAX(m.date) over grouped_by_email AS recency,
                MIN(m.date) over grouped_by_email AS seniority,
                MAX(m.date) over (partition by person_email, name) AS recent_date,
                COUNT(
                CASE
                    WHEN name is not null THEN 1
                END
                ) over (partition by person_email, name) AS total,
                COUNT(*) over grouped_by_email AS occurrence,
                COUNT(
                CASE
                    WHEN "from" OR "reply_to" THEN 1
                END
                ) over grouped_by_email AS sender,
                COUNT(
                CASE
                    WHEN "to" OR bcc OR cc THEN 1
                END
                ) over grouped_by_email AS recipient,
                COUNT(
                CASE
                    WHEN m.conversation THEN 1
                END
                ) over grouped_by_email AS conversations,
                COUNT(
                CASE
                    WHEN m.conversation and "from" THEN 1
                END
                ) over grouped_by_email AS replied_conversations,
                gt.tags as tags

            FROM pointsofcontact poc
            JOIN messages m ON poc.message_id = m.message_id
            JOIN get_grouped_tags_by_person(refine_persons.user_id) gt on poc.person_email = gt.email
            WHERE
            poc.user_id = refine_persons.user_id
            WINDOW grouped_by_email AS (PARTITION BY person_email)
        ) subquery
    )
    LOOP
        UPDATE public.persons
        SET
            name = record_row.name
        WHERE
            email = record_row.person_email;

        INSERT INTO public. refinedpersons (
            user_id, email, occurrence, recency, seniority,
            sender, recipient, conversations, replied_conversations, tags
        )
        VALUES (
            refine_persons.user_id,
            record_row.person_email,
            record_row.occurrence,
            record_row.recency,
            record_row.seniority,
            record_row.sender,
            record_row.recipient,
            record_row.conversations,
            record_row.replied_conversations,
            record_row.tags
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;

CREATE FUNCTION "public"."upsert_mining_source"("_user_id" "uuid", "_email" "text", "_type" "text", "_credentials" "text", "_encryption_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'extensions', 'public'
    AS $$
BEGIN
    INSERT INTO mining_sources ("user_id", "email", "type", "credentials")
    VALUES (_user_id, _email, _type, pgp_sym_encrypt(_credentials, _encryption_key))
    ON CONFLICT (email, user_id)
    DO UPDATE 
    SET credentials = EXCLUDED.credentials,
        type = EXCLUDED.type;
END;
$$;

REVOKE ALL ON FUNCTION "public"."enrich_contacts"("p_contacts_data" "jsonb"[], "p_update_empty_fields_only" boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."get_contacts_table"("user_id" "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."get_contacts_table_by_emails"("user_id" "uuid", "emails" "text"[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."refine_persons"("user_id" "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."upsert_mining_source"("_user_id" "uuid", "_email" "text", "_type" "text", "_credentials" "text", "_encryption_key" "text") FROM PUBLIC;