# Composer System Database Architecture

## Overview

This document describes the new composer registration, authentication, and dashboard system with proper database relationships.

## Database Schema

### Core Tables

#### 1. `users` (Already exists)

- **Purpose**: Stores all user accounts (synced from Firebase)
- **Key Columns**:
  - `id` (UUID) - Primary key
  - `firebase_uid` (TEXT) - Firebase authentication UID
  - `email` (VARCHAR) - Email address
  - `display_name` (VARCHAR) - User's display name
  - `phone` (VARCHAR) - Phone number
  - `avatar_url` (TEXT) - URL to avatar in Supabase Storage
  - `created_at` (TIMESTAMP) - Account creation date
  - `updated_at` (TIMESTAMP) - Last update date

#### 2. `composers` (NEW - Migration 005)

- **Purpose**: Registers approved composers
- **Relationships**:
  - `user_id` (UUID, FK to `users.id`) - **Unique constraint** ensures one-to-one relationship
- **Key Features**:
  - No duplicate composer data (display_name, email, etc.)
  - All user info fetched directly from `users` table
  - Automatic creation when admin approves composer request
- **Queries**: To get composer with user info:
  ```sql
  SELECT c.id, c.created_at, u.display_name, u.email, u.avatar_url
  FROM composers c
  JOIN users u ON c.user_id = u.id
  WHERE c.user_id = $1;
  ```

#### 3. `compositions` (NEW - Migration 006)

- **Purpose**: Stores all compositions (sheet music)
- **Relationships**:
  - `composer_id` (UUID, FK to `composers.id`) - One-to-many relationship
- **Key Columns**:
  - `id` (UUID) - Primary key
  - `composer_id` (UUID) - Foreign key to composers
  - `title` (VARCHAR) - Composition title
  - `description` (TEXT) - Detailed description
  - `price` (DECIMAL) - Price in USD
  - `difficulty` (VARCHAR) - e.g., "Beginner", "Intermediate", "Advanced"
  - `duration` (VARCHAR) - e.g., "5 minutes"
  - `language` (VARCHAR) - e.g., "English", "Latin"
  - `accompaniment` (VARCHAR) - e.g., "Piano", "A cappella"
  - `voice_parts` (TEXT[]) - Array of voice parts ["Soprano", "Alto", etc.]
  - `pdf_url` (TEXT) - URL to PDF in Supabase Storage
  - `is_published` (BOOLEAN) - Publication status
  - `deleted` (BOOLEAN) - Soft delete flag
  - `created_at` (TIMESTAMP) - Upload date
  - `updated_at` (TIMESTAMP) - Last update date

#### 4. `composition_stats` (NEW - Migration 007)

- **Purpose**: Tracks statistics for compositions
- **Relationships**:
  - `composition_id` (UUID, FK to `compositions.id`) - **Unique constraint** for one-to-one relationship
- **Key Columns**:
  - `views` (INT) - Number of views
  - `purchases` (INT) - Number of purchases

#### 5. `purchases` (NEW - Migration 008)

- **Purpose**: Records composition purchases
- **Relationships**:
  - `buyer_id` (UUID, FK to `users.id`) - Who bought it
  - `composition_id` (UUID, FK to `compositions.id`) - What was bought
- **Key Columns**:
  - `price_paid` (DECIMAL) - Amount paid
  - `is_active` (BOOLEAN) - Purchase status
  - `purchased_at` (TIMESTAMP) - Purchase date

#### 6. `file_uploads` (NEW - Migration 009)

- **Purpose**: Tracks all uploaded files (PDFs, avatars, thumbnails)
- **Relationships**:
  - `user_id` (UUID, FK to `users.id`) - Who uploaded it
- **Key Columns**:
  - `bucket` (VARCHAR) - Storage bucket name
  - `file_path` (VARCHAR) - Path in storage
  - `storage_url` (TEXT) - Public URL

#### 7. `roles` (Already exists)

- **Purpose**: Defines available roles (admin, composer, buyer, etc.)

#### 8. `user_roles` (Already exists)

- **Purpose**: Maps users to roles (many-to-many relationship)
- **Relationships**:
  - `user_id` (FK to `users.id`)
  - `role_id` (FK to `roles.id`)

---

## Composer Workflow

### 1. Composer Registration

```
User requests "Composer" role
  ↓
Admin approves via Admin Panel
  ↓
System automatically:
  - Updates role_requests.status = "approved"
  - Creates user_roles entry with "composer" role
  - Creates composers entry with user_id
```

### 2. Composer Login Flow

```
User logs in (Firebase auth)
  ↓
Backend syncs user to Supabase
  ↓
Frontend checks composers table
  ↓
If composer found (isComposer = true):
  → Redirect to /composer dashboard
Else if admin role:
  → Redirect to /admin dashboard
Else:
  → Stay on /manage-account or redirect to /buyer dashboard
```

### 3. Composer Upload Composition

