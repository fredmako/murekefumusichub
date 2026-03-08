DO $$
DECLARE
  arrangements_category_id BIGINT;
  compositions_category_id BIGINT;
BEGIN
  INSERT INTO public.categories (name, description)
  VALUES
    ('Arrangements', 'Adapted, reharmonized, or re-scored music for performance.'),
    ('Compositions', 'Original music compositions and choral works.')
  ON CONFLICT (name) DO UPDATE
    SET description = EXCLUDED.description;

  SELECT id INTO arrangements_category_id
  FROM public.categories
  WHERE lower(name) = 'arrangements'
  ORDER BY id
  LIMIT 1;

  SELECT id INTO compositions_category_id
  FROM public.categories
  WHERE lower(name) = 'compositions'
  ORDER BY id
  LIMIT 1;

  UPDATE public.compositions
  SET category_id = compositions_category_id
  WHERE category_id IS NOT NULL
    AND category_id NOT IN (arrangements_category_id, compositions_category_id);

  UPDATE public.buyer_preferences
  SET category_id = compositions_category_id
  WHERE category_id NOT IN (arrangements_category_id, compositions_category_id);

  DELETE FROM public.categories
  WHERE id NOT IN (arrangements_category_id, compositions_category_id);
END $$;
