-- Add currency for composition pricing
ALTER TABLE public.compositions
ADD COLUMN IF NOT EXISTS price_currency VARCHAR(16) DEFAULT 'USD';

UPDATE public.compositions
SET price_currency = 'USD'
WHERE COALESCE(TRIM(price_currency), '') = '';

ALTER TABLE public.compositions
ALTER COLUMN price_currency SET DEFAULT 'USD';

ALTER TABLE public.compositions
ALTER COLUMN price_currency SET NOT NULL;

COMMENT ON COLUMN public.compositions.price_currency IS 'Currency code or label for composition price (e.g., USD, KES, EUR).';
