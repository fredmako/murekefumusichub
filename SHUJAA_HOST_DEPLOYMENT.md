# Shujaa Host Deployment Guide (React + Node + Supabase)

This project is now prepared for production hosting with:
- frontend API defaulting to same-origin `/api` in production
- backend CORS support for single or multiple allowed origins
- optional static serving from `dist/` via `SERVE_STATIC=true`

If you are switching from Node/Express to Laravel backend, use:
- `LARAVEL_BACKEND_SETUP.md`
- `laravel-backend/` as your backend app root

Use one of the deployment paths below based on your Shujaa package.

## 1) Local Build (required)

From project root:

```bash
npm install
npm run build
```

From `server/`:

```bash
cd server
npm install --omit=dev
```

## 2) Frontend Env (`.env.local`)

Use:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_API_BASE_URL=/api
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
VITE_ADMIN_IDENTIFIERS=admin@example.com
```

Then rebuild frontend (`npm run build`) so `dist/` contains production values.

## 3) Backend Env (`server/.env`)

Use:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET=YOUR_SUPABASE_JWT_SECRET
PORT=3001
SERVE_STATIC=true
CORS_ORIGIN=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
ADMIN_IDENTIFIERS=admin@example.com
```

`CORS_ORIGIN` and `ALLOWED_ORIGINS` are both supported (comma-separated allowed).

## 4) Path A: If Shujaa Has Node.js App Manager (recommended)

1. Upload the full project to hosting (keep both `server/` and `dist/`).
2. In cPanel, open `Setup Node.js App`.
3. Create app with:
   - Application root: `<project>/server`
   - Startup file: `index.js`
   - Node version: 18+ (20+ preferred)
4. Add env vars from `server/.env` in app settings.
5. Ensure built frontend exists at `<project>/dist` (one level above `server/`).
6. Restart the Node app.
7. Verify:
   - `https://your-domain.com/health`
   - `https://your-domain.com/api/health`

This runs frontend and API on one domain:
- frontend: `/`
- api: `/api/*`

## 5) Path B: If Shujaa Package Does Not Support Node.js

1. Host frontend static files (`dist/`) on Shujaa (`public_html`).
2. Host backend (`server/`) on a Node host (Render/Railway/VPS).
3. Set frontend env:
   - `VITE_API_BASE_URL=https://api.your-domain.com/api`
4. Rebuild frontend and upload updated `dist/`.
5. Set backend CORS to allow frontend domain.

For React SPA routing on Apache static hosting, place this in `public_html/.htaccess`:

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

## 6) Supabase Production Checks

1. Apply latest SQL migrations in `migrations/` (or `supabase/migrations/`).
2. In Supabase Auth URL settings:
   - Site URL: `https://your-domain.com`
   - Redirect URLs:
     - `https://your-domain.com/auth/callback`
     - `https://your-domain.com/reset-password`
3. Confirm storage buckets and policies are production-ready.

## 7) Quick Troubleshooting

- `CORS blocked`:
  - Check `CORS_ORIGIN` / `ALLOWED_ORIGINS` exactly match protocol + domain.
- Frontend loads, API 404:
  - Ensure API is mounted under `/api` and `VITE_API_BASE_URL` is correct.
- API works, frontend routes 404 on refresh:
  - Ensure SPA rewrite (`.htaccess`) or Express static fallback is enabled.
