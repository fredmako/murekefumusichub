# Murekefu Music Hub System Documentation

## 1. System Overview

Murekefu Music Hub is a role-based web platform for choral music learning, composition publishing, music purchasing, administration, messaging, and support operations.

The system combines:

- a public-facing music platform and landing experience
- a buyer marketplace, checkout, and personal library
- a composer upload and management workflow
- an admin operations dashboard with state-aware actions
- support chat, direct messaging, announcements, and notifications
- enrollment and registration payment control
- PDF reporting with field selection for admin exports

Current deployment model:

- Frontend: Vercel
- Backend API: Railway
- Database, Auth, and Storage: Supabase

## 2. Problem Statement

Choral music communities often operate with fragmented tools for:

- learning and training coordination
- distributing compositions
- handling enrollments and registration payments
- moderating content and requests
- communicating with users

This system consolidates those functions into one platform that supports students, buyers, composers, and administrators.

## 3. Main Objectives

- Provide a central platform for choral music discovery and training.
- Let composers upload and manage compositions for sale or review.
- Let buyers discover, purchase, and download compositions.
- Let administrators manage content, transactions, enrollment, messaging, and verification.
- Support operational communication through notifications, direct chat, support tickets, and announcements.
- Support Kenya-focused payment handling using KES-based flows and manual payment confirmation processes.

## 4. User Roles

### Visitor

- View landing page, about page, contact page, privacy policy
- Browse publicly visible marketplace content
- Sign up or log in

### Buyer

- Browse compositions
- Add items to checkout flow
- Submit payment details
- View purchases in personal library
- Download approved compositions
- Receive notifications and messages

### Composer

- Upload compositions
- Edit composition details, pricing, and publishing status
- Track composition performance data
- Delete compositions (removes them from the marketplace)
- Participate in composer request and invite flows

### Admin

- View platform overview and operational metrics
- Review users, role requests, composer invites, compositions, transactions, enrollments, and registration payments
- State-aware user actions (promote/demote roles, suspend/activate, delete)
- Verify or unverify compositions and remove compositions platform-wide
- Manage support tickets and direct communication
- Send announcements by user role
- Control registration regulations
- Export PDF reports with field selection and profile photos

## 5. Current Architecture

## 5.1 High-Level Architecture

```text
Browser (React + Vite)
    |
    | HTTPS
    v
Frontend on Vercel
    |
    | REST API
    v
Express API on Railway
    |
    +--> Supabase Auth
    +--> Supabase Postgres
    +--> Supabase Storage
    +--> External payment and media integrations
```

## 5.2 Frontend Architecture

Main frontend stack:

- React 18
- TypeScript
- Vite
- React Router
- Tailwind-based styling and UI primitives
- Sonner for toast feedback

Key frontend areas:

- `src/app/App.tsx`
  - route registration
  - route-level background handling
  - global app error dialog wiring
- `src/context/AuthContext.tsx`
  - session management
  - auth synchronization
  - role loading
- `src/app/components/`
  - route screens and role dashboards
- `src/services/api.ts`
  - API service layer for backend communication

## 5.3 Backend Architecture

Main backend stack:

- Node.js
- Express
- Supabase service-role access for server operations
- Route-based feature modules

API entry point:

- `server/index.js`

Mounted backend modules:

- `/api/users`
- `/api/account`
- `/api/upload`
- `/api/user`
- `/api`
- `/api/compositions`
- `/api/purchases`
- `/api/checkout`
- `/api/categories`
- `/api/admin`
- `/api/media`
- `/api/support`
- `/api/notifications`
- `/api/enrollments`
- `/api/registration`

## 6. Frontend Route Map

Defined in `src/app/App.tsx`.

Public routes:

- `/`
- `/login`
- `/reset-password`
- `/marketplace`
- `/about`
- `/privacy-policy`
- `/contact`
- `/auth/callback/*`

Authenticated or role-sensitive routes:

- `/manage-account`
- `/buyer`
- `/checkout`
- `/composer`
- `/enroll`
- `/admin`

## 7. Major Functional Modules

## 7.1 Authentication and Account Management

Primary behavior:

