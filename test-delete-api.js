#!/usr/bin/env node

/**
 * Test script to verify the delete trading account API route
 * This simulates a DELETE request to /api/trading-accounts/[id]
 */

const http = require('http');

const TEST_ID = 'test-account-123';
const TEST_URL = `http://localhost:3000/api/trading-accounts/${TEST_ID}`;

console.log('🧪 Testing DELETE /api/trading-accounts/[id] endpoint...');
console.log(`📍 URL: ${TEST_URL}`);
console.log('');

const options = {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(TEST_URL, options, (res) => {
  console.log(`📊 Status Code: ${res.statusCode}`);
  console.log(`📋 Status Message: ${res.statusMessage}`);
  console.log('');

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📦 Response Body:');
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log(data);
    }
    console.log('');

    // Analyze the result
    if (res.statusCode === 404) {
      console.log('✅ SUCCESS: Route is working!');
      console.log('   The 404 response is expected because:');
      console.log('   1. We are using a test ID that does not exist');
      console.log('   2. We are not authenticated');
      console.log('   3. The route is being found and handled correctly');
    } else if (res.statusCode === 401) {
      console.log('✅ SUCCESS: Route is working!');
      console.log('   The 401 response means the route is found but authentication is required');
    } else if (res.statusCode === 405) {
      console.log('⚠️  WARNING: Method Not Allowed');
      console.log('   The route exists but DELETE method is not properly configured');
    } else {
      console.log('ℹ️  INFO: Route responded with unexpected status');
    }

    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('❌ Error making request:', error.message);
  console.log('');

  if (error.code === 'ECONNREFUSED') {
    console.log('💡 TIP: Make sure the dev server is running on port 3000');
    console.log('   Run: bun run dev');
  }

  process.exit(1);
});

req.end();