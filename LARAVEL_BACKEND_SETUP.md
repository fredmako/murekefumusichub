# Laravel Backend Migration (Shujaa Host)

This repo now includes a Laravel API backend at:

- `laravel-backend/`

It mirrors the existing Express API paths under `/api/*` so the frontend can keep using:

- `VITE_API_BASE_URL=/api`

## What was migrated

- Auth middleware with Supabase token verification
- Admin authorization checks
- API route groups for:
  - users/account/roles/request-role
  - compositions/uploads/categories
  - purchases/checkout
  - support chat/tickets
  - admin dashboards/actions
  - enrollments
  - media image endpoint

## Shujaa compatibility check

Laravel 12 requires PHP 8.2+.

Shujaa public pages still show legacy PHP version references in some places, so do not assume compatibility from marketing pages alone. Verify your exact cPanel account supports:

1. PHP 8.2 or newer
2. Composer access
3. PostgreSQL + `pdo_pgsql`

If your package only offers old PHP versions, use:

1. A Shujaa VPS, or
2. Another host for backend API and keep frontend on Shujaa

## Deploying Laravel backend

From `laravel-backend/`:

1. `composer install --no-dev --optimize-autoloader`
2. Copy `.env.example` to `.env`
3. Set DB + Supabase env values
4. `php artisan key:generate`
5. `php artisan config:cache`
6. Optional: `php artisan route:cache` only after replacing closure routes with controller actions

Point web root to:

- `laravel-backend/public`

## Database target

Use your existing Supabase PostgreSQL database (same schema/migrations already in this project).

Set in `.env`:

- `DB_CONNECTION=pgsql`
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `DB_SSLMODE=require`

## Frontend + API on one domain

If you want Laravel to also serve the built React app:

1. Build frontend at repo root: `npm run build` (creates `dist/`)
2. Set `SERVE_STATIC=true` in `laravel-backend/.env`

Laravel `routes/web.php` is configured to serve `../dist/index.html` when `SERVE_STATIC=true`.

## Notes

- Local validation in this environment could not run `php`/`composer` because they are not installed here.
- Code generation and route mapping were completed; run `composer install` + `php artisan route:list` on a PHP-capable machine/server to finalize runtime verification.
