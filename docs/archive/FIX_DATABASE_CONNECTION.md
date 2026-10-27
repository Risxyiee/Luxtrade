# Database Connection Fix - Production

## Problem
Production on Vercel cannot connect to Supabase database on port 6543 (connection pooling port).

## Root Cause
The connection pooling feature in Supabase is not enabled, so port 6543 is not accessible from Vercel's network.

## Solution
Changed database connection to use port 5432 (standard PostgreSQL port) instead of 6543.

### Changes Made

#### 1. `.env.production` file
```env
# Before (port 6543 with pgbouncer):
DATABASE_URL=postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true

# After (port 5432 direct connection):
DATABASE_URL=postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:5432/postgres
```

### What You Need to Do in Vercel

1. **Go to Vercel Dashboard**
   - Navigate to your project settings

2. **Update Environment Variables**
   - Go to Settings > Environment Variables
   - Find `DATABASE_URL`
   - Update it to use port 5432:
   ```
   DATABASE_URL=postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:5432/postgres
   ```

3. **Redeploy the Application**
   - Go to Deployments
   - Click the latest deployment
   - Click "Redeploy" button

4. **Verify the Fix**
   - Check the logs to ensure database connection is successful
   - Try to login and add a trade/account
   - No more "Can't reach database server" errors

### Why This Works

- **Port 5432** is the standard PostgreSQL port
- It's always available regardless of connection pooling settings
- Direct connection works fine for most applications
- Vercel can reach this port without any special configuration

### Future Optimization (Optional)

If you want to enable connection pooling for better performance:

1. Go to Supabase Dashboard > Database > Connection Pooling
2. Enable "Transaction Mode" or "Session Mode"
3. Once enabled, you can switch back to port 6543:
   ```
   DATABASE_URL=postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true
   ```

But for now, port 5432 direct connection will work perfectly fine.

### Verification Checklist

- [ ] DATABASE_URL in Vercel updated to port 5432
- [ ] Application redeployed successfully
- [ ] No database connection errors in logs
- [ ] User can login successfully
- [ ] User can add trading account
- [ ] User can add trade
