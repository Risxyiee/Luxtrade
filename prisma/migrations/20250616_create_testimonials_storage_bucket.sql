-- SQL Script: Create Supabase Storage Bucket for Testimonial Photos
-- Run this in Supabase SQL Editor

-- Create 'testimonials' bucket for testimonial profile photos (PUBLIC so images show on landing page)
INSERT INTO storage.buckets (id, name, public)
VALUES (
  'testimonials',
  'testimonials',
  true
)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Row Level Security Policies for 'testimonials' bucket

-- Authenticated users can upload testimonial photos (folder structure: photos/{userId}/...)
CREATE POLICY "Users can upload testimonial photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'testimonials' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Anyone can view testimonial photos (public bucket for landing page display)
CREATE POLICY "Anyone can view testimonial photos"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'testimonials'
);

-- Users can delete their own testimonial photos
CREATE POLICY "Users can delete own testimonial photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'testimonials' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Verification
SELECT
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'testimonials';
