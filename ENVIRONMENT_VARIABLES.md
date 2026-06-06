# Environment Variables for Vercel Dashboard

This document lists all required environment variables that must be configured in your Vercel Dashboard for LuxTrade to work properly.

## Required Environment Variables

### Supabase Configuration (REQUIRED)

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Where to get these values:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings → API**
4. Copy the values from there

**Important:**
- Create a public bucket named `trade-screenshots` in Supabase Storage for screenshot uploads
- Enable public access on the bucket so images can be displayed
- The bucket should have these RLS policies or be set to public for uploads

### Database Configuration (REQUIRED)

```env
DATABASE_URL=your_postgresql_database_url
```

**Where to get this value:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings → Database**
4. Copy the **Connection String (URI)** (using `postgres://` format)
5. Or use Prisma Accelerator URL if configured

**Note:** For production, use PostgreSQL database (not SQLite file).

### Resend Email Configuration (REQUIRED)

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_TEMPLATE_CONFIRM=your_confirmation_template_id
RESEND_TEMPLATE_RESET=your_reset_password_template_id
```

**Where to get these values:**
1. Go to [Resend Dashboard](https://resend.com/dashboard)
2. Get API Key from **API Keys** section
3. Create email templates in Resend and note down their IDs

### OpenAI API (REQUIRED for AI Screenshot Analysis)

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Where to get this value:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create an API key
3. Copy and paste here

**Required for:**
- AI-powered screenshot analysis (extracting trade data from screenshots)
- Vision AI features in the trading journal

### Hugging Face API (OPTIONAL - FREE alternative to OpenAI)

```env
HUGGING_FACE_API_TOKEN=hf_your-huggingface-token-here
```

**Where to get this value:**
1. Go to [Hugging Face Settings → Tokens](https://huggingface.co/settings/tokens)
2. Create a new token (READ permissions are sufficient)
3. Copy and paste here

**Note:** This is used as a FREE fallback for Vision AI features if OpenAI is not available.

### MetaApi Configuration (OPTIONAL)

```env
METAAPI_TOKEN=your_metaapi_token_here
```

**Where to get this value:**
1. Go to [MetaApi Dashboard](https://metaapi.cloud/)
2. Create an account and get your token

**Required for:**
- Real-time trading account synchronization
- Live trade import from MT4/MT5 platforms

### Z.ai Vision SDK (OPTIONAL)

```env
ZAI_BASE_URL=https://internal-api.z.ai/v1
ZAI_API_KEY=your_zai_api_key_here
ZAI_CHAT_ID=your_chat_id_here
ZAI_USER_ID=your_user_id_here
ZAI_TOKEN=your_zai_token_here
```

**Note:** This is for internal Z.ai AI features. Contact your Z.ai representative for these values.

### App Configuration (REQUIRED)

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=https://luxtradee.web.id
```

**Update for production:**
- `NEXT_PUBLIC_APP_URL`: Set to your Vercel deployment URL
- `NEXT_PUBLIC_SITE_URL`: Set to your production domain

---

## Setup Checklist

Before deploying to Vercel, ensure:

- [ ] All Supabase environment variables are set (URL, ANON_KEY, SERVICE_ROLE_KEY)
- [ ] DATABASE_URL is set to PostgreSQL connection string
- [ ] RESEND_API_KEY is configured for email functionality
- [ ] OPENAI_API_KEY is set for AI screenshot analysis
- [ ] `trade-screenshots` bucket is created in Supabase Storage
- [ ] Bucket has public access enabled
- [ ] NEXT_PUBLIC_SITE_URL is updated to production domain

---

## Common Issues & Solutions

### Issue: "Storage bucket not found"
**Solution:** Create a bucket named `trade-screenshots` in Supabase Storage and enable public access.

### Issue: "Failed to analyze screenshot"
**Solution:** Check that OPENAI_API_KEY is valid and has API credits available.

### Issue: "Database connection failed"
**Solution:** Verify DATABASE_URL is correct and points to an active PostgreSQL database.

### Issue: "Email sending failed"
**Solution:** Verify RESEND_API_KEY and template IDs are correct.

---

## How to Add Environment Variables in Vercel

1. Go to your Vercel Dashboard
2. Select your project (LuxTrade)
3. Navigate to **Settings → Environment Variables**
4. Add each variable with its value
5. Select the appropriate environment (Production, Preview, Development)
6. Click **Save**
7. Redeploy your project to apply changes

---

## Testing Environment Variables

After deployment, test critical features:

1. **Authentication:** Login/Signup flow
2. **Screenshot Upload:** Try uploading a screenshot in the trade form
3. **AI Analysis:** Test AI screenshot extraction
4. **Email:** Request password reset to test email sending
5. **Database:** Create a new trade and verify it's saved

---

## Security Notes

- Never commit `.env` or `.env.local` files to git
- Use different API keys for development and production environments
- Rotate API keys regularly for security
- Service Role Key (SUPABASE_SERVICE_ROLE_KEY) should be kept secret and never exposed to client-side code

---

Last Updated: January 2025
Version: 1.0