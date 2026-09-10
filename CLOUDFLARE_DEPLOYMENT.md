# Cloudflare deployment

This repository uses an npm workspace so one root `npm ci` installs both the
Vite frontend and Express API dependencies. It deploys the Vite frontend and
the existing Express API together as a single Cloudflare Worker. `worker.js` sends `/api/*` and `/health` requests
to the Express application through Cloudflare's Node.js HTTP compatibility
layer. All other requests are served from the Vite `dist/` assets binding, with
single-page-app fallback enabled.

## Cloudflare Git integration settings

Create a **Workers** application (not a Pages application) connected to this
repository and use these settings:

- **Build command:** `npm ci && npm run build:cloudflare`
- **Deploy command:** `npx wrangler deploy`
- **Configuration file:** `wrangler.jsonc`
- **Worker entry point:** `worker.js`
- **Compatibility date:** keep the value in `wrangler.jsonc` current.
- **Compatibility flags:** `nodejs_compat`, `enable_nodejs_http_modules`, and
  `enable_nodejs_http_server_modules` (configured in `wrangler.jsonc`).

The `server` workspace is intentional: it makes API dependencies available to
Wrangler after a clean root install. Do not replace it with a separate server
install step.

`wrangler.jsonc` publishes `dist/` as Worker assets and configures SPA fallback.
Do not configure a separate static-site rewrite or a separate backend service:
the Worker owns both static and `/api/*` routing.

## Variables and secrets

Set the following in **Workers & Pages → Settings → Variables and Secrets** for
each environment. Values without the `VITE_` prefix are server-only Worker
secrets. Do not put service-role keys or API keys in a `VITE_` variable.

### Required

| Name | Type | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | plain variable | Supabase project URL used by the browser. |
| `VITE_SUPABASE_ANON_KEY` | plain variable | Supabase anonymous/public key used by the browser. |
| `SUPABASE_URL` | secret | Supabase project URL used by the API. |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | Supabase service-role key used by the API. |
| `SUPABASE_JWT_SECRET` | secret | JWT verification secret for protected API routes. |

### Configure when the related feature is enabled

- `CORS_ORIGIN` or `ALLOWED_ORIGINS`: allowed browser origins. Use the production
  hostname(s), comma-separated for `ALLOWED_ORIGINS`.
- `ADMIN_IDENTIFIERS`: comma-separated administrator emails or identifiers.
- `OPENAI_API_KEY`, optionally `OPENAI_MODEL`: AI-assisted composition/support
  features.
- `PEXELS_API_KEY`: media-search feature.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google integration.
- `MPESA_BUSINESS_NUMBER`, `MPESA_ACCOUNT_NO`, `MPESA_BUSINESS_NAME`, and
  `MPESA_PAYMENT_URL`: M-Pesa checkout configuration.
- `VITE_API_BASE_URL=/api`: optional; `/api` is the recommended same-origin
  value.
- `VITE_GOOGLE_CLIENT_ID`, `VITE_ADMIN_IDENTIFIERS`, and
  `VITE_AUTH_REDIRECT_BASE_URL`: browser-side configuration where applicable.

Use the same variable names in `.env.example` for local development. `PORT` and
`SERVE_STATIC` are local Express-server settings and are not used by the Worker.

## Validation

```bash
npm ci
npm run build
npm run test:server
npm run worker:validate
```

For a production deploy from a trusted shell with Cloudflare credentials:

```bash
npx wrangler deploy
```
