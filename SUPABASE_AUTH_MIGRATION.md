# Supabase Auth Migration Guide

## Overview

This project has been migrated from **Firebase Authentication** to **Supabase Authentication** with **Google Sign-In integration**.

This ensures:

- ✅ Unified authentication system (Supabase auth is the source of truth)
- ✅ Correct user data correlation (no firebase_uid mismatches)
- ✅ Row Level Security (RLS) working properly
- ✅ Google Sign-In integration via Supabase OAuth
- ✅ Session management handled by Supabase

---

## What Changed

### Database Schema

- **Column renamed**: `users.firebase_uid` → `users.auth_uid`
- **Type**: VARCHAR(255) → UUID (matches Supabase's auth system)
- **Migration**: Run [012_migrate_to_supabase_auth.sql](../migrations/012_migrate_to_supabase_auth.sql)

### Backend Changes

#### 1. Authentication Middleware

**Removed**: `server/middleware/auth.js` (Firebase tokens)  
**Added**: `server/middleware/supabaseAuth.js`

- Verifies Supabase JWT tokens via `supabase.auth.getUser()`
- Extracts `sub` claim (same as `auth_uid`)
- Validates admin status via `admin_emails` table

#### 2. API Routes (`server/routes/auth.js`)

**Replaced entire file with Supabase-native flow:**

| Endpoint                  | Old Behavior         | New Behavior                                |
| ------------------------- | -------------------- | ------------------------------------------- |
| `POST /auth/register`     | Accepted email only  | Creates Supabase auth user + profile        |
| `POST /auth/login`        | Backend token issue  | Supabase.auth.signInWithPassword            |
| `POST /auth/sync-user`    | Expected firebaseUid | Validates Supabase token, syncs profile     |
| `GET /auth/me`            | Not authenticated    | Requires Bearer token, returns user + roles |
| `POST /auth/request-role` | Firebase middleware  | Supabase auth middleware                    |

#### 3. Token Verification

**Old**: Firebase Admin SDK + `getIdToken()`  
**New**: Supabase JWT + `supabase.auth.getUser(access_token)`

```js
// server/middleware/supabaseAuth.js
const { data, error } = await supabase.auth.getUser(accessToken);
// data.user contains: id, email, user_metadata, app_metadata
```

#### 4. Environment Variables

**Removed from server/.env**:

```env
❌ FIREBASE_SERVICE_ACCOUNT_PATH=...
❌ ALLOW_FIREBASE_VERIFY_BYPASS=true
```

**No new server env vars needed** - Supabase credentials already in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Frontend Changes

#### 1. AuthContext (`src/context/AuthContext.tsx`)

**Removed Firebase dependencies:**

```
❌ import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth"
❌ import { auth } from "../lib/firebase"
```

**Added Supabase auth:**

```tsx
✅ import { supabase } from "../lib/supabase"
✅ await supabase.auth.signInWithPassword({ email, password })
✅ await supabase.auth.signUp({ email, password })
✅ await supabase.auth.signInWithOAuth({ provider: "google" })
✅ supabase.auth.onAuthStateChange((event, session) => { ... })
```

#### 2. User Data Model

**Before:**

```tsx
interface AppUser {
  uid: string; // Firebase UID
  email: string;
  displayName: string;
  roles: string[];
  supabaseId?: string; // Separate UUID
}
```

**After:**

```tsx
interface AppUser {
  id: string; // Supabase users.id UUID
  auth_uid: string; // Supabase auth.users.id (same as id)
  email: string;
  display_name: string;
  roles: string[];
  isComposer?: boolean;
}
```

#### 3. Token Handling

**Old**: Firebase `user.getIdToken()`  
**New**: `supabase.auth.getSession()` → `session.access_token`

```tsx
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token; // JWT from Supabase
```

### Package Updates

#### Backend (`server/package.json`)

```json
- "firebase-admin": "^12.0.0"
+ "google-auth-library": "^9.11.0"
```

#### Frontend (`src/package.json`)

```json
- "firebase": "^x.x.x"  // Not used anymore; can be removed
```

---

## Migration Steps

### 1. Database Migration

```bash
# Run migrations in order
psql -h <supabase-host> -U postgres -d postgres -f migrations/012_migrate_to_supabase_auth.sql
```

This will:

- Rename `firebase_uid` → `auth_uid`
- Update RLS policies to use UUID comparison
- Add missing columns: `is_active`, `phone`, `composer_request`
- Create proper indexes

### 2. Backend Setup

```bash
cd server

# Install new dependencies
npm uninstall firebase-admin
npm install google-auth-library

# Start server
npm run dev
```

### 3. Frontend Setup

```bash
# Install/rebuild dependencies
npm install

# google-auth-library is server-only, no frontend dependency needed
```

### 4. Testing

#### Test Email/Password Signup

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "displayName": "Test User"
  }'
