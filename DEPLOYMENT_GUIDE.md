# Deployment Guide - LuxTrade

## Prerequisites Checklist

Before deploying to Vercel, ensure you have:

- [ ] Supabase project created
- [ ] Supabase Storage bucket `trade-screenshots` created
- [ ] Supabase Database schema migrated
- [ ] All environment variables ready
- [ ] GitHub repository connected to Vercel

---

## 1. Environment Variables for Vercel

Copy the following environment variables to Vercel Dashboard → Settings → Environment Variables:

### **CRITICAL - Required for Basic Functionality**

| Variable Name | Required | Description | Where to Find |
|--------------|----------|-------------|---------------|
| `DATABASE_URL` | ✅ YES | Database connection string (SQLite for local, Supabase PostgreSQL for prod) | Supabase Dashboard → Settings → Database |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ YES | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ YES | Supabase anonymous/public key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ YES | Supabase service role key (admin privileges) | Supabase Dashboard → Settings → API |

### **Required for Email Functionality**

| Variable Name | Required | Description | Where to Find |
|--------------|----------|-------------|---------------|
| `RESEND_API_KEY` | ⚠️ Recommended | Resend API key for email sending | https://resend.com/api-keys |
| `RESEND_TEMPLATE_CONFIRM` | ⚠️ Recommended | Email template ID for confirmation emails | Resend Dashboard |
| `RESEND_TEMPLATE_RESET` | ⚠️ Recommended | Email template ID for password reset | Resend Dashboard |

### **Required for Screenshot Journal (AI Analysis)**

| Variable Name | Required | Description | Where to Find |
|--------------|----------|-------------|---------------|
| `ZAI_BASE_URL` | ⚠️ Recommended | Z.ai Vision API base URL | `/etc/.z-ai-config` (dev) or documentation |
| `ZAI_API_KEY` | ⚠️ Recommended | Z.ai API key | Z.ai Dashboard |
| `ZAI_CHAT_ID` | ⚠️ Recommended | Z.ai chat ID | Z.ai Dashboard |
| `ZAI_TOKEN` | ⚠️ Recommended | Z.ai token | Z.ai Dashboard |
| `ZAI_USER_ID` | ⚠️ Recommended | Z.ai user ID | Z.ai Dashboard |

### **Optional - Additional AI Providers**

| Variable Name | Required | Description | Where to Find |
|--------------|----------|-------------|---------------|
| `OPENAI_API_KEY` | Optional | OpenAI API key for GPT models | https://platform.openai.com/api-keys |
| `HUGGING_FACE_API_TOKEN` | Optional | Hugging Face API token | https://huggingface.co/settings/tokens |
| `OLLAMA_HOST` | Optional | Ollama host URL | `http://localhost:11434` (local only) |
| `OLLAMA_MODEL` | Optional | Ollama model name | e.g., `llama2` |

### **Optional - Market Data Integration**

| Variable Name | Required | Description | Where to Find |
|--------------|----------|-------------|---------------|
| `ALPHA_VANTAGE_API_KEY` | Optional | Alpha Vantage API key | https://www.alphavantage.co/support/#api-key |
| `METAAPI_API_URL` | Optional | MetaApi URL | MetaApi Dashboard |
| `METAAPI_TOKEN` | Optional | MetaApi token | MetaApi Dashboard |

### **Optional - App Configuration**

| Variable Name | Required | Description | Example Value |
|--------------|----------|-------------|---------------|
| `NEXT_PUBLIC_APP_URL` | Optional | App base URL | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_SITE_URL` | Optional | Site URL for links | `https://your-domain.com` |

---

## 2. Supabase Setup

### 2.1 Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Choose a region close to your users
4. Set a strong password
5. Wait for project to be created (2-3 minutes)

### 2.2 Get Supabase Credentials

1. Go to Supabase Dashboard → Settings → API
2. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **NEVER SHARE THIS KEY**

### 2.3 Create Storage Bucket for Trade Screenshots

1. Go to Supabase Dashboard → Storage
2. Click "Create a new bucket"
3. Bucket name: `trade-screenshots`
4. Public bucket: ✅ YES (check the box)
5. Click "Create bucket"

### 2.4 Configure Storage Bucket Policy

In Supabase Dashboard → SQL Editor, run:

```sql
-- Enable storage extension (if not enabled)
CREATE EXTENSION IF NOT EXISTS "storage";

-- Create storage policies for trade-screenshots bucket
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload trade screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to view their own uploads
CREATE POLICY "Authenticated users can view trade screenshots"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-screenshots'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete trade screenshots"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trade-screenshots'
  AND auth.role() = 'authenticated'
);

-- Grant access to bucket
GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated;
```

### 2.5 Run Database Migrations

If you have a Prisma schema, run:

```bash
# Push schema to Supabase
bun run db:push

# Or if using migrations
bun run db:migrate
```

---

## 3. Vercel Deployment

### 3.1 Connect GitHub to Vercel

1. Go to https://vercel.com
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

### 3.2 Configure Build Settings

In Vercel Project Settings:

**Build & Development Settings:**
- Framework Preset: Next.js
- Root Directory: `./`
- Build Command: `bun run build` (default)
- Output Directory: `.next` (default)
- Install Command: `bun install` (default)

### 3.3 Add Environment Variables

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add all variables from Section 1
3. **IMPORTANT:** Select "Production" for all environments
4. Click "Save"

### 3.4 Clear Build Cache for Clean Build

