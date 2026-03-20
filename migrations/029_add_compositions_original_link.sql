ALTER TABLE public.compositions
  ADD COLUMN IF NOT EXISTS original_link TEXT;

COMMENT ON COLUMN public.compositions.original_link IS
  'External reference for arrangement source (e.g., YouTube link to original song).';
