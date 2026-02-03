ALTER TABLE private.mining_sources
ADD COLUMN passive_mining BOOLEAN DEFAULT FALSE;

CREATE POLICY "User can update own mining source"
ON private.mining_sources
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User can select own mining source"
ON private.mining_sources
FOR SELECT
TO public
USING (auth.uid() = user_id);