- Supabase email/password sign-in
- Google sign-in via callback flow
- password reset and set-new-password flow
- role synchronization after sign-in
- profile synchronization between auth and backend user records
- session-expiry handling and redirect preservation

Relevant frontend files:

- `src/context/AuthContext.tsx`
- `src/app/components/Login.tsx`
- `src/app/components/SetNewPassword.tsx`
- `src/app/components/ManageAccount.tsx`

Relevant backend files:

- `server/routes/users.js`
- `server/routes/account.js`
- `server/routes/role.js`
- `server/routes/requestRole.js`

## 7.2 Marketplace and Buyer Experience

Buyer-side capabilities:

- browse public compositions
- filter and inspect compositions
- KES-based pricing display
- recommendations
- checkout flow and payment submission
- purchase library and download access

Current recommendation behavior:

- personalized mode after a purchase history threshold
- cold-start mode for new buyers
- safe fallback or degraded mode instead of hard failure

Relevant frontend files:

- `src/app/components/Marketplace.tsx`
- `src/app/components/CompositionCard.tsx`
- `src/app/components/CheckoutPage.tsx`
- `src/app/components/BuyerDashboard.tsx`

Relevant backend files:

- `server/routes/compositions.js`
- `server/routes/purchases.js`
- `server/routes/checkout.js`
- `server/routes/categories.js`

## 7.3 Composer Workflow

Composer-side capabilities:

- upload compositions
- define title, category, accompaniment, and pricing details
- AI-assisted upload support
- publish or unpublish compositions
- edit existing composition details, pricing, and metadata
- delete compositions from the composer dashboard
- view and manage composer performance data

Current business rules:

- currency is standardized to KES
- category set is restricted to `Arrangements` and `Compositions`
- accompaniment can support multiple values
- difficulty has been removed from the main upload experience

Relevant frontend files:

- `src/app/components/UploadComposition.tsx`
- `src/app/components/ComposerDashboard.tsx`

Relevant backend files:

- `server/routes/compositions.js`
- `server/routes/uploads.js`
- `server/routes/categories.js`

## 7.4 Enrollment and Registration Control

Enrollment-side capabilities:

- student enrollment request submission
- registration regulations lookup
- registration payment submission
- admin approval or rejection
- enrollment admission management

Relevant frontend files:

- `src/app/components/MusicEnrollmentPage.tsx`
- `src/app/components/AdminPanel.tsx`

Relevant backend files:

- `server/routes/enrollments.js`
- `server/routes/registration.js`
- `server/routes/admin.js`

## 7.5 Admin Dashboard

Admin capabilities include:

- minimal overview dashboard with clickable KPI cards, action queue, and insights
- user management with state-aware actions (promote/demote roles, suspend/activate, delete)
- search and filter across users, requests, enrollments, compositions, and transactions
- role request review and composer invite management
- compositions moderation, verification, and removal (revokes buyer access)
- transaction and payment submission review
- enrollment review and admission
- registration regulations control
- support ticket operations and admin messaging
- announcements by role and messenger notifications
- PDF reporting with selectable fields across admin tables

Relevant frontend file:

- `src/app/components/AdminPanel.tsx`

Relevant backend file:

- `server/routes/admin.js`

## 7.6 Messaging, Support, and Notifications

The platform currently separates communication into two channels:

### Messenger

Used for:

- direct chat
- ticket chat
- announcements delivered through support-thread style flows

Relevant files:

- `src/app/components/SupportIssueButton.tsx`
- `server/routes/support.js`

### Notifications

Used for:

- admin alerts
- transaction updates
- enrollment and request-related activity
- announcement-style alert surfaces

Relevant files:

- `src/app/components/Navbar.tsx`
- `src/services/navbarService.ts`
- `server/routes/notifications.js`
- `server/routes/admin.js`

## 7.7 Reporting and PDF Exports

Admin reports can be exported as PDF for:

- users
- role requests
- enrollments
- compositions
- transactions

Reporting behavior:

- field selection menu with checkboxes and select-all options
- selections persist locally per report type
- exports include the platform logo, organization name, and a consistent template
- user reports can include profile photos

Relevant files:

- `src/app/components/PdfFieldExportMenu.tsx`
- `src/lib/pdfReports.ts`

## 7.8 Error Handling and Resilience

