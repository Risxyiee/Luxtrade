import { MetaApi } from 'metaapi.cloud-sdk';

const token = 'REDACTED-DEAD-KEY';

const api = new MetaApi(token);

async function checkMetaApiAccounts() {
  console.log('🔍 Checking MetaApi accounts...\n');

  try {
    const accounts = await api.accountsApi.getAccounts();

    console.log(`✅ Found ${accounts.length} account(s) in MetaApi:\n`);

    for (const account of accounts) {
      console.log('--- Account ---');
      console.log(`ID: ${account.id}`);
      console.log(`Login: ${account.login}`);
      console.log(`Server: ${account.server}`);
      console.log(`Platform: ${account.platform}`);
      console.log(`State: ${account.state}`);
      console.log(`Connection status: ${account.connectionStatus}`);
      console.log(`Synchronization mode: ${account.synchronizationMode}`);
      console.log('');
    }

    if (accounts.length === 0) {
      console.log('ℹ️ No accounts found in MetaApi');
    }

  } catch (error) {
    console.error('❌ Error fetching MetaApi accounts:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkMetaApiAccounts();
