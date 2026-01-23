# Prime Media - Backend Setup Guide

This guide will walk you through setting up the complete backend infrastructure for the Prime Media Choral Music Marketplace.

## Architecture Overview

The application uses a modern serverless architecture:

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Authentication**: Firebase Authentication
- **Database**: Supabase PostgreSQL
- **Storage**: Firebase Storage / Supabase Storage
- **Backend Logic**: Azure Functions (optional) or direct Supabase
- **Payments**: MPesa/Daraja or Stripe
- **SMS**: Azure Communication Services

## Prerequisites

- Node.js 18+ and pnpm/npm
- Firebase account and project
- Supabase account and project
- (Optional) Azure account for Functions and ACS
- (Optional) MPesa Developer account or Stripe account

---

## Step 1: Firebase Setup

### 1.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing "prime-media-7216b"
3. Enable Authentication with Email/Password
4. Enable Firebase Storage

### 1.2 Configure Firebase

Your Firebase config is already set in `/src/lib/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyCwI4aE5-p-NYm60p97IG0aKijccPI0sxI",
  authDomain: "prime-media-7216b.firebaseapp.com",
  projectId: "prime-media-7216b",
  storageBucket: "prime-media-7216b.firebasestorage.app",
  messagingSenderId: "497607749297",
  appId: "1:497607749297:web:d113e9a79fd1799f803c90",
  measurementId: "G-NFG3EB5Q7F"
};
```

### 1.3 Set up Storage Buckets

In Firebase Console > Storage, create these buckets:
- `compositions/` - for PDF/audio files
- `thumbnails/` - for composition thumbnails
- `avatars/` - for user profile pictures

---

## Step 2: Supabase Setup

### 2.1 Create Supabase Project

