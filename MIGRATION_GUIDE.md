# Composer System Migration Guide

## Step 1: Run Database Migrations

### Via Supabase Dashboard

1. Go to **https://app.supabase.com**
2. Select your project: **prime-media-7216b**
3. Go to **SQL Editor** → **New Query**
4. Copy and paste each migration file contents from `migrations/` folder
5. Click **Run** for each migration
6. **Execute them in order** (005, 006, 007, 008, 009)

### Migration Files to Execute

```
migrations/
  └── 005_create_composers_table.sql
  └── 006_create_compositions_table.sql
  └── 007_create_composition_stats_table.sql
  └── 008_create_purchases_table.sql
  └── 009_create_file_uploads_table.sql
```

---

## Step 2: Deploy Code Changes

### Backend Changes

✅ Already done. No changes needed to server code (compatible with existing promote-composer logic).

### Frontend Changes

✅ Already done. Code updates:

- `src/context/AuthContext.tsx` - Added composer status check and redirect logic
- `src/app/components/ManageAccount.tsx` - Added role-based redirect
- `src/app/components/UploadComposition.tsx` - Uses Supabase storage
- `src/app/components/ComposerDashboard.tsx` - Refetch on upload complete

---

## Step 3: Test the System

### Test Case 1: Composer Registration

1. Login as **admin** user
2. Go to Admin Panel
3. Find a regular user
4. Click **Approve Composer**
5. ✅ Expected: User is added to composers table, assigned "composer" role

### Test Case 2: Composer Login & Redirect

1. Logout
2. Login as the **newly approved composer**
3. After login, user should be redirected to **/composer** dashboard
4. ✅ Expected: Composer Dashboard loads with stats and controls

### Test Case 3: Upload Composition

1. Click **Upload New Composition**
2. Fill in form:
   - Title: "Test Composition"
   - Price: "15.99"
   - Difficulty: "Intermediate"
   - Accompaniment: "Piano"
   - Select PDF file
3. Click **Upload**
4. ✅ Expected:
   - File uploads successfully
   - Composition saved to database
   - Dialog closes
   - "Published Works" count increases

### Test Case 4: Admin Panel

1. Login as **admin**
2. Go to Admin Panel
3. Check **Compositions** tab
4. ✅ Expected: Newly uploaded composition appears in list

### Test Case 5: Stats Display

1. Check Admin Panel **Overview**
2. ✅ Expected: "Total Compositions" count matches uploaded compositions

---

## Step 4: Navbar Updates (Optional Enhancement)

To show role-specific dashboard links in navbar, update `src/app/components/Navbar.tsx`:

```tsx
// Add role-based navigation links
if (appUser?.isComposer) {
  // Show "Composer Dashboard" link
}
if (appUser?.roles?.includes("admin")) {
  // Show "Admin Panel" link
}
// Always show
// "Buyer Dashboard" link
```

---

## Troubleshooting

### Issue: Compositions not appearing in admin panel

**Solution**:

1. Check if compositions were saved to database (use debug endpoint)
2. Visit: `http://localhost:3001/api/admin/debug/compositions`
3. Should show list of compositions in database

### Issue: Composer not redirecting after login

**Solution**:

1. Check browser console for errors
2. Verify user was added to `composers` table:
   ```sql
   SELECT * FROM composers WHERE user_id = '<user-id>';
   ```
3. Verify user has "composer" role:
   ```sql
   SELECT ur.* FROM user_roles ur
   JOIN roles r ON ur.role_id = r.id
   WHERE ur.user_id = '<user-id>' AND r.name = 'composer';
   ```

### Issue: Upload diameter fails

**Solution**:

1. Check server logs for errors
2. Verify `ALLOW_FIREBASE_VERIFY_BYPASS=true` in server `.env`
3. Check if Supabase Storage bucket exists
4. Verify storage bucket name is "compositions"

### Issue: RLS errors on queries

**Solution**:

1. In Supabase Dashboard, go to **Authentication** → **Policies**
2. For each table (composers, compositions, etc.):
   - Check if RLS is **disabled** (recommended for now)
   - Or add policies that allow reads:
   ```sql
   CREATE POLICY "Allow all authenticated reads"
   ON public.TABLE_NAME
   FOR SELECT
   TO authenticated
   USING (true);
   ```

---

## Rollback Plan (if needed)

### Undo Migrations

```sql
-- In reverse order
DROP TABLE IF EXISTS public.file_uploads CASCADE;
DROP TABLE IF EXISTS public.purchases CASCADE;
DROP TABLE IF EXISTS public.composition_stats CASCADE;
DROP TABLE IF EXISTS public.compositions CASCADE;
DROP TABLE IF EXISTS public.composers CASCADE;
```

---

## Performance Optimization (Future)

### Add Indexes for Common Queries

```sql
-- Already included in migrations, but verify:
CREATE INDEX idx_composers_user_id ON composers(user_id);
CREATE INDEX idx_compositions_composer_id ON compositions(composer_id);
CREATE INDEX idx_compositions_deleted ON compositions(deleted);
CREATE INDEX idx_purchases_buyer_id ON purchases(buyer_id);
CREATE INDEX idx_purchases_composition_id ON purchases(composition_id);
```

### Add Materialized Views for Stats

```sql
-- For performance on frequently accessed composer stats
CREATE MATERIALIZED VIEW composer_stats_view AS
SELECT
  c.id as composer_id,
  u.display_name,
  u.email,
  COUNT(DISTINCT comp.id) as composition_count,
  COUNT(DISTINCT p.id) as purchase_count,
  COALESCE(SUM(p.price_paid), 0) as total_revenue
FROM composers c
JOIN users u ON c.user_id = u.id
LEFT JOIN compositions comp ON c.id = comp.composer_id AND comp.deleted = false
LEFT JOIN purchases p ON comp.id = p.composition_id AND p.is_active = true
GROUP BY c.id, u.display_name, u.email;

-- Refresh periodically
REFRESH MATERIALIZED VIEW composer_stats_view;
```

---

## Monitoring

### Key Metrics to Track

- **New composers**: How many users are approved as composers
- **Composition uploads**: Track upload volume
- **Total revenue**: Sum of all purchases
- **Average price**: Help composers set competitive prices

### Useful Queries

```sql
-- Top composers by revenue
SELECT c.id, u.display_name, SUM(p.price_paid) as revenue
FROM composers c
JOIN users u ON c.user_id = u.id
JOIN compositions comp ON c.id = comp.composer_id
JOIN purchases p ON comp.id = p.composition_id
WHERE p.is_active = true
GROUP BY c.id, u.display_name
ORDER BY revenue DESC
LIMIT 10;

-- Compositions needing stats updates
SELECT c.id, c.title, cs.views, cs.purchases
FROM compositions c
LEFT JOIN composition_stats cs ON c.id = cs.composition_id
WHERE c.deleted = false
ORDER BY cs.purchases DESC;
```

---

## Next Steps

1. ✅ Run migrations
2. ✅ Deploy code
3. ✅ Test all scenarios
4. ✅ Monitor metrics
5. 🔜 Enhance navbar with role-based links (optional)
6. 🔜 Add composition deletion feature
7. 🔜 Add purchase history for buyers
8. 🔜 Add composer analytics/reports

---

## Support

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review **COMPOSER_SYSTEM_ARCHITECTURE.md** for schema details
3. Check server logs: `npm run dev` in server directory
4. Check browser console: F12 in browser
5. Test with debug API: `/api/admin/debug/compositions`

---

**Last Updated**: February 24, 2026

**Status**: Ready for Deployment ✅
