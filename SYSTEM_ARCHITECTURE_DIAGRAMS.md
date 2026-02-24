# Composer System - Visual Architecture & Flows

## 1. Database Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COMPOSER SYSTEM DATABASE                         │
└─────────────────────────────────────────────────────────────────────────┘

                                    users
                            ┌───────────────┐
                            │  id (UUID)    │
                            │  firebase_uid │
                            │  email        │
                            │  display_name │
                            │  avatar_url   │
                            │  created_at   │
                            └───────┬───────┘
                                    │
                                    │ 1:1 (UNIQUE FK)
                                    │
                            ┌───────▼───────┐
                            │  composers    │
                            │  id (UUID)    │
                            │  user_id ◄────┼─ users.id
                            │  created_at   │
                            └───────┬───────┘
                                    │
                                    │ 1:N (FK)
                                    │
                    ┌───────────────▼───────────────┐
                    │     compositions           │
                    │  id (UUID)                 │
                    │  composer_id ◄─────────────┼─ composers.id
                    │  title                     │
                    │  price                     │
                    │  difficulty                │
                    │  voice_parts               │
                    │  pdf_url                   │
                    │  is_published              │
                    │  deleted                   │
                    │  created_at                │
                    └───┬────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        │ 1:1 (UNIQUE)  │               │ 1:N (FK)
        │               │               │
    ┌───▼──────┐    ┌───▼──────────┐   │
    │composition│    │  purchases   │   │
    │ _stats   │    │  id (UUID)   │   │
    │composition│    │  buyer_id ◄──────┼─ users.id
    │_id ◄──┐  │    │  composition │   │
    │views  │  │    │ _id ◄─────────┼───
    │purchases│ │    │  price_paid  │
    └────────┘ │    │  is_active   │
            │  │    │  purchased_at│
            └──┼────└──────────────┘
               │
        ┌──────┴───────────────────────┐
        │                              │
        │        Also has              │
        │      many-to-many           │
        │    relationships via:        │
        │   • user_roles              │
        │   • role_requests           │
        │   • file_uploads            │
        │   • invites                 │
        └──────────────────────────────┘
```

---

## 2. Composer Approval Workflow

```
╔═══════════════════════════════════════════════════════════════════╗
║              COMPOSER ROLE REQUEST & APPROVAL FLOW               ║
╚═══════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: User Requests Composer Role                            │
│  • User fills form + submits request                           │
│  • Creates role_requests entry:                               │
│    - user_id: <uuid>                                          │
│    - requested_role: "composer"                               │
│    - status: "pending"                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Admin Reviews Request                                   │
│  • Admin sees pending composer requests in Admin Panel         │
│  • Views request details                                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Admin Approves Composer                                 │
│  • Clicks "Approve" button for user                           │
│  • POST /api/admin/users/{userId}/promote-composer           │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
        ▼                           ▼
   ┌─────────────┐          ┌──────────────┐
   │ Update role_│          │ Assign roles │
   │ requests:  │          │ & badges:    │
   │ status=    │          │              │
   │"approved"  │          │ • Add to     │
   │            │          │   user_roles │
   │            │          │   (composer) │
   │            │          │              │
   └─────────────┘          └──────┬───────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Create Composer Record                              │
│  • INSERT into composers table:                            │
│    - id: gen_random_uuid()                                │
│    - user_id: <uuid>  (UNIQUE)                           │
│    - created_at: NOW()                                   │
│                                                          │
│  RESULT: ✅ Composer registered & ready                  │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 5: Composer Can Now Login                              │
│  • Logs in with Firebase credentials                      │
│  • AuthContext checks composers table                     │
│  • Sets isComposer = true                                │
│  • Redirects to /composer dashboard                      │
│                                                          │
│  ✅ System Ready for Composition Uploads                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Composer Login & Redirect Flow

```
╔═══════════════════════════════════════════════════════════════════╗
║                    COMPOSER LOGIN FLOW                            ║
╚═══════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────┐
│ 1. User enters credentials          │
│    • Email & password OR Google     │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌─────────────┐
        │ Firebase    │
        │ Auth        │
        └──────┬──────┘
               │
               │ ✅ Login successful
               │
               ▼
┌──────────────────────────────────────┐
│ 2. Backend syncs user to Supabase   │
│    • Creates/updates users table    │
│    • Returns Firebase UID + UUID    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Frontend queries composers table                         │
│    • SELECT 1 FROM composers                              │
│    • WHERE user_id = <supabase-uuid>                     │
│                                                          │
│    ✅ Found → isComposer = true                         │
│    ❌ Not found → isComposer = false                    │
└──────────────┬───────────────────────────────────────────────┘
               │
        ┌──────┴──────────────┐
        │                     │
        ▼                     ▼
   ┌──────────────┐      ┌─────────────────┐
   │ isComposer   │      │ Check roles in  │
   │= true        │      │ appUser.roles   │
   │              │      │ for "admin"     │
   └──────┬───────┘      └────────┬────────┘
          │                       │
          ▼                       ▼
     ┌─────────────┐         ┌──────────────┐
     │ Redirect:   │         │ Redirect:    │
     │ /composer   │         │ /admin       │
     │ dashboard   │         │ dashboard    │
     └─────────────┘         └──────────────┘
          │
          │ Else (regular buyer)
          ▼
     ┌─────────────────┐
     │ Stay on         │
     │ /manage-account │
     │ or go to /buyer │
     └─────────────────┘

      ✅ AUTOMATIC REDIRECT TO CORRECT DASHBOARD
```

