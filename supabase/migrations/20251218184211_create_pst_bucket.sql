-- Create the 'pst' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'pst', 
  'pst', 
  false, -- Private bucket 
  5368709120 -- 5GB MAXIMUM per individual file upload
);

CREATE POLICY "Give users authenticated access to folder 2dw1_0" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'pst' AND (storage.foldername(name))[1] = 'private' AND auth.role() = 'authenticated');
CREATE POLICY "Give users authenticated access to folder 2dw1_1" ON storage.objects FOR SELECT TO public USING (bucket_id = 'pst' AND (storage.foldername(name))[1] = 'private' AND auth.role() = 'authenticated');


CREATE POLICY "Give users access to own folder 2dw1_0" ON storage.objects FOR SELECT TO public USING (bucket_id = 'pst' AND (select auth.uid()::text) = (storage.foldername(name))[1]);
CREATE POLICY "Give users access to own folder 2dw1_1" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'pst' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

-- Create scheduled job to remove PST files
-- Function to delete PST files older than 24 hours
CREATE OR REPLACE FUNCTION public.delete_old_pst_files()
RETURNS void AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'pst'
    AND created_at <= NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Run once every day at midnight UTC
SELECT cron.schedule(
  'delete-old-pst-files',
  '0 0 * * *', -- every 24 hours
  $$SELECT public.delete_old_pst_files();$$
);
