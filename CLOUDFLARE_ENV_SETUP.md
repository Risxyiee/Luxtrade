# Cloudflare Workers Environment Variables Setup

## Problem
Login/signup is failing because Supabase environment variables are not set in Cloudflare Workers.

## Required Environment Variables

You need to add these environment variables in your Cloudflare Workers project settings:

### Supabase Configuration (REQUIRED for login to work)
```
NEXT_PUBLIC_SUPABASE_URL=https://klxkdrfsfcoankbaoejn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Optional Environment Variables (for admin features)
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_SITE_URL=https://luxtradee.web.id
```

## How to Set Environment Variables in Cloudflare Workers

### Method 1: Using Cloudflare Dashboard (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Click on your **luxtrade** project
4. Go to **Settings** → **Environment Variables**
5. Add each variable:
   - Click **Add variable**
   - Enter the variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - Enter the value
   - Click **Encrypt** if it's a sensitive value (like API keys)
   - Click **Save**
6. Repeat for all variables

### Method 2: Using Wrangler CLI

Create a `.dev.vars` file for local development:
```
NEXT_PUBLIC_SUPABASE_URL=https://klxkdrfsfcoankbaoejn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_SITE_URL=https://luxtradee.web.id
```

For production deployment, you can also use `wrangler secret put`:
```bash
wrangler secret put NEXT_PUBLIC_SUPABASE_URL
wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## Where to Get Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (`klxkdrfsfcoankbaoejn`)
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** secret → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **WARNING:** Never commit the `SUPABASE_SERVICE_ROLE_KEY` to Git!

## After Setting Environment Variables

1. **Redeploy your project** - The environment variables won't take effect until you redeploy
2. **Test login/signup** - Try registering a new account

## Debugging

If you still see Supabase warnings after setting the environment variables:

1. Check the Cloudflare Workers logs:
   - Go to your project → **Logs**
   - Look for errors like:
     ```
     CRITICAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is required in production
     ```

2. Verify the environment variables are set correctly:
   - In Cloudflare Dashboard → Settings → Environment Variables
   - Make sure there are no extra spaces or typos

3. Make sure you've redeployed after adding the variables

## Complete Environment Variable List

```
# Supabase (REQUIRED for basic functionality)
NEXT_PUBLIC_SUPABASE_URL=https://klxkdrfsfcoankbaoejn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Supabase (OPTIONAL - for admin features)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://luxtradee.web.id

# Midtrans Payment (if using payment features)
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your_midtrans_client_key
MIDTRANS_SERVER_KEY=your_midtrans_server_key

# Resend Email (if using email features)
RESEND_API_KEY=your_resend_api_key

# AI Services (if using AI features)
GEMINI_API_KEY=your_gemini_api_key
```

## Common Issues

### Issue: "NEXT_PUBLIC_SUPABASE_ANON_KEY not set"
**Solution:** Add the environment variable in Cloudflare Workers settings and redeploy

### Issue: Login works locally but not in production
**Solution:** Make sure you set the environment variables in the production environment, not just locally

### Issue: Supabase connection timeout
**Solution:** Check that the Supabase URL is correct and your Supabase project is active