---

## 4. Composition Upload Workflow

```
╔═══════════════════════════════════════════════════════════════════╗
║            COMPOSER UPLOADS NEW COMPOSITION                       ║
╚═══════════════════════════════════════════════════════════════════╝

┌────────────────────────────────────────────────────┐
│ 1. Composer clicks "Upload New Composition"       │
│    • Dialog opens with form                       │
│    • User fills in:                              │
│      - Title, Price, Description                │
│      - Difficulty, Duration, Language           │
│      - Accompaniment, Voice Parts               │
│      - PDF File                                 │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────┐
│ 2. Upload PDF to Supabase Storage                │
│    • Bucket: "compositions"                      │
│    • Path: "userId/timestamp_filename.pdf"     │
│    • Returns: public_url                        │
│    ✅ File now accessible                       │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────┐
│ 3. Get Supabase User ID                          │
│    • Query users table:                          │
│      SELECT id WHERE firebase_uid = <uid>      │
│    • Returns: <supabase-uuid>                   │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────┐
│ 4. Get Composer ID                               │
│    • Query composers table:                      │
│      SELECT id WHERE user_id = <uuid>          │
│    • Returns: <composer-id>                     │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────────────┐
│ 5. INSERT Composition into database                           │
│                                                              │
│    INSERT INTO compositions (                               │
│      composer_id,          ← <composer-id>                 │
│      title,                ← form data                      │
│      description,          ← form data                      │
│      price,                ← form data                      │
│      difficulty,           ← form data                      │
│      duration,             ← form data                      │
│      language,             ← form data                      │
│      accompaniment,        ← form data                      │
│      voice_parts,          ← form data (array)            │
│      pdf_url,              ← <public_url>                 │
│      is_published,         ← true                         │
│      deleted               ← false                        │
│    )                                                       │
│                                                            │
│    ✅ Composition recorded                               │
└──────────────────┬─────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. CREATE Composition Stats Entry                           │
│                                                            │
│    INSERT INTO composition_stats (                         │
│      composition_id,  ← returned id                       │
│      views,           ← 0                                 │
│      purchases        ← 0                                │
│    )                                                       │
│                                                            │
│    ✅ Stats initialized                                  │
└──────────────────┬─────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. Show Success Message & Close Dialog                      │
│    • Toast: "Composition uploaded successfully!"          │
│    • Close upload dialog after 1.5 seconds              │
└──────────────────┬─────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. Refetch Dashboard Data                                   │
│    • useEffect detects isUploadOpen changed to false       │
│    • Calls fetchComposerData()                            │
│    • Queries database for fresh composition list          │
│    • Updates state with new data                         │
│                                                            │
│    RESULT: Dashboard shows new composition!               │
│    ✅ "Published Works" count incremented                │
│    ✅ New composition visible in table                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Admin Panel View

```
╔════════════════════════════════════════════════════════════════╗
║              ADMIN PANEL - DASHBOARD VIEW                      ║
╚════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────┐
│ ADMIN OVERVIEW                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Total Users  │  │ Total Revenue│  │Compositions │          │
│  │   1,234      │  │   $45,678.90 │  │    5,678    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ TABS:                                                           │
│  [Overview] [Composers] [Compositions] [Purchases] [Invites]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ COMPOSITIONS TAB                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ID | Title | Composer | Price | Published | Actions   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 1  │Test Comp│John D │ $10.99│ Yes  │ [View] [Delete]│   │
│  │ 2  │Ave Maria│Jane S │ $15.99│ Yes  │ [View] [Delete]│   │
│  │ 3  │Halleluj│Bob J  │ $8.99 │ No   │ [View] [Delete]│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ COMPOSERS TAB                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Name | Email | Compositions | Revenue | Actions       │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │John D│john@… │      3       │ $1,234 │ [View]        │    │
│  │Jane S│jane@… │      2       │ $2,345 │ [View]        │    │
│  │Bob J │bob@…  │      1       │ $567   │ [View]        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Data flow:
  Admin Panel requests → /api/admin/compositions
                     → /api/admin/composers
                     → /api/admin/stats
                     → /api/admin/debug/compositions (debug mode)
```

---

## 6. Data Flow Architecture

```
╔════════════════════════════════════════════════════════════════╗
║                  COMPLETE APPLICATION FLOW                     ║
╚════════════════════════════════════════════════════════════════╝

FIREBASE                    SUPABASE                   APPLICATION
─────────────────────────────────────────────────────────────────

