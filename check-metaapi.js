import { MetaApi } from 'metaapi.cloud-sdk';

const token = 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJmMDNhMTk2NDljN2IyZTJlMTQ2YjE4NDMyMGU5MzY1ZiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JVNFUl9JRCQ6KiJdfSx7ImlkIjoibWV0YWFwaS1yZWFsLXRpbWUtc3RyZWFtaW5nLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFzdGF0cy1hcGkiLCJtZXRob2RzIjpbIm1ldGFzdGF0cy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoicmlzay1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsicmlzay1tYW5hZ2VtZW50LWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJjb3B5ZmFjdG9yeS1hcGkiLCJtZXRob2RzIjpbImNvcHlmYWN0b3J5LWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtdC1tYW5hZ2VyLWFwaSIsIm1ldGhvZHMiOlsibXQtbWFuYWdlci1hcGk6cmVzdDpkZWFsaW5nOio6KiIsIm10LW1hbmFnZXItYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6ImJpbGxpbmctYXBpIiwibWV0aG9kcyI6WyJiaWxsaW5nLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19XSwiaWdub3JlUmF0ZUxpbWl0cyI6ZmFsc2UsInRva2VuSWQiOiIyMDIxMDIxMyIsImltcGVyc29uYXRlZCI6ZmFsc2UsInJlYWxVc2VySWQiOiJmMDNhMTk2NDljN2IyZTJlMTQ2YjE4NDMyMGU5MzY1ZiIsImlhdCI6MTc3OTE2MjczMiwiZXhwIjoxNzg2OTM4NzMyfQ.UHMnOFZTcSmGKfFSLSBxCZtGrTUU4ezq1Fb3H_E34COCEnODw4N-oMNCU0o4MPVtY5qjF3hfqRabckta_k-QNOhUVxCOHmB_ZY_rGjC_uup97AY9Jr3sXCrd3-ipufBS5qCNCWYG4MR7J5HwoYLS68VokpVcLhYW7WXGKkQ4TZ9W9hzcNeFOMeuAyMPpybX8nk0S1Dg5IhIc29EXQOAv2Hh1yf1dGfMKMGfoknXJjhihhtVV3aUszi_-ZUb0Kcf86VS1j0qskcTwpBhyGOdoqfwegTS9YhiPOBvjuLTpIXJiCuh6RhBSTERsuKNOJZVjw5vnRIqHMjpCuxtrR2OLFYva1F9Sti5pl20eutLzKGdPwPKYxNzIQpLsw86fYRBY3lDPtaxsoED238WN37Xv8CuHWalxYs_DIwofSWYoX0OVCY6If8cBeMA1hfP2L-5mZkIE4ZPv1oQQdWw5PhkG1BUJgM8avH0I-CCy16xgJTpEQf1QYj5MICG3oIpPJyWvLeWa15zKlerPe_9YcYiwlXtUW3mvQyeMVb4oyPI6unznFN0IIA1QC_FJNf5-hJBi68iZxQpQhKoEbew748hp5iknLVaupSS2OCTTEoeBIIC9UeH-tpnJSwIunvrQG6DM_AG6lAkpGEwOPDOi61ZrRwX9EWXXhVrjFeIp34QSIUE';

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