1. Go to [Supabase](https://supabase.com/)
2. Create a new project
3. Note your project URL and anon key

### 2.2 Run Database Setup

1. Go to Supabase SQL Editor
2. Copy the SQL from `/src/lib/supabase.ts` (DATABASE_SETUP_SQL constant)
3. Execute the SQL to create all tables, functions, and procedures

### 2.3 Set up Storage Buckets (if using Supabase Storage)

Create these public buckets:
- `compositions`
- `thumbnails`
- `avatars`

### 2.4 Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Step 3: Initialize Database with Sample Data

Run this SQL in Supabase to add sample categories:

```sql
-- Insert sample categories
INSERT INTO categories (name, description) VALUES
  ('Sacred Music', 'Music for worship and religious ceremonies'),
  ('Secular Music', 'Non-religious choral compositions'),
  ('Contemporary', 'Modern choral arrangements'),
  ('Classical', 'Traditional classical choral works'),
  ('Jazz/Pop', 'Jazz and popular music arrangements'),
  ('Folk/Traditional', 'Folk songs and traditional music'),
  ('Holiday/Seasonal', 'Christmas, Easter, and seasonal music'),
  ('Children''s Choir', 'Music specifically for children''s voices')
ON CONFLICT (name) DO NOTHING;
```

---

## Step 4: Azure Functions Setup (Optional - for Production)

### 4.1 Install Azure Functions Core Tools

```bash
npm install -g azure-functions-core-tools@4
```

### 4.2 Create Functions Project

```bash
mkdir azure-functions
cd azure-functions
func init --typescript
```

### 4.3 Create Functions

Create these Azure Functions:

#### Auth Sync Function (`auth-sync/index.ts`):
```typescript
import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import * as admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  try {
    // Verify Firebase token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      context.res = { status: 401, body: 'Unauthorized' };
      return;
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Sync user with Supabase
    const { data, error } = await supabase
      .from('users')
      .upsert({
        firebase_uid: decodedToken.uid,
        email: decodedToken.email,
        display_name: decodedToken.name,
      })
      .select()
      .single();

    if (error) throw error;

    context.res = {
      status: 200,
      body: data
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: error.message
    };
  }
};

export default httpTrigger;
```

---

## Step 5: Payment Integration

### Option A: MPesa/Daraja (Kenya)

1. Register at [Daraja Portal](https://developer.safaricom.co.ke/)
2. Get Consumer Key, Consumer Secret, and Passkey
3. Add to `.env`:

```env
VITE_PAYMENT_PROVIDER=mpesa
VITE_MPESA_CONSUMER_KEY=your-consumer-key
VITE_MPESA_CONSUMER_SECRET=your-consumer-secret
VITE_MPESA_PASSKEY=your-passkey
VITE_MPESA_SHORTCODE=your-shortcode
```

### Option B: Stripe

1. Create account at [Stripe](https://stripe.com/)
2. Get publishable key
3. Add to `.env`:

```env
VITE_PAYMENT_PROVIDER=stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## Step 6: SMS Integration (Azure Communication Services)

1. Create ACS resource in Azure Portal
2. Get connection string
3. Add to `.env`:

```env
VITE_SMS_PROVIDER=azure
VITE_ACS_CONNECTION_STRING=your-connection-string
VITE_SMS_FROM_NUMBER=+1234567890
```

---

## Step 7: Testing the Backend

### 7.1 Install Dependencies

```bash
pnpm install
```

### 7.2 Run Development Server

```bash
pnpm run dev
```

### 7.3 Test Authentication

1. Open the app in browser
2. Click "Quick Access" button for Buyer
3. Check Supabase dashboard for new user in `users` table

### 7.4 Verify Database Connection

Check browser console for any errors. You should see:
- Firebase authentication successful
- User synced to Supabase
- Role assigned

---

## Step 8: Deployment

### 8.1 Build Frontend

```bash
pnpm run build
```

### 8.2 Deploy to Vercel/Netlify

```bash
# Vercel
vercel deploy

# Netlify
netlify deploy --prod
```

### 8.3 Deploy Azure Functions

```bash
cd azure-functions
func azure functionapp publish <your-function-app-name>
```

---

## API Endpoints

### Authentication
- `POST /api/auth/sync-user` - Sync Firebase user with Supabase

### Compositions
- `GET /api/compositions` - List all compositions
- `GET /api/compositions/:id` - Get composition by ID
- `POST /api/compositions` - Create composition (composer only)
- `PUT /api/compositions/:id` - Update composition
- `DELETE /api/compositions/:id` - Delete composition

### Purchases
- `POST /api/purchases` - Create purchase
- `GET /api/purchases/buyer/:id` - Get buyer purchases
- `POST /api/purchases/:id/discard` - Refund purchase

### FYP (For You Page)
- `GET /api/fyp/:buyerId` - Get personalized recommendations

### Admin
- `GET /api/admin/stats` - Get platform statistics
- `GET /api/admin/reports` - Get all reports
- `POST /api/admin/reports/:id/resolve` - Resolve report

---

## Security Notes

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use service role key** only on server-side (Azure Functions)
3. **Validate all inputs** before database operations
4. **Rate limit** authentication endpoints
5. **Enable RLS** (Row Level Security) in Supabase for production

---

## Troubleshooting

### Firebase Authentication Errors

```
Error: auth/user-not-found
Solution: Click "Sign Up" to create account
```

### Supabase Connection Errors

```
Error: Failed to fetch
Solution: Check VITE_SUPABASE_URL in .env
```

### CORS Errors

```
Error: CORS policy blocked
Solution: Add your domain to Supabase allowed origins
```

---

## Next Steps

1. ✅ Set up Firebase Authentication
2. ✅ Configure Supabase database
3. ✅ Run database setup SQL
4. ✅ Add environment variables
5. ✅ Test authentication flow
6. ⬜ Set up payment provider
7. ⬜ Configure Azure Functions
8. ⬜ Set up SMS service
9. ⬜ Deploy to production

---

## Support

For issues or questions:
- Check `/SYSTEM_DOCUMENTATION.md` for system architecture
- Review this document's merge documentation in your original request
- Check Supabase logs for database errors
- Check Firebase console for auth issues

---

## Database Schema Quick Reference

**Users & Auth:**
- `users` - User accounts
- `roles` - Role definitions (buyer/composer/admin)
- `user_roles` - User-role mapping

**Content:**
- `categories` - Music categories
- `compositions` - Musical compositions
- `composition_stats` - View/purchase counts

**Transactions:**
- `purchases` - Purchase records
- `buyer_preferences` - User preferences for FYP

**Admin:**
- `reports` - Content reports
- `newsletters` - Newsletter campaigns
- `sms_logs` - SMS delivery logs
- `audit_logs` - System audit trail

---

## Quick Commands

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm run dev

# Build for production
pnpm run build

# Deploy Azure Functions
cd azure-functions && func azure functionapp publish prime-media-api

# Check Supabase status
npx supabase status

# Run Supabase migrations
npx supabase db push
```

---

**Last Updated:** January 24, 2026
**Version:** 1.0.0
