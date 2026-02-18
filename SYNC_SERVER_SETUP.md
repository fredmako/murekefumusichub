# 🚀 Sync Server Setup & Running Instructions

Your **Firebase to Supabase user sync server** is now ready! Here's how to run everything:

## ✅ What's Already Done

1. ✅ **ngrok** - Installed globally
2. ✅ **Sync Server** - Created in `server/` folder with `/api/sync-user` endpoint
3. ✅ **Dependencies** - Express, Supabase, dotenv installed
4. ✅ **Environment** - Supabase credentials configured in `server/.env`

---

## 🎯 How to Run (Two Terminals)

### **Terminal 1: Start the Node.js Sync Server**

```bash
cd server
node index.js
```

You should see output like:
```
🚀 Sync server running on http://localhost:3001
📍 Health check: http://localhost:3001/health
📍 Sync user: POST http://localhost:3001/api/sync-user
📍 Batch sync: POST http://localhost:3001/api/sync-users-batch

Waiting for ngrok tunnel...
```

### **Terminal 2: Start ngrok Tunnel**

```bash
ngrok http 3001
```

**ngrok will display a public URL** like:
```
Forwarding                    https://abc123def456.ngrok.io -> http://localhost:3001
```

### **Terminal 3 (Optional): Run Your Frontend Dev Server**

```bash
npm run dev
```

---

## 🔗 Update Frontend Environment Variable

Once you have the **ngrok URL** (from Terminal 2), update `.env.local` in your project root:

```env
VITE_API_BASE_URL=https://abc123def456.ngrok.io
```

Replace `abc123def456.ngrok.io` with your actual ngrok URL.

---

## 📍 API Endpoints Available

### 1. Health Check
```bash
curl http://localhost:3001/health
```

Response:
```json
{"status":"ok","message":"Server is running"}
```

### 2. Sync Single User
```bash
curl -X POST http://localhost:3001/api/sync-user \
  -H "Content-Type: application/json" \
  -d '{
    "firebaseUid": "user_firebase_id",
    "email": "user@example.com",
    "displayName": "John Doe",
    "role": "buyer"
  }'
```

### 3. Batch Sync Users (Sync All From Firebase)
```bash
curl -X POST http://localhost:3001/api/sync-users-batch \
  -H "Content-Type: application/json" \
  -d '{
    "users": [
      {"firebaseUid": "uid1", "email": "user1@example.com", "role": "buyer"},
      {"firebaseUid": "uid2", "email": "user2@example.com", "role": "composer"}
    ]
  }'
```

---

## 🔐 Security Notes

- **`SUPABASE_SERVICE_ROLE_KEY`** in `server/.env` is sensitive (has elevated database permissions)
- **Never** commit `.env` to git
- Never share the service role key
- In production, host this on a secure backend (Azure Functions, Vercel, AWS Lambda, etc.)

---

## ✨ How It Works

1. **Frontend** tries to create user in Supabase
2. **If RLS blocks it** (row-level security), frontend calls your server
3. **Server** uses service role key to create user (bypasses RLS)
4. **Server** returns user ID to frontend
5. **Frontend** continues normally

---

## 🧪 Quick Test

After everything is running:

```bash
# Test the server health
curl https://YOUR_NGROK_URL/health

# Test sync user (replace with real UID)
curl -X POST https://YOUR_NGROK_URL/api/sync-user \
  -H "Content-Type: application/json" \
  -d '{"firebaseUid":"test123","email":"test@example.com","role":"buyer"}'
```

---

## 📝 Next Steps

1. Start **Terminal 1**: `cd server && node index.js`
2. Start **Terminal 2**: `ngrok http 3001` (copy the HTTPS URL it shows)
3. Update `.env.local`: `VITE_API_BASE_URL=<ngrok-url>`
4. Start **Terminal 3**: `npm run dev`
5. Test login/signup in your app — users should sync automatically!

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "address already in use" | Kill process: `Get-Process node \| Stop-Process -Force` |
| ngrok not found | Run `npm install -g ngrok` |
| "Missing SUPABASE_* env vars" | Check `server/.env` has correct keys |
| Users not syncing | Check browser console for API errors; verify ngrok URL in `.env.local` |

---

**Questions?** Check `server/README.md` or `server/.env.example`
