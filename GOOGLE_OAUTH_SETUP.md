# Google OAuth Setup

## Configuration Complete ✅

Your project is now configured to use **Google Sign-In** instead of Firebase.

### Credentials

- **Client ID**: `[REDACTED - Store in environment variables]`
- **Client Secret**: `[REDACTED - Store in environment variables]`

### Files Updated

#### Frontend (`.env.local`)

```env
VITE_GOOGLE_CLIENT_ID=[REDACTED - Store in environment variables]
```

#### Backend (`server/.env`)

```env
GOOGLE_CLIENT_ID=[REDACTED - Store in environment variables]
GOOGLE_CLIENT_SECRET=[REDACTED - Store in environment variables]
```

#### HTML (`index.html`)

- Added Google Identity Services script tag:
  ```html
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  ```

#### New Files Created

1. **`src/lib/googleAuth.ts`** - Frontend Google Sign-In helper
   - `initializeGoogleSignIn()` - Initialize GIS with callback
   - `promptGoogleSignIn()` - Show native sign-in prompt
   - `getGoogleToken()` - Get current ID token
   - `getCurrentGoogleUser()` - Get current user info

2. **`server/lib/googleTokenVerifier.js`** - Backend token verification
   - `verifyGoogleToken()` - Verify JWT token using google-auth-library
   - `extractUserInfo()` - Parse user claims from token

3. **`server/middleware/googleAuth.js`** - Auth middleware
   - `verifyGoogleToken_Middleware()` - Verify tokens on each request
   - `adminOnly()` - Check admin status

#### Package Updates

**Backend (`server/package.json`)**

- ✅ Added: `google-auth-library@9.11.0`
- ✅ Removed: `firebase-admin` (no longer needed)
- ✅ Removed: `ALLOW_FIREBASE_VERIFY_BYPASS` from `.env`

### Next Steps

1. **Install dependencies**:

   ```bash
   cd server
   npm install
   ```

2. **Update AuthContext** - Refactor `src/context/AuthContext.tsx` to:
   - Import `initializeGoogleSignIn()` instead of Firebase
   - Replace Firebase auth calls with Google Sign-In calls
   - Use `google_sub` instead of `firebase_uid` for user identification

3. **Update database schema** - Run migration to rename:

   ```sql
   ALTER TABLE users RENAME COLUMN firebase_uid TO google_sub;
   ALTER INDEX idx_users_firebase_uid RENAME TO idx_users_google_sub;
   ```

4. **Update file_uploads table**:

   ```sql
   ALTER TABLE file_uploads RENAME COLUMN firebase_uid TO google_sub;
   ```

5. **Update API calls** - Any endpoints currently using `req.firebaseDecoded` should use:
   - `req.googleDecoded` (full payload)
   - `req.googleUser` (extracted user info with `googleSub`, `email`, `name`, `picture`)

6. **Remove Firebase dependencies** from frontend:
   ```bash
   npm uninstall firebase
   ```

### Auth Flow

```
User clicks "Sign in with Google"
  ↓
GIS opens OAuth consent screen (or uses existing Google session)
  ↓
User grants permission
  ↓
GIS returns ID token JWT
  ↓
Frontend extracts `sub` claim (Google user ID)
  ↓
Frontend sends token to backend in Authorization header
  ↓
Backend verifies token signature using Google's public keys
  ↓
Backend extracts claims and syncs user to Supabase
  ↓
User is authenticated and can make API requests
```

### Documentation Updates

- ✅ `SYSTEM_DOCUMENTATION.md` - Updated Firebase section → Google Sign-In section
- ✅ `COMPOSER_SYSTEM_ARCHITECTURE.md` - Updated login flows to reference Google Sign-In

### Security Notes

- All tokens are verified server-side using Google's public keys
- Never expose `GOOGLE_CLIENT_SECRET` to the frontend
- The frontend only needs `VITE_GOOGLE_CLIENT_ID`
- User IDs are now based on Google's `sub` claim (globally unique, non-reassignable)
