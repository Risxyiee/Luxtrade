import { createClient } from '@supabase/supabase-js';

const url = 'https://klxkdrfsfcoankbaoejn.supabase.co';
const anonKey = 'REDACTED-DEAD-KEY';

const supabase = createClient(url, anonKey);

console.log('Testing Supabase connection with ANON_KEY...');

// Test 1: Try to get session
console.log('\n--- Test 1: Get Session ---');
await supabase.auth.getSession()
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Failed:', error.message);
      console.error('Error code:', error.status);
    } else {
      console.log('✅ Success');
      console.log('Has session:', !!data.session);
    }
  });

// Test 2: Try to get user (if logged in)
console.log('\n--- Test 2: Get User ---');
await supabase.auth.getUser()
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Failed:', error.message);
      console.error('Error code:', error.status);
    } else {
      console.log('✅ Success');
      console.log('User:', data.user ? data.user.email : 'Not logged in');
    }
  });

// Test 3: Try to query profiles table
console.log('\n--- Test 3: Query Profiles ---');
await supabase.from('profiles').select('count', { count: 'exact', head: true })
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Failed:', error.message);
      console.error('Error code:', error.status);
      console.error('Error hint:', error.hint);
    } else {
      console.log('✅ Success');
      console.log('Profiles count:', data?.count || 0);
    }
  });
