-- Create paginated contacts RPC function with server-side filtering and sorting
DROP FUNCTION IF EXISTS private.get_contacts_paginated(uuid, integer, integer, text, text, text, jsonb);

CREATE FUNCTION private.get_contacts_paginated(
  p_user_id uuid,
  p_page integer DEFAULT 1,
  p_per_page integer DEFAULT 150,
  p_sort_field text DEFAULT 'temperature',
  p_sort_order text DEFAULT 'DESC',
  p_search_query text DEFAULT null,
  p_filters jsonb DEFAULT '{}'
)
RETURNS TABLE(
  contacts jsonb,
  total_count bigint
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_offset integer;
  v_where_conditions text[];
  v_base_query text;
  v_filtered_query text;
  v_final_query text;
  v_count_query text;
  v_result record;
BEGIN
  v_offset := (p_page - 1) * p_per_page;
  
  v_where_conditions := ARRAY['p.user_id = p_user_id'];
  
  IF p_search_query IS NOT NULL AND p_search_query <> '' THEN
    v_where_conditions := v_where_conditions || ARRAY[
      format('(p.email ILIKE %L OR p.name ILIKE %L OR p.location ILIKE %L)',
             '%' || p_search_query || '%',
             '%' || p_search_query || '%',
             '%' || p_search_query || '%')
    ];
  END IF;
  
  IF p_filters ? 'valid_only' AND p_filters->>'valid_only' = 'true' THEN
    v_where_conditions := v_where_conditions || ARRAY[
      '(p.status = ''VALID'' OR p.status = ''UNKNOWN'' OR p.status IS NULL)'
    ];
  END IF;
  
  IF p_filters ? 'hide_unsubscribed' AND p_filters->>'hide_unsubscribed' = 'true' THEN
    v_where_conditions := v_where_conditions || ARRAY[
      "(p.consent_status IS DISTINCT FROM 'opt_out')"
    ];
  END IF;
  
  IF p_filters ? 'recent_only' AND p_filters->>'recent_only' = 'true' THEN
    v_where_conditions := v_where_conditions || ARRAY[
      format('(rp.recency IS NOT NULL AND rp.recency >= NOW() - INTERVAL ''%s years'')',
             COALESCE((p_filters->>'recent_years')::integer, 5))
    ];
  END IF;
  
  IF p_filters ? 'has_name' AND p_filters->>'has_name' = 'true' THEN
    v_where_conditions := v_where_conditions || ARRAY[
      "(p.name IS NOT NULL AND p.name <> '')"
    ];
  END IF;
  
  IF p_filters ? 'has_replies' AND p_filters->>'has_replies' = 'true' THEN
    v_where_conditions := v_where_conditions || ARRAY[
      "(rp.replied_conversations > 0)"
    ];
  END IF;
  
  IF p_filters ? 'has_phone' AND p_filters->>'has_phone' = 'true' THEN
    v_where_conditions := v_where_conditions || ARRAY[
      "(p.telephone IS NOT NULL AND p.telephone <> ARRAY[]::text[])"
    ];
  END IF;
  
  IF p_filters ? 'has_location' AND p_filters->>'has_location' = 'true' THEN
    v_where_conditions := v_where_conditions || ARRAY[
      "(p.location IS NOT NULL AND p.location <> '')"
    ];
  END IF;
  
  IF p_filters ? 'job_details_only' AND p_filters->>'job_details_only' = 'true' THEN
    v_where_conditions := v_where_conditions || ARRAY[
      "((p.job_title IS NOT NULL AND p.job_title <> '') OR (p.works_for IS NOT NULL))"
    ];
  END IF;
  
  v_base_query := '
    SELECT DISTINCT ON (p.email)
      p.email,
      p.source,
      p.name,
      p.status,
      p.consent_status,
      p.consent_changed_at,
      p.image,
      p.location,
      p.location_normalized,
      p.alternate_name,
      p.alternate_email,
      p.telephone,
      p.same_as,
      p.given_name,
      p.family_name,
      p.job_title,
      o.name as works_for,
      rp.recency,
      rp.seniority,
      rp.occurrence,
      rp.temperature,
      rp.sender,
      rp.recipient,
      rp.conversations,
      rp.replied_conversations,
      rp.tags,
      p.updated_at,
      p.created_at,
      p.mining_id
    FROM private.persons p
    INNER JOIN private.refinedpersons rp ON rp.email = p.email AND rp.user_id = p.user_id
    LEFT JOIN private.organizations o ON o.id = p.works_for
  ';
  
  v_filtered_query := v_base_query || ' WHERE ' || array_to_string(v_where_conditions, ' AND ');
  
  v_count_query := 'SELECT COUNT(DISTINCT email) as cnt FROM (' || v_filtered_query || ') sub';
  
  IF p_sort_field IS NOT NULL AND p_sort_field <> '' THEN
    CASE p_sort_field
      WHEN 'temperature' THEN
        v_final_query := v_filtered_query || ' ORDER BY rp.temperature ' || COALESCE(p_sort_order, 'DESC') || ', p.email';
      WHEN 'recency' THEN
        v_final_query := v_filtered_query || ' ORDER BY rp.recency ' || COALESCE(p_sort_order, 'DESC') || ' NULLS LAST, p.email';
      WHEN 'seniority' THEN
        v_final_query := v_filtered_query || ' ORDER BY rp.seniority ' || COALESCE(p_sort_order, 'DESC') || ' NULLS LAST, p.email';
      WHEN 'occurrence' THEN
        v_final_query := v_filtered_query || ' ORDER BY rp.occurrence ' || COALESCE(p_sort_order, 'DESC') || ', p.email';
      WHEN 'replied_conversations' THEN
        v_final_query := v_filtered_query || ' ORDER BY rp.replied_conversations ' || COALESCE(p_sort_order, 'DESC') || ', p.email';
      WHEN 'source' THEN
        v_final_query := v_filtered_query || ' ORDER BY p.source ' || COALESCE(p_sort_order, 'ASC') || ', p.email';
      WHEN 'name' THEN
        v_final_query := v_filtered_query || ' ORDER BY p.name ' || COALESCE(p_sort_order, 'ASC') || ' NULLS LAST, p.email';
      WHEN 'location' THEN
        v_final_query := v_filtered_query || ' ORDER BY p.location ' || COALESCE(p_sort_order, 'ASC') || ' NULLS LAST, p.email';
      WHEN 'job_title' THEN
        v_final_query := v_filtered_query || ' ORDER BY p.job_title ' || COALESCE(p_sort_order, 'ASC') || ' NULLS LAST, p.email';
      WHEN 'works_for' THEN
        v_final_query := v_filtered_query || ' ORDER BY o.name ' || COALESCE(p_sort_order, 'ASC') || ' NULLS LAST, p.email';
      WHEN 'tags' THEN
        v_final_query := v_filtered_query || ' ORDER BY array_length(rp.tags, 1) ' || COALESCE(p_sort_order, 'DESC') || ' NULLS LAST, p.email';
      WHEN 'sender' THEN
        v_final_query := v_filtered_query || ' ORDER BY rp.sender ' || COALESCE(p_sort_order, 'DESC') || ', p.email';
      WHEN 'recipient' THEN
        v_final_query := v_filtered_query || ' ORDER BY rp.recipient ' || COALESCE(p_sort_order, 'DESC') || ', p.email';
      WHEN 'status' THEN
        v_final_query := v_filtered_query || ' ORDER BY p.status ' || COALESCE(p_sort_order, 'ASC') || ' NULLS LAST, p.email';
      WHEN 'consent_status' THEN
        v_final_query := v_filtered_query || ' ORDER BY p.consent_status ' || COALESCE(p_sort_order, 'ASC') || ' NULLS LAST, p.email';
      ELSE
        v_final_query := v_filtered_query || ' ORDER BY rp.temperature DESC, rp.occurrence DESC, rp.recency DESC, p.email';
    END CASE;
  ELSE
    v_final_query := v_filtered_query || ' ORDER BY rp.temperature DESC, rp.occurrence DESC, rp.recency DESC, p.email';
  END IF;
  
  v_final_query := v_final_query || format(' LIMIT %s OFFSET %s', p_per_page, v_offset);
  
  EXECUTE v_count_query INTO v_result;
  total_count := v_result.cnt;
  
  FOR v_result IN EXECUTE v_final_query LOOP
    contacts := jsonb_build_object(
      'source', v_result.source,
      'email', v_result.email,
      'name', v_result.name,
      'status', v_result.status,
      'consent_status', v_result.consent_status,
      'consent_changed_at', v_result.consent_changed_at,
      'image', v_result.image,
      'location', v_result.location,
      'location_normalized', v_result.location_normalized,
      'alternate_name', v_result.alternate_name,
      'alternate_email', v_result.alternate_email,
      'telephone', v_result.telephone,
      'same_as', v_result.same_as,
      'given_name', v_result.given_name,
      'family_name', v_result.family_name,
      'job_title', v_result.job_title,
      'works_for', v_result.works_for,
      'recency', v_result.recency,
      'seniority', v_result.seniority,
      'occurrence', v_result.occurrence,
      'temperature', v_result.temperature,
      'sender', v_result.sender,
      'recipient', v_result.recipient,
      'conversations', v_result.conversations,
      'replied_conversations', v_result.replied_conversations,
      'tags', v_result.tags,
      'updated_at', v_result.updated_at,
      'created_at', v_result.created_at,
      'mining_id', v_result.mining_id
    );
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION private.get_contacts_paginated TO authenticated;