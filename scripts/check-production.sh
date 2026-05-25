#!/bin/bash

# Production API Check Script
# Usage: ./check-production.sh <YOUR_PRODUCTION_URL>

if [ -z "$1" ]; then
  echo "❌ Error: Please provide your production URL"
  echo ""
  echo "Usage: ./check-production.sh <YOUR_PRODUCTION_URL>"
  echo ""
  echo "Example:"
  echo "  ./check-production.sh https://luxtrade.vercel.app"
  echo "  ./check-production.sh https://luxtradee.web.id"
  exit 1
fi

PRODUCTION_URL="$1"

echo "🧪 Testing Production API at: $PRODUCTION_URL"
echo "========================================"
echo ""

# Test 1: Health Check
echo "📋 Test 1: Health Check"
HEALTH_RESPONSE=$(curl -s "$PRODUCTION_URL/api/health")
echo "Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
  echo "✅ Health check passed"
elif echo "$HEALTH_RESPONSE" | grep -q "<!doctype html>"; then
  echo "❌ Health check failed - received HTML instead of JSON"
  echo "   This indicates a routing or configuration issue"
else
  echo "⚠️  Unexpected response"
fi
echo ""

# Test 2: Trades API
echo "📋 Test 2: Trades API (without auth)"
TRADES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PRODUCTION_URL/api/trades")
echo "HTTP Status: $TRADES_STATUS"

if [ "$TRADES_STATUS" = "401" ]; then
  echo "✅ Trades API returns 401 without auth (expected)"
elif [ "$TRADES_STATUS" = "500" ]; then
  echo "❌ Trades API returns 500 (DATABASE_URL issue?)"
elif [ "$TRADES_STATUS" = "200" ]; then
  echo "⚠️  Trades API returns 200 (check if returning data without auth)"
else
  echo "⚠️  Unexpected status code: $TRADES_STATUS"
fi
echo ""

# Test 3: Sync Profile API
echo "📋 Test 3: Sync Profile API (without auth)"
SYNC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PRODUCTION_URL/api/auth/sync-profile")
echo "HTTP Status: $SYNC_STATUS"

if [ "$SYNC_STATUS" = "401" ]; then
  echo "✅ Sync Profile API returns 401 without auth (expected)"
elif [ "$SYNC_STATUS" = "500" ]; then
  echo "❌ Sync Profile API returns 500 (DATABASE_URL issue?)"
else
  echo "⚠️  Unexpected status code: $SYNC_STATUS"
fi
echo ""

# Test 4: Trading Accounts API
echo "📋 Test 4: Trading Accounts API (without auth)"
ACCOUNTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PRODUCTION_URL/api/trading-accounts")
echo "HTTP Status: $ACCOUNTS_STATUS"

if [ "$ACCOUNTS_STATUS" = "401" ]; then
  echo "✅ Trading Accounts API returns 401 without auth (expected)"
elif [ "$ACCOUNTS_STATUS" = "500" ]; then
  echo "❌ Trading Accounts API returns 500 (DATABASE_URL issue - most likely!)"
  echo ""
  echo "🔧 Troubleshooting for 500 errors:"
  echo "   1. Check Vercel Dashboard → Settings → Environment Variables"
  echo "   2. Verify DATABASE_URL is set with correct PostgreSQL connection string"
  echo "   3. Check Vercel Function Logs for detailed error messages"
  echo "   4. Verify Supabase database is accessible"
else
  echo "⚠️  Unexpected status code: $ACCOUNTS_STATUS"
fi
echo ""

echo "========================================"
echo "📊 Test Summary"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. If all tests pass ✅ - Test user signup and login in browser"
echo "2. If you see 500 errors ❌ - Check DATABASE_URL in Vercel environment variables"
echo "3. If you see HTML responses ❌ - Check Vercel deployment and routing configuration"
echo ""
echo "For detailed troubleshooting, see: VERCEL_DEPLOYMENT.md"
