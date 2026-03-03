-- Migration 020: Normalize legacy signed avatar URLs to stable public avatar URLs.

UPDATE public.users
SET avatar_url = REGEXP_REPLACE(
  SPLIT_PART(avatar_url, '?', 1),
  '/storage/v1/object/sign/avatars/',
  '/storage/v1/object/public/avatars/'
)
WHERE avatar_url IS NOT NULL
  AND avatar_url LIKE '%/storage/v1/object/sign/avatars/%';

UPDATE public.users
SET avatar_url = REPLACE(
  REPLACE(
    REGEXP_REPLACE(
      SPLIT_PART(avatar_url, '?', 1),
      '/storage/v1/object/sign/avatars%2F',
      '/storage/v1/object/public/avatars/'
    ),
    '%2F',
    '/'
  ),
  '%2f',
  '/'
)
WHERE avatar_url IS NOT NULL
  AND avatar_url LIKE '%/storage/v1/object/sign/avatars%2F%';

-- Remove stale query strings from already-public avatar URLs.
UPDATE public.users
SET avatar_url = SPLIT_PART(avatar_url, '?', 1)
WHERE avatar_url IS NOT NULL
  AND avatar_url LIKE '%/storage/v1/object/public/avatars/%?%';