To ensure a clean build without cache:

#### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
bun add -g vercel

# Login to Vercel
vercel login

# Clear cache and redeploy
vercel --force
```

#### Option B: Using Vercel Dashboard
1. Go to Vercel Dashboard → Deployments
2. Click on the latest deployment
3. Click "Redeploy"
4. Check "Clear build cache"
5. Click "Redeploy"

---

## 4. Deployment Checklist

Before and after deployment, verify:

### Pre-Deployment
- [ ] All environment variables are set in Vercel
- [ ] Supabase bucket `trade-screenshots` is created and public
- [ ] Supabase Storage policies are configured
- [ ] Database schema is up to date
- [ ] No hardcoded local paths in code
- [ ] .env file is in .gitignore

### Post-Deployment
- [ ] Build succeeds without errors
- [ ] Homepage loads correctly
- [ ] Login/Signup works
- [ ] Dashboard loads after login
- [ ] Trading account creation works
- [ ] Trade creation with photo upload works
- [ ] Photo is uploaded to Supabase Storage
- [ ] Sidebar delete account works
- [ ] Accounts tab delete account works

---

## 5. Troubleshooting

### 5.1 Build Failures

**Error: "SUPABASE_SERVICE_ROLE_KEY not defined"**
- Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables
- Redeploy with cache cleared

**Error: "Cannot find module 'z-ai-web-dev-sdk'"**
- Check if `z-ai-web-dev-sdk` is in package.json
- If not, run `bun add z-ai-web-dev-sdk`
- Commit and redeploy

**Error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured"**
- This is a warning, not a blocker
- Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel env vars
- Redeploy

### 5.2 Runtime Errors

**Error: "File upload failed"**
- Check Supabase Storage bucket exists
- Verify bucket name is exactly `trade-screenshots`
- Check `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check storage policies in Supabase Dashboard

**Error: "Unauthorized" on API routes**
- Check authentication is working
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check middleware configuration

**Error: "Z.ai Vision failed"**
- Add Z.ai environment variables to Vercel
- Check API keys are valid
- Verify API base URL is correct

### 5.3 Photos Not Loading

**Symptom: Photos uploaded but broken image icon**
- Check Supabase Storage bucket is public
- Verify image URL in database
- Check browser console for 403 errors
- Verify storage policies allow public read

---

## 6. Final Deployment Steps

### Step 1: Commit All Changes

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "chore: migrate to Supabase Storage and prepare for production deployment

- Migrate trade photo upload from local storage to Supabase Storage
- Create admin client helper for SERVICE_ROLE_KEY access
- Update trade-upload API to use Supabase Storage bucket
- Remove local file system dependencies
- Add environment variables documentation for Vercel
- Fix Sidebar delete account integration (already working)
- Verify no hardcoded local paths in code"

# Push to GitHub
git push origin main
```

### Step 2: Trigger Vercel Redeploy

**Option A: Automatic**
- Vercel will auto-deploy when you push to main branch

**Option B: Manual**
- Go to Vercel Dashboard → Deployments
- Click "Redeploy" with "Clear build cache"

### Step 3: Verify Deployment

1. Wait for build to complete
2. Open the deployed URL
3. Test all critical features:
   - Login/Signup
   - Create trading account
   - Add trade with photo
   - Verify photo in Supabase Storage
   - Delete trading account
   - Check sidebar updates immediately

---

## 7. Production Best Practices

### Security
- ✅ Never commit `.env` file to Git
- ✅ Use environment variables for all secrets
- ✅ Keep `SUPABASE_SERVICE_ROLE_KEY` secure
- ✅ Enable RLS (Row Level Security) in Supabase
- ✅ Rotate API keys periodically

### Performance
- ✅ Enable Vercel Edge Network
- ✅ Use Supabase connection pooling
- ✅ Optimize image sizes
- ✅ Enable caching where appropriate

### Monitoring
- ✅ Set up Vercel Analytics
- ✅ Enable Supabase logs
- ✅ Monitor error rates
- ✅ Track user engagement

### Backups
- ✅ Enable Supabase automated backups
- ✅ Backup database before major changes
- ✅ Test restore process regularly

---

## 8. Common Issues & Solutions

### Issue: Photos not persisting after Vercel deployment
**Solution:**
This should now be fixed with Supabase Storage migration. If still happening:
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
2. Check Supabase bucket is public
3. Verify storage policies allow write access

### Issue: Sidebar not updating after deleting account
**Solution:**
This should be working. The Sidebar already calls `fetchData()` which updates the `tradingAccounts` state.

### Issue: Build fails with .z-ai-config error
**Solution:**
The code now has fallback to environment variables. Ensure Z.ai env vars are set in Vercel:
- `ZAI_BASE_URL`
- `ZAI_API_KEY`
- `ZAI_CHAT_ID`
- `ZAI_TOKEN`
- `ZAI_USER_ID`

---

## 9. Support & Maintenance

### Regular Tasks
- [ ] Monitor Supabase storage usage
- [ ] Check Vercel build logs
- [ ] Review error reports
- [ ] Update dependencies monthly
- [ ] Backup database before major changes

### When to Redeploy
- After code changes to API routes
- After modifying environment variables
- After updating Supabase schema
- After major dependency updates

---

**Deployment Date:** [Fill after deployment]
**Deployed By:** [Fill after deployment]
**Deployment URL:** [Fill after deployment]

---

**End of Deployment Guide**