```

#### Test Google Sign-In (via Frontend)

1. Click "Sign in with Google"
2. OAuth redirect to Supabase
3. Verify `auth_uid` is populated in users table

#### Test Protected Endpoint

```bash
# Get token from /api/auth/login response
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

---

## Troubleshooting

### Error: "Invalid or expired token"

**Cause**: Token verification failed  
**Fix**: Ensure Bearer token is from Supabase auth, not Firebase

### Error: "auth_uid not found / column not exists"

**Cause**: Migration not run  
**Fix**: Run migration 012 on your Supabase database

### Error: "User profile not found after sync"

**Cause**: User exists in auth but not in users table  
**Fix**: Call `POST /api/auth/sync-user` after signup to create profile

### RLS Policy Violations

**Cause**: Old firebase_uid::text comparison in RLS policies  
**Fix**: Run migration 012 which updates all RLS policies

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│             Frontend (React)                    │
│                                                 │
│  1. User clicks "Sign in with Google"           │
│  2. initGoogleSignIn() → Google OAuth consent  │
│     OR supabaseAuth.signInWithOAuth()          │
│                                                 │
│  3. Auth redirects to /auth/callback            │
│  4. AnthContext receives session               │
│  5. getAuthToken() extracts JWT               │
└─────────────────────────────────────────────────┘
                      ↓
        ┌─────────────────────────────┐
        │   Supabase Auth             │
        │   (OAuth Provider)          │
        │                             │
        │  - Manages sessions        │
        │  - Issues JWTs             │
        │  - Stores auth.users       │
        └─────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│         Backend (Node.js)                       │
│                                                 │
│  1. Receive Authorization: Bearer <jwt>        │
│  2. verifySupabaseToken() middleware           │
│  3. Extract req.supabaseUser.id (auth_uid)    │
│  4. Query users table by auth_uid              │
│  5. Return user + roles                        │
└─────────────────────────────────────────────────┘
                      ↓
        ┌─────────────────────────────┐
        │  Supabase Database          │
        │                             │
        │  users.auth_uid = auth.id   │
        │  users.roles (via          │
        │    user_roles + roles)      │
        │                             │
        │  RLS: auth.uid() = auth_uid │
        └─────────────────────────────┘
```

---

## Security Notes

✅ **All JWT tokens signed by Supabase** - signature verified server-side  
✅ **No firebase-admin keys exposed** - Supabase handles key rotation  
✅ **RLS enforces user isolation** - `auth.uid() = auth_uid` policy  
✅ **Email is unique constraint** - prevents account takeover  
✅ **Admin role verified server-side** - email matching via admin_emails table

---

## Rollback Plan (if needed)

If issues arise, you can temporarily revert by:

1. Keep both FirebaseAuth and Supabase auth code paths
2. Check `X-Auth-Provider` header to route to correct middleware
3. Sync data bi-directionally until confident

However, **migration forward is recommended** - Firebase dependency increases security risk.

---

## Next Steps

1. ✅ Run migration 012
2. ✅ Deploy backend with new auth routes
3. ✅ Deploy frontend with new AuthContext
4. ✅ Test signup, login, Google Sign-In
5. ✅ Monitor logs for any auth failures
6. ⏳ Plan Firebase cleanup (after confidence period)