Implemented resilience features include:

- universal app error dialog
- retryable network/auth handling
- session-expired event handling
- cold-start recommendations instead of immediate recommendation failure
- route-safe loading states
- graceful handling of transient auth failures

Relevant files:

- `src/app/components/AppErrorDialog.tsx`
- `src/lib/appErrorEvents.ts`
- `src/lib/sessionEvents.ts`
- `src/services/api.ts`

## 8. Current Backend Route Summary

## 8.1 Users and Account

- `GET /api/users/:id`
- `GET /api/users/by-auth-uid/:authUid`
- `POST /api/users/ensure`
- `PUT /api/users/:id`
- `PUT /api/account`
- `DELETE /api/account`

## 8.2 Role Lookup and Role Request

- `GET /api/user/roles/:authUid`
- `POST /api/request-role`
- `GET /api/request-role/status`
- `GET /api/request-role/invite-status`
- `POST /api/request-role/accept-invite`

## 8.3 Compositions and Uploads

- `GET /api/compositions`
- `GET /api/compositions/composer/:composerId`
- `GET /api/compositions/:id`
- `POST /api/compositions`
- `PUT /api/compositions/:id`
- `DELETE /api/compositions/:id`
- `POST /api/compositions/price-to-usd`
- `POST /api/upload`
- `GET /api/categories`
- `POST /api/categories`

## 8.4 Purchases and Checkout

- `GET /api/purchases`
- `GET /api/purchases/:id/download`
- `POST /api/purchases`
- `DELETE /api/purchases/:id`
- `GET /api/purchases/recommendations`
- `PUT /api/purchases/preferences`
- `GET /api/checkout/status`
- `POST /api/checkout/submit`

## 8.5 Support and Notifications

- `POST /api/support/ai/draft`
- `POST /api/support/admin/announcements`
- `POST /api/support/issues`
- `POST /api/support/threads`
- `POST /api/support/admin/threads`
- `GET /api/support/inbox`
- `GET /api/support/threads/my`
- `GET /api/support/threads/:threadId/messages`
- `POST /api/support/threads/:threadId/messages`
- `POST /api/support/threads/:threadId/read`
- `GET /api/support/admin/tickets`
- `POST /api/support/admin/tickets/:threadId/pick`
- `POST /api/support/admin/tickets/:threadId/reject`
- `GET /api/support/admin/threads`
- `DELETE /api/support/admin/threads/:threadId`
- `GET /api/notifications/read`
- `POST /api/notifications/mark-read`

## 8.6 Admin

- `GET /api/admin/bootstrap`
- `GET /api/admin/roles`
- `GET /api/admin/users`
- `GET /api/admin/compositions`
- `POST /api/admin/compositions/:compositionId/verify`
- `POST /api/admin/compositions/:compositionId/unverify`
- `GET /api/admin/transactions`
- `GET /api/admin/enrollments`
- `POST /api/admin/enrollments/:enrollmentId/admit`
- `GET /api/admin/registration/regulations`
- `PUT /api/admin/registration/regulations`
- `GET /api/admin/registration/payments`
- `POST /api/admin/registration/payments/:submissionId/approve`
- `POST /api/admin/registration/payments/:submissionId/reject`
- `GET /api/admin/invites`
- `GET /api/admin/composer-requests`
- `GET /api/admin/stats`
- `GET /api/admin/notifications`
- `POST /api/admin/invites`
- `DELETE /api/admin/invites/:email`
- `POST /api/admin/users/:userId/promote-composer`
- `POST /api/admin/users/:userId/demote-composer`
- `POST /api/admin/users/:userId/promote-admin`
- `POST /api/admin/users/:userId/demote-admin`
- `POST /api/admin/users/:userId/suspend`
- `POST /api/admin/users/:userId/unsuspend`
- `DELETE /api/admin/users/:userId`
- `POST /api/admin/composer-requests/:userId/reject`
- `POST /api/admin/role-requests/:userId/reject`
- `POST /api/admin/payment-submissions/:submissionId/approve`
- `POST /api/admin/payment-submissions/:submissionId/reject`

## 8.7 Enrollment and Registration

