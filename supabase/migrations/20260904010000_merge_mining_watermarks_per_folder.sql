-- Preserve incremental mining cursors when concurrent or out-of-order config
-- patches arrive. The row lock in update_mining_source_config remains the
-- transaction boundary; this migration only adds cursor-aware merge semantics.

CREATE OR REPLACE FUNCTION private.update_mining_source_config(
  p_id UUID,
  p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_config JSONB;
  new_config JSONB;
  current_folders JSONB;
  patch_folders JSONB;
  folder TEXT;
  current_cursor JSONB;
  patch_cursor JSONB;
  current_uidvalidity TEXT;
  patch_uidvalidity TEXT;
  current_last_uid INTEGER;
  patch_last_uid INTEGER;
  merged_cursor JSONB;
BEGIN
  SELECT config INTO current_config
  FROM private.mining_sources
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mining source % not found', p_id;
  END IF;

  new_config := private.jsonb_deep_merge(current_config, p_patch);

  current_folders := COALESCE(
    current_config #> '{mining,last,folders}',
    '{}'::jsonb
  );
  patch_folders := p_patch #> '{mining,last,folders}';

  IF jsonb_typeof(patch_folders) = 'object' THEN
    FOR folder IN SELECT jsonb_object_keys(patch_folders) LOOP
      current_cursor := current_folders -> folder;
      patch_cursor := patch_folders -> folder;

      IF jsonb_typeof(patch_cursor) <> 'object' THEN
        CONTINUE;
      END IF;

      current_uidvalidity := current_cursor ->> 'uidvalidity';
      patch_uidvalidity := patch_cursor ->> 'uidvalidity';
      current_last_uid := NULLIF(current_cursor ->> 'last_uid', '')::INTEGER;
      patch_last_uid := NULLIF(patch_cursor ->> 'last_uid', '')::INTEGER;

      -- A UIDVALIDITY change starts a new UID namespace and must replace the
      -- previous cursor. Within the same namespace, cursors are monotonic.
      IF current_uidvalidity IS NOT NULL
         AND current_uidvalidity = patch_uidvalidity
         AND current_last_uid IS NOT NULL
         AND patch_last_uid IS NOT NULL
         AND patch_last_uid < current_last_uid THEN
        merged_cursor := current_cursor;
      ELSE
        merged_cursor := patch_cursor;
      END IF;

      new_config := jsonb_set(
        new_config,
        ARRAY['mining', 'last', 'folders', folder],
        merged_cursor,
        true
      );
    END LOOP;
  END IF;

  UPDATE private.mining_sources SET config = new_config WHERE id = p_id;
  RETURN new_config;
END;
$$;

REVOKE ALL ON FUNCTION private.update_mining_source_config(UUID, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION private.update_mining_source_config(UUID, JSONB) TO service_role;
