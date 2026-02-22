-- Storage bucket for frame images (thumbnails + hi-res)
INSERT INTO storage.buckets (id, name, public)
VALUES ('frame-images', 'frame-images', false)
ON CONFLICT DO NOTHING;

-- RLS: users can upload to their own folder ({user_id}/...)
CREATE POLICY "Users can upload own frame images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'frame-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: users can read their own folder
CREATE POLICY "Users can view own frame images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'frame-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: users can overwrite (upsert) their own images
CREATE POLICY "Users can update own frame images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'frame-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: users can delete their own images
CREATE POLICY "Users can delete own frame images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'frame-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
