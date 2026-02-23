# Admin Emails Management

## Overview

The `admin_emails` table in Supabase stores email addresses that automatically receive admin privileges when they:

- **Register** a new account
- **Login** for the first time (sync-user)

This eliminates the need for manual admin role assignment through the admin panel.

## Migration

- **File:** `migrations/004_create_admin_emails_table.sql`
- **Tables Created:**
  - `admin_emails` - stores admin email addresses
- **Function Created:**
  - `is_admin_email()` - helper function to check if an email is an admin

## How It Works

### 1. **Registration**

When a user registers with an email in the `admin_emails` table:

```
Register → Check admin_emails table → Auto-assign admin role → User logs in as admin
```

### 2. **First Login (Google/Email)**

When a user logs in for the first time:

```
Login → /api/sync-user → Check admin_emails table → Auto-assign admin role → Session updated
```

### 3. **Database Table Structure**

```sql
admin_emails {
  id: UUID (primary key)
  email: VARCHAR(255) UNIQUE
  added_by: UUID (references users.id)
  added_at: TIMESTAMP
  notes: TEXT
  is_active: BOOLEAN
}
```

## Managing Admin Emails

### Add Admin Email (Via SQL)

```sql
INSERT INTO public.admin_emails (email, notes)
VALUES ('newadmin@example.com', 'New admin account');
```

### Remove Admin Email

```sql
UPDATE public.admin_emails
SET is_active = false
WHERE LOWER(email) = LOWER('admin@example.com');
```

### View All Admins

```sql
SELECT email, added_at, notes
FROM public.admin_emails
WHERE is_active = true
ORDER BY added_at DESC;
```

### Deactivate Admin

```sql
UPDATE public.admin_emails
SET is_active = false
WHERE email = 'admin@example.com';
```

## Default Admin

The migration includes one default admin email: `admin@example.com`

**IMPORTANT:** Update this in the migration before running it!

## Backend Implementation

### Files Updated

1. **server/routes/auth.js**
   - `/post/register` - checks admin_emails and assigns admin role
   - `/post/sync-user` - checks admin_emails and assigns admin role

### Logic Flow

```javascript
// When new user is created
if (adminEmail exists for this email) {
  - Fetch admin role from roles table
  - Insert user_id + admin_role_id into user_roles table
}
```

## Security Notes

- ✅ Table has RLS disabled (backend uses service role key)
- ✅ Email comparison is case-insensitive (LOWER() function)
- ✅ Only active admins (`is_active = true`) are recognized
- ✅ No app UI for managing this - use SQL directly or create admin UI later

## Future Enhancements

1. **Admin Panel UI** - Create a page to manage admin emails visually
2. **Audit Trail** - Log who added/removed admin emails and when
3. **Email Verification** - Send confirmation emails to new admins
4. **Deactivation Logs** - Track when admins were deactivated and why

## Troubleshooting

### Admin role not assigned after login

1. Check email case sensitivity:
   ```sql
   SELECT email FROM admin_emails WHERE is_active = true;
   ```
2. Verify email exactly matches (or fix with UPDATE)
3. Check if `is_active = true`
4. Check server logs for errors

### Admin lost role after logout/login

- Email was removed from `admin_emails` table
- Email was deactivated (`is_active = false`)
- User table was not synced properly

## Running the Migration

```bash
# Apply migration in Supabase
psql -U postgres -d your_db -f migrations/004_create_admin_emails_table.sql

# Or use Supabase Dashboard
# Go to SQL Editor → Create a new query → Paste the migration content
```