```
User clicks "Upload New Composition"
  ↓
Upload form submitted with:
  - Title, price, description, difficulty, etc.
  - PDF file
  ↓
Backend:
  1. Upload PDF to Supabase Storage (compositions bucket)
  2. Get Supabase user ID from Firebase UID
  3. Get composer ID from composers table
  4. Insert composition record with composer_id
  5. Create composition_stats entry
  ↓
Frontend:
  1. Displays success message
  2. Closes upload dialog
  3. Refetches composer data
  4. "Published Works" count increments
```

### 4. Composer Dashboard Display

```
Dashboard fetches:
  - User UUID from Firebase UID
  - Composer ID from composers table
  - Compositions where composer_id = that composer's ID
  - Composition stats and purchase data
  ↓
Displays:
  - Total Revenue (from purchases)
  - Published Works count (from compositions)
  - Average Price
  - Composition table with stats
```

---

## Database Relationships Diagram

```
users (1) ←─→ (1) composers ←─ (N) compositions
  ↓                               ├─→ (1) composition_stats
  └─ (N) purchases ←─ (N) compositions
  ├─ (N) user_roles
  ├─ (N) file_uploads
  └─ (N) role_requests

roles (1) ←─→ (N) user_roles
```

---

## Key Design Principles

1. **No Data Duplication**:
   - Composers don't store display_name, email (stored in users table)
   - Query using JOINs to get full composer info

2. **One-to-One Relationships**:
   - Each user can have at most one composer record (UNIQUE constraint on user_id)
   - Each composition has one stats record

3. **Soft Deletes**:
   - Compositions use `deleted = false` flag instead of hard deletion
   - Maintains history and referential integrity

4. **Role-Based Access**:
   - Roles table defines available roles
   - user_roles table handles many-to-many assignments
   - Frontend checks roles for UI rendering

5. **Storage Separation**:
   - PDFs stored in Supabase Storage (compositions bucket)
   - URLs stored in compositions table for retrieval

---

## Migration Execution

Run migrations in order in Supabase SQL Editor:

1. `001_create_invites_table.sql`
2. `002_create_role_requests_table.sql`
3. `003_add_users_updated_at.sql`
4. `004_create_admin_emails_table.sql`
5. `005_create_composers_table.sql` ✨ NEW
6. `006_create_compositions_table.sql` ✨ NEW
7. `007_create_composition_stats_table.sql` ✨ NEW
8. `008_create_purchases_table.sql` ✨ NEW
9. `009_create_file_uploads_table.sql` ✨ NEW

---

## Common Queries

### Get Composer with User Info

```sql
SELECT c.id as composer_id, c.created_at as composer_since,
       u.id, u.email, u.display_name, u.avatar_url
FROM composers c
JOIN users u ON c.user_id = u.id
WHERE c.user_id = $1;
```

### Get Composer's Compositions

```sql
SELECT c.id, c.title, c.description, c.price,
       c.is_published, c.created_at,
       cs.views, cs.purchases
FROM compositions c
LEFT JOIN composition_stats cs ON c.id = cs.composition_id
WHERE c.composer_id = $1 AND c.deleted = false
ORDER BY c.created_at DESC;
```

### Get Composer's Revenue

```sql
SELECT COALESCE(SUM(p.price_paid), 0) as total_revenue,
       COUNT(p.id) as total_sales
FROM purchases p
JOIN compositions c ON p.composition_id = c.id
WHERE c.composer_id = $1 AND p.is_active = true;
```

### Check if User is Composer

```sql
SELECT EXISTS (
  SELECT 1 FROM composers
  WHERE user_id = $1
) as is_composer;
```

---

## Frontend Changes

### AuthContext (`src/context/AuthContext.tsx`)

- Added `isComposer` field to AppUser
- Added `supabaseId` (UUID) for database queries
- Added `checkComposerStatus()` function
- Updated login/signup to check composer status
- Removed automatic redirects (handled in ManageAccount)

### ManageAccount (`src/app/components/ManageAccount.tsx`)

- Added redirect effect that checks user role
- Redirects composers to /composer dashboard
- Redirects admins to /admin dashboard
- Allows buyers to stay on manage-account

### ComposerDashboard (`src/app/components/ComposerDashboard.tsx`)

- Now properly fetches user UUID before querying databases
- Refetches data when upload dialog closes
- Displays all compositions and statistics

### UploadComposition (`src/app/components/UploadComposition.tsx`)

- Uploads PDF to Supabase Storage (not Firebase)
- Saves composition metadata to database
- Properly links to composer record

---

## Backend Changes

### Admin Routes (`server/routes/admin.js`)

- Enhanced `/promote-composer` to properly create composer record
- Added debug endpoint `/debug/compositions` for troubleshooting
- Updated stats endpoint with logging

---

## Testing Checklist

- [ ] Admin approves composer → composer record created
- [ ] Composer logs in → redirected to /composer dashboard
- [ ] Composer uploads composition → appears in dashboard
- [ ] Compositions appear in admin panel
- [ ] Revenue is calculated correctly
- [ ] Composer logout and login re-redirects to dashboard
- [ ] Regular users see buyer dashboard
- [ ] Admins see admin dashboard