- `POST /api/enrollments`
- `GET /api/enrollments/my`
- `GET /api/registration/regulations`
- `GET /api/registration/payments/my`
- `POST /api/registration/payments/submit`

## 8.8 Health and Media

- `GET /api/health`
- `GET /health`
- `GET /api/media/landing-images`
- `GET /api/media/composition-background`

## 9. Database and Migration Overview

The project uses SQL migration files in `migrations/`.

Main domains represented by migrations:

- user and role management
- composer and composition storage
- purchases and file uploads
- theme settings
- payment submissions and pending checkout submissions
- support chat and ticket assignment
- avatar URL normalization
- enrollments
- registration payment controls
- composition verification
- buyer recommendation preferences
- notification read tracking
- category normalization

Recent important migrations:

- `017_add_price_currency_to_compositions.sql`
- `018_create_support_chat_tables.sql`
- `021_create_enrollments_table.sql`
- `022_create_registration_payment_controls.sql`
- `022_set_composition_currency_default_kes.sql`
- `023_add_composition_verification_columns.sql`
- `023_create_buyer_preferences_table.sql`
- `024_create_pending_checkout_submissions_table.sql`
- `025_create_user_notification_reads_table.sql`
- `026_normalize_categories_to_arrangements_and_compositions.sql`
- `027_add_composers_is_active.sql`

## 10. Current Business Rules

- Composition pricing should be treated in KES across the current user experience.
- Marketplace categories are currently restricted to `Arrangements` and `Compositions`.
- New recommendation users should receive fallback results rather than a 500 error.
- Session expiry should redirect users back through the login path and preserve intended destination where possible.
- Notifications and messenger are separate system concepts.
- Admins manage operational approvals for payments, enrollments, and content verification.
- Admin role actions are state-aware (promote, demote, suspend, activate) and protect against self-demotion where applicable.
- Admin "reset sales" only resets the local dashboard baseline (stored in local storage), not database totals.
- PDF exports respect selected fields per report type and persist those selections locally.

## 11. Security and Access Control

The system currently relies on:

- Supabase-backed authentication tokens
- protected API routes using server token verification middleware
- role checks for admin-only operations
- server-side Supabase service-role operations for trusted backend workflows
- protected download endpoints for owned purchases

Security practices that matter in deployment:

- never commit service-role or third-party secret keys
- configure Railway environment variables directly in the platform
- configure Vercel environment variables for frontend base URLs and auth redirect base
- keep allowed origins aligned with deployed frontend domains

## 12. Deployment Topology

### Frontend

- Hosted on Vercel
- Uses environment variables such as API base URL and auth redirect base
- Uses route fallback behavior for SPA navigation

### Backend

- Hosted on Railway
- Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Can optionally serve static frontend files when `SERVE_STATIC=true`, though the current production model separates frontend and backend hosting

### Database and Storage

- Hosted in Supabase
- Stores user, composition, purchase, support, enrollment, and notification data
- Stores uploaded composition files and other assets

## 13. Known Risks and Operational Notes

- Root-level older documentation still contains historical references that no longer describe the active architecture.
- Some backend files are historical or partially superseded. For example, `server/routes/auth.js` exists in the repository but is not part of the active router mount set in `server/index.js`.
- Some features depend on specific migrations being applied in Supabase before the UI behaves correctly.
- Messaging, announcements, notifications, purchases, and registration control are tightly connected to database state; missing migrations can produce degraded behavior.
- Composer activation uses the `composers.is_active` column; if missing, run `027_add_composers_is_active.sql`.
- Recommendation logic is intentionally designed to degrade safely for new buyers and partial data states.

## 14. Suggested Next Documentation Steps

- Add API request and response examples for key admin and purchase flows.
- Add a database schema ERD.
- Add a deployment runbook for production incidents.
- Add a user manual for admins, composers, and buyers as separate documents.

## 15. Canonical References

Use these files as the current primary implementation references:

- `src/app/App.tsx`
- `src/context/AuthContext.tsx`
- `src/services/api.ts`
- `src/lib/pdfReports.ts`
- `src/app/components/PdfFieldExportMenu.tsx`
- `server/index.js`
- `server/routes/admin.js`
- `server/routes/support.js`
- `server/routes/purchases.js`
- `migrations/`
