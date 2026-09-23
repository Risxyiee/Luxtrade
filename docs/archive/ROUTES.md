# LuxTrade Routes Documentation

## **Important URLs**

### **Public Pages**
| Route | URL | Description |
|-------|-----|-------------|
| Home | `/` | Landing page with features & pricing |
| Login | `/auth/login` | User login page |
| Signup | `/auth/signup` | User registration page |
| Dashboard | `/dashboard` | Main trading dashboard (requires login) |
| Privacy Policy | `/privacy` | Privacy policy page |
| Terms of Service | `/terms` | Terms of service page |

---

### **Admin Panels**
⚠️ **There are 3 admin panels. Use `/admin-subscriptions` for the latest version.**

| Route | URL | Status | Features |
|-------|-----|--------|----------|
| Admin Subscriptions | `/admin-subscriptions` | ✅ **Recommended** | Users + Subscriptions management, real-time sync, activate Pro |
| Admin Panel | `/admin-panel` | ⚠️ Legacy | Basic admin |
| Admin Dashboard Secret | `/admin-dashboard-secret` | ⚠️ Legacy | Old dashboard |

---

### **Admin API Endpoints**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | Get all users from database |
| `/api/admin/users` | POST | Create new user |
| `/api/admin/users/[id]` | DELETE | Delete user |
| `/api/admin/subscriptions` | GET | Get all subscriptions |
| `/api/admin/subscriptions` | POST | Create new subscription |
| `/api/admin/subscriptions/[id]` | PUT | Update subscription |
| `/api/admin/subscriptions/[id]/activate` | POST | Activate subscription |
| `/api/admin/subscriptions/[id]/deactivate` | POST | Deactivate subscription |
| `/api/admin/plans` | GET | Get all subscription plans |
| `/api/admin/plans` | POST | Create new plan |
| `/api/admin/activate` | POST | **Activate Pro for user** |
| `/api/admin/sync-auth-users` | POST | **Sync Supabase Auth users to Prisma** |
| `/api/admin/withdrawals` | GET | Get withdrawal requests |

---

### **Authentication API**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user (Supabase + Prisma sync) |
| `/api/auth/signup` | POST | Signup with email/password |
| `/api/auth/sync-user` | POST | Sync user to Prisma (called on login) |
| `/api/auth/verify` | POST | Verify email |
| `/api/auth/resend-verification` | POST | Resend verification email |

---

### **How to Fix 404 Errors**

#### **1. Check Vercel Deploy Status**
- Go to Vercel dashboard
- Wait for deployment to complete (green checkmark)
- Check deploy logs for errors

#### **2. Clear Browser Cache**
- Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- Or try incognito/private mode

#### **3. Verify Correct URL**
Base URL: `https://q1arx165rdc0-d.space.z.ai`

| Page | Full URL |
|------|-----------|
| Home | `https://q1arx165rdc0-d.space.z.ai/` |
| Admin Panel | `https://q1arx165rdc0-d.space.z.ai/admin-subscriptions` |
| Dashboard | `https://q1arx165rdc0-d.space.z.ai/dashboard` |

#### **4. Test API Endpoint**
```bash
curl https://q1arx165rdc0-d.space.z.ai/api/admin/sync-auth-users
```

---

### **How to Use Admin Panel**

#### **Access Admin Panel**
1. Open: `https://q1arx165rdc0-d.space.z.ai/admin-subscriptions`
2. You should see the admin dashboard

#### **Sync Users from Supabase Auth**
1. In Admin Panel, click **"Sync Auth"** button
2. Confirm the dialog
3. Wait for sync to complete
4. All users from Supabase Auth will appear in the Users tab

#### **Activate Pro for User**
1. Go to **Users** tab
2. Find the user you want to activate
3. Click **"Activate Pro"** button
4. Select a plan (Monthly/Yearly/Lifetime)
5. Click confirm

#### **Manage Subscriptions**
1. Go to **Subscriptions** tab
2. View all subscriptions
3. Edit end dates
4. Activate/deactivate subscriptions

---

### **Build Information**

Last build: **Successful** ✅
- Routes generated: 54 pages
- All API routes working
- No build errors

---

### **Environment Variables Required**

For the API to work properly in Vercel, ensure these are set:

```
DATABASE_URL=                    # Prisma database (SQLite file)
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=       # Supabase service role key (for admin ops)
```

---

### **Troubleshooting**

| Issue | Solution |
|-------|----------|
| 404 on `/` | Wait for Vercel deployment to complete |
| 404 on `/admin-subscriptions` | Check URL spelling, ensure deployment is live |
| API 404 | Check deploy logs, verify API routes exist |
| Sync not working | Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel |
| Users not showing | Click "Sync Auth" button in admin panel |

---

### **Quick Test Commands**

```bash
# Test admin users API
curl https://q1arx165rdc0-d.space.z.ai/api/admin/users

# Test sync API
curl -X POST https://q1arx165rdc0-d.space.z.ai/api/admin/sync-auth-users

# Test plans API
curl https://q1arx165rdc0-d.space.z.ai/api/admin/plans
```
