# Cloudflare deployment

This repository deploys the Vite frontend and the Cloudflare Worker together.
The Worker (`worker.js`) serves both the built frontend assets and the `/api/*`
routes using D1 for persistence and Cloudflare-native JWT auth.

## Cloudflare Git integration settings

Create a **Workers** application connected to this repository and use these
settings:

- **Build command:** `npm ci && npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Worker entry point:** `worker.js`
- **Compatibility date:** keep the value current.
- **Compatibility flags:** `nodejs_compat` (configured in `wrangler.jsonc`).

The Worker owns both static asset serving and `/api/*` routing. Do not
configure a separate static-site rewrite or a separate backend service.

## Variables and secrets

Set the following in **Workers & Pages → Settings → Variables and Secrets**.
Values without the `VITE_` prefix are server-only Worker secrets.

### Required

| Name | Type | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | plain | Legacy — kept for frontend compatibility, no longer used. |
| `VITE_SUPABASE_ANON_KEY` | plain | Legacy — kept for frontend compatibility, no longer used. |
| `VITE_GOOGLE_CLIENT_ID` | plain | Google OAuth client ID for the frontend. |
| `VITE_ADMIN_IDENTIFIERS` | plain | Comma-separated admin email identifiers. |
| `JWT_SECRET` | secret | JWT signing/verification secret for auth tokens. |
| `GOOGLE_CLIENT_ID` | secret | Google OAuth client ID (server-side). |
| `GOOGLE_CLIENT_SECRET` | secret | Google OAuth client secret (server-side). |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | secret | Google service account for SEO indexing. |
| `ADMIN_IDENTIFIERS` | secret | Comma-separated admin identifiers (server-side). |

### Optional

- `OPENAI_API_KEY`, optionally `OPENAI_MODEL`: AI-assisted features.
- `PEXELS_API_KEY`: media-search feature.
- `MPESA_*`: M-Pesa checkout configuration.
- `VITE_API_BASE_URL=/api`: default same-origin API base (usually not needed).
