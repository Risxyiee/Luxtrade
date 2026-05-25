#!/usr/bin/env node

/**
 * Database Connection Verification Script
 *
 * This script tests if the DATABASE_URL is correctly configured
 * and if the database connection works.
 */

const { PrismaClient } = require('@prisma/client');

console.log('🔍 Database Connection Verification\n');
console.log('='.repeat(50));

// Check environment variables
const databaseUrl = process.env.DATABASE_URL;

console.log('\n📋 Environment Variables:');
console.log('-'.repeat(50));

if (!databaseUrl) {
  console.log('❌ DATABASE_URL is NOT set!');
  console.log('\n💡 Solution:');
  console.log('   1. Check your .env file');
  console.log('   2. Or set DATABASE_URL environment variable');
  process.exit(1);
}

console.log(`✅ DATABASE_URL is set`);
console.log(`   Protocol: ${databaseUrl.split(':')[0]}://`);

if (databaseUrl.startsWith('file:')) {
  console.log('\n⚠️  WARNING: Using SQLite database!');
  console.log('   This is only for local development.');
  console.log('   Production should use PostgreSQL.');
} else if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
  console.log('✅ Using PostgreSQL database (correct for production)');
} else {
  console.log('\n❌ ERROR: Invalid DATABASE_URL protocol!');
  console.log('   Must start with: postgresql:// or postgres://');
  process.exit(1);
}

// Test database connection
console.log('\n🔌 Testing Database Connection:');
console.log('-'.repeat(50));

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('   Connecting to database...');

    // Test simple query
    await prisma.$queryRaw`SELECT 1 as test`;

    console.log('✅ Database connection successful!');

    // Check if tables exist
    console.log('\n📊 Checking Database Tables:');
    console.log('-'.repeat(50));

    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    if (tables.length === 0) {
      console.log('⚠️  No tables found in database!');
      console.log('\n💡 Solution:');
      console.log('   Run: bun run db:push');
      console.log('   This will create all tables from your Prisma schema.');
    } else {
      console.log(`✅ Found ${tables.length} tables:`);
      tables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table.table_name}`);
      });
    }

    // Check specific required tables
    console.log('\n🔍 Checking Required Tables:');
    console.log('-'.repeat(50));

    const requiredTables = ['profiles', 'trades', 'trading_accounts', 'users'];
    const existingTableNames = tables.map(t => t.table_name);

    requiredTables.forEach(tableName => {
      if (existingTableNames.includes(tableName)) {
        console.log(`✅ ${tableName} - exists`);
      } else {
        console.log(`❌ ${tableName} - MISSING`);
      }
    });

    console.log('\n' + '='.repeat(50));
    console.log('✅ Database verification complete!\n');

    if (tables.length === 0) {
      console.log('⚠️  ACTION REQUIRED:');
      console.log('   Run: bun run db:push\n');
    }

  } catch (error) {
    console.log('\n❌ Database connection failed!');
    console.log('\nError Details:');
    console.log('-'.repeat(50));
    console.log(error.message);

    if (error.message.includes('must start with the protocol')) {
      console.log('\n💡 Solution:');
      console.log('   Your DATABASE_URL is invalid.');
      console.log('   Make sure it starts with: postgresql:// or postgres://');
      console.log('\n   Example:');
      console.log('   postgresql://user:password@host:port/database');
    } else if (error.message.includes('connection refused') || error.message.includes('connect')) {
      console.log('\n💡 Solution:');
      console.log('   1. Check if database server is running');
      console.log('   2. Verify host and port in DATABASE_URL');
      console.log('   3. Check if Supabase project is active');
    } else if (error.message.includes('authentication')) {
      console.log('\n💡 Solution:');
      console.log('   1. Check username and password in DATABASE_URL');
      console.log('   2. Verify database user has correct permissions');
    }

    console.log('\n' + '='.repeat(50) + '\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
