-- Migration 013: Add missing composition metadata columns used by frontend
-- Safe to run multiple times.

ALTER TABLE public.compositions
  ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50);

ALTER TABLE public.compositions
  ADD COLUMN IF NOT EXISTS language VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_compositions_difficulty
  ON public.compositions(difficulty);

CREATE INDEX IF NOT EXISTS idx_compositions_language
  ON public.compositions(language);

COMMENT ON COLUMN public.compositions.difficulty IS 'Difficulty level (e.g., Easy, Intermediate, Advanced)';
COMMENT ON COLUMN public.compositions.language IS 'Primary language of the composition';
