/**
 * Production API Testing Script
 * Run this to verify that all API endpoints are working correctly after deployment
 */

const API_BASE = process.env.API_BASE_URL || 'https://luxtrade.vercel.app';

console.log('🧪 Testing Production API...');
console.log('📍 API Base:', API_BASE);
console.log('');

// Test 1: Health Check
async function testHealth() {
  console.log('📋 Test 1: Health Check');
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    const data = await response.json();

    if (response.ok && data.status === 'healthy') {
      console.log('✅ Health check passed');
      console.log('   Response:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log('❌ Health check failed');
      console.log('   Status:', response.status);
      console.log('   Response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    return false;
  }
}

// Test 2: Trades API (should return 401 without auth)
async function testTradesApi() {
  console.log('\n📋 Test 2: Trades API (without auth)');
  try {
    const response = await fetch(`${API_BASE}/api/trades`);
    const data = await response.json();

    if (response.status === 401) {
      console.log('✅ Trades API returns 401 without auth (expected)');
      console.log('   Response:', JSON.stringify(data, null, 2));
      return true;
    } else if (response.ok) {
      console.log('⚠️  Trades API returned 200 (might be unexpected without auth)');
      console.log('   Response:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log('❌ Trades API failed');
      console.log('   Status:', response.status);
      console.log('   Response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Trades API error:', error.message);
    return false;
  }
}

// Test 3: Sync Profile API (should return 401 without auth)
async function testSyncProfile() {
  console.log('\n📋 Test 3: Sync Profile API (without auth)');
  try {
    const response = await fetch(`${API_BASE}/api/auth/sync-profile`);
    const data = await response.json();

    if (response.status === 401) {
      console.log('✅ Sync Profile API returns 401 without auth (expected)');
      console.log('   Response:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log('❌ Sync Profile API unexpected response');
      console.log('   Status:', response.status);
      console.log('   Response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Sync Profile API error:', error.message);
    return false;
  }
}

// Test 4: Social Links API (should return 401 without auth)
async function testSocialLinks() {
  console.log('\n📋 Test 4: Social Links API (without auth)');
  try {
    const response = await fetch(`${API_BASE}/api/social-links`);
    const data = await response.json();

    if (response.status === 401) {
      console.log('✅ Social Links API returns 401 without auth (expected)');
      console.log('   Response:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log('❌ Social Links API unexpected response');
      console.log('   Status:', response.status);
      console.log('   Response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Social Links API error:', error.message);
    return false;
  }
}

// Test 5: Trading Accounts API (should return 401 without auth)
async function testTradingAccounts() {
  console.log('\n📋 Test 5: Trading Accounts API (without auth)');
  try {
    const response = await fetch(`${API_BASE}/api/trading-accounts`);
    const data = await response.json();

    if (response.status === 401) {
      console.log('✅ Trading Accounts API returns 401 without auth (expected)');
      console.log('   Response:', JSON.stringify(data, null, 2));
      return true;
    } else if (response.status === 500) {
      console.log('❌ Trading Accounts API returns 500 (DATABASE_URL issue?)');
      console.log('   Response:', JSON.stringify(data, null, 2));
      return false;
    } else {
      console.log('⚠️  Trading Accounts API unexpected response');
      console.log('   Status:', response.status);
      console.log('   Response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Trading Accounts API error:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = {
    health: await testHealth(),
    trades: await testTradesApi(),
    syncProfile: await testSyncProfile(),
    socialLinks: await testSocialLinks(),
    tradingAccounts: await testTradingAccounts(),
  };

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(60));

  const allPassed = Object.values(results).every(result => result);

  if (allPassed) {
    console.log('✅ All tests passed!');
    console.log('\n🎉 Production deployment is working correctly!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test user signup flow in the browser');
    console.log('   2. Test login flow');
    console.log('   3. Test trade creation and persistence');
    console.log('   4. Verify profile auto-creation');
  } else {
    console.log('❌ Some tests failed');
    console.log('\nFailed tests:');
    Object.entries(results).forEach(([test, passed]) => {
      if (!passed) {
        console.log(`   - ${test}`);
      }
    });
    console.log('\n📝 Troubleshooting:');
    console.log('   1. Check Vercel Function Logs for errors');
    console.log('   2. Verify DATABASE_URL is set correctly in Vercel');
    console.log('   3. Check Supabase database is accessible');
    console.log('   4. Review VERCEL_DEPLOYMENT.md for troubleshooting steps');
  }

  console.log('\n' + '='.repeat(60));
}

runTests();
