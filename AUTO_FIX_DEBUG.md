# Auto Fix Status Pending - Debug Guide

## Problem
The "Auto Fix Status Pending" button was showing "Fixed 0 account(s)" when clicked.

## Root Cause
The auto-fix endpoint was requiring the `supabaseAdmin` client, which needs the `SUPABASE_SERVICE_ROLE_KEY` environment variable. This variable was not configured in Vercel, causing the endpoint to return an error.

## Changes Made

### 1. Updated `/api/trading-accounts/auto-fix-all/route.ts`
- Added fallback to use regular `supabase` client if `supabaseAdmin` is not available
- Added comprehensive logging to help debug issues
- Now works with both admin and regular database clients

### 2. Updated `/dashboard/connections/page.tsx`
- Added better error handling and display for auto-fix results
- Added "Debug Environment" button to check environment variables and database state
- Shows detailed information about which accounts were fixed or skipped

### 3. Created `/api/debug/check-env/route.ts`
- New debug endpoint to check:
  - Environment variables (Supabase URL, keys, MetaApi token)
  - Database client availability
  - User's trading accounts in the database
  - Account status and metaapi_account_id values

## How to Use

### Step 1: Check Debug Info
1. Go to `/dashboard/connections`
2. If you have accounts with PENDING status, you'll see two buttons:
   - "Auto Fix Status Pending" (amber/yellow)
   - "Debug Environment" (blue) - NEW
3. Click "Debug Environment" to see:
   - Which environment variables are configured
   - Which database clients are available
   - Your trading accounts and their current status
   - Whether `metaapi_account_id` is populated

### Step 2: Try Auto Fix
1. Click "Auto Fix Status Pending"
2. You'll now see a detailed toast message:
   - If accounts were fixed: Shows which accounts and what changed
   - If no accounts needed fixing: Shows "No accounts needed fixing"
   - If there was an error: Shows the error message

## Vercel Environment Variables (Required)

To ensure everything works properly on Vercel, configure these environment variables:

1. **NEXT_PUBLIC_SUPABASE_URL** - Your Supabase project URL
2. **NEXT_PUBLIC_SUPABASE_ANON_KEY** - Your Supabase anon/public key
3. **SUPABASE_SERVICE_ROLE_KEY** - Your Supabase service role key (for admin operations)
4. **METAAPI_TOKEN** - Your MetaApi JWT token

### How to Add Environment Variables in Vercel:
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with its corresponding value
4. Redeploy your application

## What the Auto-Fix Does

The auto-fix logic checks each trading account and fixes these issues:

1. **Has `metaapi_account_id` but status is PENDING**
   - Changes status to `CONNECTED`
   - Reason: Account is connected to MetaApi but status is wrong

2. **Missing `metaapi_account_id` but status is CONNECTED**
   - Changes status to `PENDING`
   - Reason: Account appears connected but isn't actually connected to MetaApi

## Troubleshooting

### Issue: Still showing "Fixed 0 account(s)"

**Possible causes:**
1. All accounts already have correct status
2. The `metaapi_account_id` field is empty for PENDING accounts

**Solution:**
1. Click "Debug Environment" to see the actual state
2. Check if `metaapi_account_id` is populated
3. If `metaapi_account_id` is empty, you need to reconnect the account to MetaApi

### Issue: Environment variables showing as missing in debug

**Solution:**
1. Check your `.env.local` file (for local development)
2. Check Vercel environment variables (for production)
3. Make sure variables are correctly named and have valid values

### Issue: Auto-fix returns "Not authenticated"

**Solution:**
1. Make sure you're logged in
2. Check that your session is still valid
3. Try logging out and logging back in

## Next Steps

1. Test the "Debug Environment" button to see the current state
2. Try the "Auto Fix Status Pending" button
3. If issues persist, share the debug info for further assistance
4. Consider adding the missing environment variables to Vercel for full functionality
