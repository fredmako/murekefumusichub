ALTER TABLE public.compositions
ALTER COLUMN price_currency SET DEFAULT 'KES';

UPDATE public.compositions
SET price_currency = 'KES'
WHERE COALESCE(TRIM(price_currency), '') = ''
   OR UPPER(TRIM(price_currency)) <> 'KES';

COMMENT ON COLUMN public.compositions.price_currency IS
'Currency code for composition prices. Default is KES.';
