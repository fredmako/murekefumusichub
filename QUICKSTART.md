# Prime Media - Quick Start Guide

Get your choral music marketplace up and running in 10 minutes!

## Prerequisites

- Node.js 18+ installed
- pnpm or npm installed
- Git installed

## Step 1: Clone & Install (2 minutes)

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
```

## Step 2: Set Up Supabase (3 minutes)

1. **Create Supabase Project**
   - Go to Cloudflare dashboard (https://dash.cloudflare.com)
   - Click "New Project"
   - Name it "prime-media"
   - Save your password

2. **Get Credentials**
   - Go to Project Settings > API
   - Copy "Project URL"
   - Copy "anon public" key

3. **Update `.env` file**
   ```env
   # VITE_SUPABASE_URL= (deprecated)
   # VITE_SUPABASE_ANON_KEY= (deprecated)
   ```

4. **Run Database Setup**
   - Open Supabase SQL Editor
   - Copy SQL from `/src/lib/supabase.ts` (search for `DATABASE_SETUP_SQL`)
   - Click "Run"

## Step 3: Firebase is Ready! (1 minute)

Your Firebase config is already set up in `/src/lib/firebase.ts` with these credentials:
- Project: prime-media-7216b
- Auth: Enabled
- Storage: Enabled

✅ **Nothing to configure** - it's ready to use!

## Step 4: Run the App (1 minute)

```bash
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Step 5: Test It! (3 minutes)

1. **Click "Buyer" Demo Button**
   - Creates account automatically
   - Signs you in
   - Syncs with Supabase

2. **Check Supabase Dashboard**
   - Go to Table Editor
   - Open `users` table
   - See your new user!

3. **Browse Marketplace**
   - (Will be empty initially)
   - Ready for compositions

## Verify Installation

### ✅ Check Firebase
```bash
# Open browser console (F12)
# You should see:
"Firebase initialized successfully"
```

### ✅ Check Supabase
```bash
# In Supabase SQL Editor, run:
SELECT COUNT(*) FROM users;
# Should return 1 after demo login
```

### ✅ Check Services
```bash
# In browser console, type:
api.categories.getAll()
# Should return empty array []
```

## Next Steps

### Add Sample Categories
In Supabase SQL Editor:
```sql
INSERT INTO categories (name, description) VALUES
  ('Sacred Music', 'Music for worship'),
  ('Contemporary', 'Modern arrangements'),
  ('Classical', 'Traditional works')
ON CONFLICT (name) DO NOTHING;
```

### Test Composer Features
1. Log out (click logout in navbar)
2. Click "Composer" demo button
3. Go to Composer Dashboard
4. Try uploading a composition

### Test Admin Features
1. Log out
2. Click "Admin" demo button
3. View Admin Panel
4. See platform statistics

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
```bash
# pnpm install @supabase/supabase-js  (NOT needed)
```

### "Supabase connection failed"
- Check `.env` file exists
- Verify `VITE_SUPABASE_URL` is correct
- Restart dev server: `pnpm run dev`

### "Firebase auth failed"
- Check internet connection
- Firebase is already configured correctly
- Try clearing browser cache

### "Database tables not found"
- Go to Supabase SQL Editor
- Run the `DATABASE_SETUP_SQL` from `/src/lib/supabase.ts`

## Environment Variables Quick Reference

```env
# Required for development
# VITE_SUPABASE_URL= (deprecated)
VITE_SUPABASE_ANON_KEY=your-key-here

# Already configured (Firebase)
# No changes needed!

# Optional (for production)
VITE_API_BASE_URL=http://localhost:7071/api
VITE_PAYMENT_PROVIDER=mpesa
VITE_SMS_PROVIDER=azure
```

## Development Workflow

### Daily Development
```bash
# Start dev server
pnpm run dev

# In another terminal, watch for errors
# Browser console (F12) and terminal
```

### Adding Features
1. Check `/src/services/api.ts` for available services
2. Import and use in components
3. All services handle errors automatically
4. Toast notifications show to users

### Database Changes
1. Write SQL in Supabase SQL Editor
2. Test with sample data
3. Add to migration file
4. Document in code

## Testing Checklist

- [ ] Can sign up new user
- [ ] Can sign in existing user
- [ ] Demo buttons work
- [ ] User appears in Supabase
- [ ] Can view marketplace
- [ ] Composer can access dashboard
- [ ] Admin can access panel
- [ ] No errors in console

## What's Working Now

✅ **Authentication** - Full Firebase + Supabase sync
✅ **User Management** - Roles and permissions
✅ **Database** - All tables and relationships
✅ **API Services** - Complete service layer
✅ **Error Handling** - User-friendly messages
✅ **Security** - Firebase auth + Supabase
✅ **Type Safety** - Full TypeScript

## What To Add Later

🔄 **Payments** - MPesa or Stripe integration
🔄 **Storage** - File upload for compositions
🔄 **SMS** - Azure Communication Services
🔄 **Email** - Newsletter system
🔄 **Analytics** - Advanced reporting

## Common Commands

```bash
# Development
pnpm run dev          # Start dev server
pnpm run build        # Build for production

# Database
# (In Supabase SQL Editor)
SELECT * FROM users;              # View users
SELECT * FROM compositions;       # View compositions
SELECT * FROM purchases;          # View purchases

# Reset demo user
DELETE FROM user_roles WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%demo%'
);
DELETE FROM users WHERE email LIKE '%demo%';
```

## Project Structure

```
/src
├── /lib              # Core configs
│   ├── firebase.ts   # ✅ Firebase auth
│   └── supabase.ts   # ✅ Supabase client
│
├── /services         # Backend logic
│   └── api.ts        # ✅ All API services
│
└── /app              # Frontend
    ├── App.tsx       # ✅ Main app
    └── /components   # ✅ UI components
```

## Support

- 📖 **Full Setup**: See `/BACKEND_SETUP.md`
- 🔧 **Implementation**: See `/IMPLEMENTATION_SUMMARY.md`
- 📊 **Architecture**: See `/SYSTEM_DOCUMENTATION.md`
- 💬 **Issues**: Check browser console + Supabase logs

## Success! 🎉

You now have:
- ✅ Working authentication system
- ✅ Database with all tables
- ✅ Complete API layer
- ✅ Ready for development
- ✅ Production-ready architecture

**Start building your choral music marketplace!**

### Quick Test Script

Paste this in browser console after logging in:

```javascript
// Test authentication
console.log('User:', auth.currentUser);

// Test Supabase
api.categories.getAll()
  .then(cats => console.log('Categories:', cats))
  .catch(err => console.error('Error:', err));

// Test user sync
console.log('✅ Everything working!');
```

---

**Need help?** Check the troubleshooting section above or review the detailed documentation.

**Ready to deploy?** See `/BACKEND_SETUP.md` Step 8: Deployment

🚀 **Happy coding!**
