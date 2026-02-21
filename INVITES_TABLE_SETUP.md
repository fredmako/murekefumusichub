# Invites Table Setup

The email-based composer invites feature requires a new `invites` table in Supabase.

## Quick Setup

### Option 1: Using SQL Editor in Supabase Dashboard (Recommended)

1. Go to your Supabase dashboard: https://app.supabase.com
2. Navigate to **SQL Editor** → **New Query**
3. Copy and paste the SQL from `migrations/001_create_invites_table.sql`
4. Click **Run**

### Option 2: Run Migration Script

```bash
# From project root
npm run migration:up
# or
supabase migration up
```

## Table Schema

```sql
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  requested_role VARCHAR(50) NOT NULL DEFAULT 'composer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMP WITH TIME ZONE
);
```

## Row Level Security (RLS)

The table includes RLS policies that:

- Allow admins to view, insert, and delete invites
- Allow users to view their own invite (if invited to them)

## Features

- **Email-based invitations**: Admins can invite people by email address
- **Tracking**: Records who invited whom and when
- **Usage tracking**: Records when an invite was used and by whom
- **Unique emails**: Each email can only have one active invite

## How It Works

1. **Admin sends invite**: Admin clicks "Add Composer Invite" and enters an email
2. **Invite created**: Entry created in `invites` table with `used: false`
3. **User signs up**: When someone signs up with that email, the app:
   - Detects the invite
   - Automatically grants them the composer role
   - Marks the invite as `used: true`

## API Integration

When implementing signup/login, check for invites:

```typescript
// After successful auth
const { data: invite } = await supabase
  .from("invites")
  .select("*")
  .eq("email", userEmail)
  .eq("used", false)
  .maybeSingle();

if (invite) {
  // Auto-grant composer role or mark as used
  await supabase
    .from("invites")
    .update({
      used: true,
      used_by: userId,
      used_at: new Date().toISOString(),
    })
    .eq("id", invite.id);
}
```

## Troubleshooting

**Error: "Could not find the 'invites' table"**

- The table hasn't been created yet. Run the SQL setup above.

**Error: "new row violates row-level security policy"**

- Make sure you're logged in as an admin user
- Check that the authenticated user has `'admin'` in their `roles` array

**Duplicate key error when inviting**

- That email already has an active invite
- Either revoke the old invite or wait for the user to sign up
