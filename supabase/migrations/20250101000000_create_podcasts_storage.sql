-- Create storage bucket for podcast audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'podcasts',
  'podcasts',
  true,
  104857600, -- 100MB limit
  ARRAY['audio/webm', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own podcast audio
CREATE POLICY "Users can upload their own podcast audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'podcasts' AND
  (storage.foldername(name))[1] = 'live-podcasts'
);

-- Allow users to update their own podcast audio
CREATE POLICY "Users can update their own podcast audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'podcasts')
WITH CHECK (bucket_id = 'podcasts');

-- Allow public read access to podcast audio
CREATE POLICY "Public can view podcast audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'podcasts');

-- Allow users to delete their own podcast audio
CREATE POLICY "Users can delete their own podcast audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'podcasts' AND
  (storage.foldername(name))[1] = 'live-podcasts'
);
