-- Create the 'pst' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'pst', 
  'pst', 
  false, -- Private bucket 
  52428800 -- 50MB MAXIMUM per individual file upload -- Premium plan allows up to ???
);

CREATE POLICY "Give users authenticated access to folder 2dw1_0" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'pst' AND (storage.foldername(name))[1] = 'private' AND auth.role() = 'authenticated');
CREATE POLICY "Give users authenticated access to folder 2dw1_1" ON storage.objects FOR SELECT TO public USING (bucket_id = 'pst' AND (storage.foldername(name))[1] = 'private' AND auth.role() = 'authenticated');


CREATE POLICY "Give users access to own folder 2dw1_0" ON storage.objects FOR SELECT TO public USING (bucket_id = 'pst' AND (select auth.uid()::text) = (storage.foldername(name))[1]);
CREATE POLICY "Give users access to own folder 2dw1_1" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'pst' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