┌──────────────┐
│ Firebase     │
│ Auth         │  ├─ Creates/Verifies auth token
│ (Email/      │
│  Google)     │
└──────┬───────┘
       │
       │ getIdToken()
       │
       ▼
┌────────────────┐          ┌─────────────────┐
│ AuthContext    │  ────>   │ Backend /       │
│ (Frontend)     │  Token   │ sync-user       │
└────────────────┘  Check   └────────┬────────┘
     │              │               │
     │ isComposer?  │               │ Create user
     ▼              ▼               │ if needed
   ┌──────────────────────────────────────────────────────┐
   │          SUPABASE (PostgreSQL)                      │
   │                                                     │
   │  users ◄─────── roles ◄─────── user_roles          │
   │    ▲                                                │
   │    │                                                │
   │    └─ composers ◄─ compositions ◄─ composition_stats
   │                                 │                   │
   │              purchases ◄────────┘                    │
   │                 ▲                                    │
   │                 │ purchase_history                   │
   │                 │                                    │
   │             invites                                  │
   │             role_requests                            │
   │             admin_emails                            │
   │             file_uploads                            │
   │                                                     │
   └─────────────────────────────────────────────────────┘
        │                    │
        ▼                    ▼
   ┌─────────────┐      ┌───────────────┐
   │Supabase     │      │Supabase       │
   │Storage      │      │SQL            │
   │(Buckets):  │      │(Queries)      │
   │• avatars    │      │               │
   │• thumbnails │      │Indexes        │
   │• compositions       │Relationships  │
   └─────────────┘      └───────────────┘
        │
        │ Public URLs
        │
        ▼
   ┌─────────────────────────┐
   │ Composition Assets      │
   │ PDFs accessible via URL │
   └─────────────────────────┘
```

---

## 7. UUID Conversion (Critical!)

```
╔════════════════════════════════════════════════════════════════╗
║              FIREBASE UID → SUPABASE UUID CONVERSION           ║
╚════════════════════════════════════════════════════════════════╝

PROBLEM:
  • Firebase UID: String like "OHRStIC16rW3jYkCbP2WYaptc2k2"
  • Supabase columns: Expect UUID type
  • Direct query fails: "invalid input syntax for type uuid"

SOLUTION:
  Always use 2-step lookup:

  ┌───────────────────────────────────────────┐
  │ Step 1: Get Firebase UID from user        │
  │  firebase_uid = "OHRStIC16rW..."          │
  └────────────────┬────────────────────────┘
                   │
                   ▼
  ┌───────────────────────────────────────────┐
  │ Step 2: Query users by firebase_uid       │
  │  SELECT id FROM users                    │
  │  WHERE firebase_uid = $1                 │
  │  RETURNS: "550e8400-e29b-41..."(UUID)   │
  └────────────────┬────────────────────────┘
                   │
                   ▼
  ┌───────────────────────────────────────────┐
  │ Step 3: Use returned UUID for JOINs       │
  │  SELECT * FROM composers                 │
  │  WHERE user_id = $1  (use the UUID!)    │
  └───────────────────────────────────────────┘

EXAMPLE QUERY:
  WITH user_uuid AS (
    SELECT id FROM users WHERE firebase_uid = $1
  )
  SELECT c.*, u.display_name, u.email
  FROM composers c
  JOIN users u ON c.user_id = u.id
  WHERE c.user_id = (SELECT id FROM user_uuid);
```

---

## Quick Reference

```
┌───────────────────────────────────────────────────────────────┐
│              QUICK DEPLOYMENT CHECKLIST                      │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ DATABASE (Supabase):                                         │
│  ☐ Run Migration 005 (composers table)                      │
│  ☐ Run Migration 006 (compositions table)                   │
│  ☐ Run Migration 007 (composition_stats table)              │
│  ☐ Run Migration 008 (purchases table)                      │
│  ☐ Run Migration 009 (file_uploads table)                   │
│  ☐ Verify all tables created with indexes                  │
│                                                               │
│ CODE:                                                        │
│  ☐ Deploy AuthContext changes                              │
│  ☐ Deploy ManageAccount changes                            │
│  ☐ Deploy ComposerDashboard changes                        │
│  ☐ Deploy UploadComposition changes                        │
│  ☐ No server changes needed (already compatible)           │
│                                                               │
│ TESTING:                                                     │
│  ☐ Test: Admin approves composer                           │
│  ☐ Test: Composer logs in → redirects to /composer         │
│  ☐ Test: Composer uploads composition                      │
│  ☐ Test: New composition shows in dashboard                │
│  ☐ Test: Admin panel shows composition                     │
│  ☐ Test: Stats are calculated correctly                    │
│                                                               │
│ MONITORING:                                                  │
│  ☐ Check server logs for errors                            │
│  ☐ Check browser console                                    │
│  ☐ Use debug endpoint: /api/admin/debug/compositions       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

**Status**: ✅ Ready for Deployment

Created: February 24, 2026
