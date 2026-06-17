-- Create trade-screenshots bucket for Auto-Journal screenshots
-- This bucket stores screenshots uploaded by users for trade journal entries

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  false, -- Not public, controlled by RLS
  10485760, -- 10MB max file size
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS on objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload their own screenshots
CREATE POLICY "Users can upload trade screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'trade-screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own screenshots
CREATE POLICY "Users can view their own trade screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'trade-screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own screenshots
CREATE POLICY "Users can update their own trade screenshots"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'trade-screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Admins can view all trade screenshots
CREATE POLICY "Admins can view all trade screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'trade-screenshots' AND
  (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'ADMIN'
);

-- Policy: Admins can delete any trade screenshot
CREATE POLICY "Admins can delete trade screenshots"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'trade-screenshots' AND
  (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'ADMIN'
);

-- Grant permissions
GRANT ALL ON SCHEMA storage TO postgres, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, authenticated, anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA storage TO postgres, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, authenticated, anon;

COMMENT ON POLICY "Users can upload trade screenshots" ON storage.objects IS 'Allows authenticated users to upload screenshots to their own folder';
COMMENT ON POLICY "Users can view their own trade screenshots" ON storage.objects IS 'Allows users to view only their own screenshots';
COMMENT ON POLICY "Admins can view all trade screenshots" ON storage.objects IS 'Allows admins to view all screenshots for moderation/support';
COMMENT ON POLICY "Admins can delete trade screenshots" ON storage.objects IS 'Allows admins to delete inappropriate screenshots';