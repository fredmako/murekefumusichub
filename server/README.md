# Sync Server

This small server provides endpoints to sync users from Firebase Auth into Supabase.

Environment
- `SUPABASE_URL` - Your Supabase project URL (e.g. https://xyz.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase **service role** key (sensitive). Required.
- `FIREBASE_SERVICE_ACCOUNT` - (optional) JSON content of the Firebase service account. Use either this or `FIREBASE_SERVICE_ACCOUNT_PATH`.
- `FIREBASE_SERVICE_ACCOUNT_PATH` - (optional) Path to a local service account JSON file.
- `PORT` - Optional server port (default `3001`).

Install

```powershell
cd server
npm install
```

Run

```powershell
# development (auto-restart)
npm run dev
# or
npm start
```

Health

GET `/health`

Sync endpoints
- POST `/api/sync-user` - body: `{ firebaseUid, email, displayName?, phone?, avatarUrl?, role? }`
- POST `/api/sync-users-batch` - body: `{ users: [ { firebaseUid, email, ... } ] }`
- POST `/api/sync-from-firebase` - body: `{ maxResults?: number }` - lists users from Firebase Auth and syncs them into Supabase (requires Firebase service account configured)
- POST `/sync-user` - alias kept for compatibility with frontend/ngrok callers

Examples

PowerShell - health:
```powershell
Invoke-RestMethod http://localhost:3001/health
```

PowerShell - sync a single user (alias path):
```powershell
Invoke-RestMethod -Uri 'http://localhost:3001/sync-user' -Method Post -Body (ConvertTo-Json @{firebaseUid='uid'; email='me@example.com'}) -ContentType 'application/json'
```

PowerShell - sync from Firebase (first N users):
```powershell
Invoke-RestMethod -Uri 'http://localhost:3001/api/sync-from-firebase' -Method Post -Body (ConvertTo-Json @{maxResults=100}) -ContentType 'application/json'
```

Security
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret. Do not commit `.env` with real keys.
- Consider running this server in a secure environment; restrict access to the endpoints.

Troubleshooting
- If you see CORS errors from the browser, ensure the server is running and reachable through your tunnel (ngrok). The server returns CORS headers for any origin.
- If Supabase returns authentication/permission errors, confirm the `SUPABASE_SERVICE_ROLE_KEY` is a valid service role key.

License: MIT# Murekefu Sync Server

A Node.js/Express server that syncs Firebase users to Supabase, with support for role assignment and batch operations.

## Setup

### 1. Install dependencies
```bash
cd server
npm install
```

### 2. Set environment variables
Create a `.env` file in the `server/` folder:
```
SUPABASE_URL=https://your-supabase-instance.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Important:** The `SUPABASE_SERVICE_ROLE_KEY` is sensitive and should never be committed to Git. It's used server-side to bypass row-level security policies.

### 3. Run the server locally
```bash
npm start
```

The server will start on `http://localhost:3001`.

### 4. Expose via ngrok
In a new terminal:
```bash
ngrok http 3001
```

ngrok will output a URL like `https://abc123.ngrok.io`. Use this as your `VITE_API_BASE_URL` in the frontend.

### 5. Update frontend environment
In your frontend `.env` or `.env.local`:
```
VITE_API_BASE_URL=https://abc123.ngrok.io
```

## Endpoints

### Health Check
```
GET /health
```
Returns: `{ status: 'ok', message: 'Server is running' }`

### Sync Single User
```
POST /api/sync-user

Request body:
{
  "firebaseUid": "user_firebase_id",
  "email": "user@example.com",
  "displayName": "User Name",        // optional
  "phone": "+1234567890",            // optional
  "avatarUrl": "https://...",        // optional
  "role": "buyer"                    // optional: 'buyer' | 'composer' | 'admin'
}

Response:
{
  "id": "uuid-of-user",
  "firebaseUid": "user_firebase_id",
  "email": "user@example.com",
  "role": "buyer",
  "message": "User synced successfully"
}
```

### Batch Sync Users
```
POST /api/sync-users-batch

Request body:
{
  "users": [
    {
      "firebaseUid": "user1_id",
      "email": "user1@example.com",
      "role": "buyer"
    },
    {
      "firebaseUid": "user2_id",
      "email": "user2@example.com",
      "role": "composer"
    }
  ]
}

Response:
{
  "total": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    { "firebaseUid": "user1_id", "email": "user1@example.com", "id": "uuid1", "status": "success" },
    { "firebaseUid": "user2_id", "email": "user2@example.com", "id": "uuid2", "status": "success" }
  ]
}
```

## Development

Watch mode (auto-restart on file changes):
```bash
npm run dev
```

## How It Works

1. **Client sends request** to `/api/sync-user` with Firebase user details
2. **Server validates** the request and checks if user exists in Supabase
3. **If user exists**: Updates their profile info
4. **If user is new**: Creates a new user record with the service role key (bypasses RLS)
5. **Assigns role**: If a role is specified, creates the role assignment and related records
6. **Returns success** with the Supabase user ID

This approach allows the frontend to work with row-level security policies while still being able to create and manage users on the backend.
