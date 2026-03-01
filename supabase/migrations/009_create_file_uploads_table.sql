-- Create file_uploads table to track all uploaded files
CREATE TABLE IF NOT EXISTS public.file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100),
  file_size INT,
  bucket VARCHAR(100) NOT NULL CHECK (bucket IN ('avatars', 'thumbnails', 'compositions')),
  storage_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON public.file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_bucket ON public.file_uploads(bucket);
CREATE INDEX IF NOT EXISTS idx_file_uploads_created_at ON public.file_uploads(created_at DESC);

-- Disable RLS
ALTER TABLE public.file_uploads DISABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE public.file_uploads IS 'Tracks all file uploads by users to Supabase Storage.';
COMMENT ON COLUMN public.file_uploads.user_id IS 'Foreign key to users table. The user who uploaded the file.';
COMMENT ON COLUMN public.file_uploads.bucket IS 'The Supabase Storage bucket where the file is stored.';
