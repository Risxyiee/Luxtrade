/**
 * Standalone migration script to add `consistency_rule` and `best_day_pl`
 * columns to the `prop_firm_challenges` table in Supabase.
 *
 * Usage:
 *   node scripts/migrate-prop-firm-challenges.js
 *
 * Required environment variables (set in .env or pass directly):
 *   SUPABASE_DB_URL - PostgreSQL connection string
 *     Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * Alternative: Set individual components:
 *   SUPABASE_PROJECT_REF - Project reference (e.g., klxkdrfsfcoankbaoejn)
 *   SUPABASE_DB_PASSWORD - Database password
 *   SUPABASE_DB_REGION - Region (e.g., ap-southeast-1)
 *
 * Or use the Supabase Management API:
 *   SUPABASE_ACCESS_TOKEN - Personal access token from https://supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF - Project reference
 */

const MIGRATION_SQL = `
-- Add consistency_rule and best_day_pl columns to prop_firm_challenges
ALTER TABLE prop_firm_challenges ADD COLUMN IF NOT EXISTS consistency_rule FLOAT DEFAULT 0;
ALTER TABLE prop_firm_challenges ADD COLUMN IF NOT EXISTS best_day_pl FLOAT DEFAULT 0;
`;

const VERIFY_SQL = `
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'prop_firm_challenges'
  AND table_schema = 'public'
  AND column_name IN ('consistency_rule', 'best_day_pl')
ORDER BY column_name;
`;

async function runWithPg() {
  const { Client } = require('pg');

  let connectionString = process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    const ref = process.env.SUPABASE_PROJECT_REF || 'klxkdrfsfcoankbaoejn';
    const password = process.env.SUPABASE_DB_PASSWORD;
    const region = process.env.SUPABASE_DB_REGION || 'ap-southeast-1';

    if (!password) {
      console.error('❌ SUPABASE_DB_PASSWORD is required when not using SUPABASE_DB_URL');
      console.error('   Get it from: Supabase Dashboard → Settings → Database → Connection string');
      return false;
    }

    connectionString = `postgresql://postgres.${ref}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
  }

  console.log('🔗 Connecting to Supabase PostgreSQL...');
  console.log(`   Host: ${new URL(connectionString).hostname}`);

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Verify current state
    console.log('\n🔍 Checking current columns...');
    const verifyResult = await client.query(VERIFY_SQL);

    if (verifyResult.rows.length >= 2) {
      console.log('✅ Columns already exist:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (default: ${row.column_default})`);
      });
      return true;
    }

    if (verifyResult.rows.length > 0) {
      console.log('⚠️  Partial migration detected. Some columns exist:');
      verifyResult.rows.forEach(row => console.log(`   - ${row.column_name}`));
    }

    // Execute migration
    console.log('\n🚀 Running migration...');
    await client.query(MIGRATION_SQL);
    console.log('✅ Migration SQL executed successfully');

    // Verify
    console.log('\n🔍 Verifying migration...');
    const postVerify = await client.query(VERIFY_SQL);

    if (postVerify.rows.length >= 2) {
      console.log('✅ Migration verified! Columns added:');
      postVerify.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (default: ${row.column_default})`);
      });
      return true;
    } else {
      console.error('❌ Verification failed: columns not found after migration');
      return false;
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message || error);
    return false;
  } finally {
    await client.end();
  }
}

async function runWithManagementAPI() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'klxkdrfsfcoankbaoejn';

  if (!accessToken) {
    console.error('❌ SUPABASE_ACCESS_TOKEN is required for Management API approach');
    console.error('   Get it from: https://supabase.com/dashboard/account/tokens');
    return false;
  }

  console.log('🔗 Using Supabase Management API...');
  console.log(`   Project: ${projectRef}`);

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: MIGRATION_SQL }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Management API error:', response.status, error);
      return false;
    }

    const result = await response.json();
    console.log('✅ Migration executed via Management API');
    console.log('   Result:', JSON.stringify(result, null, 2));
    return true;

  } catch (error) {
    console.error('❌ Management API failed:', error.message || error);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Migration: Add consistency_rule & best_day_pl');
  console.log('  Table: prop_firm_challenges');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Migration SQL:');
  console.log(MIGRATION_SQL);

  // Try approach 1: Direct PostgreSQL connection (pg package)
  if (process.env.SUPABASE_DB_URL || process.env.SUPABASE_DB_PASSWORD) {
    console.log('\n📌 Approach: Direct PostgreSQL connection (pg package)');
    const success = await runWithPg();
    if (success) {
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
    }
    process.exit(1);
  }

  // Try approach 2: Supabase Management API
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    console.log('\n📌 Approach: Supabase Management API');
    const success = await runWithManagementAPI();
    if (success) {
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
    }
    process.exit(1);
  }

  // No credentials available
  console.log('❌ No database credentials found!');
  console.log('\nTo run this migration, set one of the following:');
  console.log('');
  console.log('Option 1: Direct PostgreSQL connection');
  console.log('  export SUPABASE_DB_URL="postgresql://postgres.klxkdrfsfcoankbaoejn:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"');
  console.log('  node scripts/migrate-prop-firm-challenges.js');
  console.log('');
  console.log('Option 2: Individual components');
  console.log('  export SUPABASE_DB_PASSWORD="your-db-password"');
  console.log('  node scripts/migrate-prop-firm-challenges.js');
  console.log('');
  console.log('Option 3: Supabase Management API');
  console.log('  export SUPABASE_ACCESS_TOKEN="your-personal-access-token"');
  console.log('  node scripts/migrate-prop-firm-challenges.js');
  console.log('');
  console.log('Option 4: Manual (easiest!)');
  console.log('  1. Go to https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn/sql');
  console.log('  2. Paste the SQL above');
  console.log('  3. Click "Run"');
  console.log('');
  console.log('Get credentials from:');
  console.log('  DB Password: Supabase Dashboard → Settings → Database');
  console.log('  Access Token: https://supabase.com/dashboard/account/tokens');

  process.exit(1);
}

main();
