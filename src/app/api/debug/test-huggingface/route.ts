import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to check HuggingFace API connectivity
 * Returns detailed connection status
 */
export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    checks: {
      envToken: {
        name: 'HUGGING_FACE_API_TOKEN',
        exists: !!process.env.HUGGING_FACE_API_TOKEN,
        length: process.env.HUGGING_FACE_API_TOKEN?.length || 0,
        valid: false
      },
      dnsLookup: {
        name: 'DNS Resolution (api-inference.huggingface.co)',
        success: false,
        error: null as string | null
      },
      apiConnection: {
        name: 'API Connection Test',
        success: false,
        statusCode: null as number | null,
        error: null as string | null
      }
    },
    summary: ''
  };

  // Check token format (starts with hf_)
  if (process.env.HUGGING_FACE_API_TOKEN?.startsWith('hf_')) {
    results.checks.envToken.valid = true;
  }

  // Test DNS resolution and API connection
  try {
    console.log('🔍 Testing HuggingFace API connectivity...');

    // Try to fetch from HuggingFace (simple GET request)
    const response = await fetch('https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-2B-Instruct', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGING_FACE_API_TOKEN || ''}`,
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    results.checks.dnsLookup.success = true;
    results.checks.apiConnection.statusCode = response.status;

    if (response.ok || response.status === 404) {
      results.checks.apiConnection.success = true;
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      results.checks.apiConnection.error = `HTTP ${response.status}: ${errorText}`;
    }

  } catch (error: any) {
    console.error('❌ HuggingFace API test failed:', error);

    // DNS/Network error
    if (error.code === 'ENOTFOUND') {
      results.checks.dnsLookup.error = `DNS resolution failed: ${error.hostname}`;
      results.checks.apiConnection.error = 'Cannot resolve api-inference.huggingface.co - Network/Firewall issue';
    } else if (error.code === 'ETIMEDOUT') {
      results.checks.dnsLookup.error = 'Connection timed out';
      results.checks.apiConnection.error = 'Connection timed out - Firewall or network issue';
    } else if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      results.checks.apiConnection.error = 'Request timeout (10s) - Firewall or slow connection';
    } else {
      results.checks.apiConnection.error = error.message || 'Unknown error';
    }
  }

  // Generate summary
  const issues: string[] = [];

  if (!results.checks.envToken.exists) {
    issues.push('❌ HUGGING_FACE_API_TOKEN not set in environment variables');
  } else if (!results.checks.envToken.valid) {
    issues.push('❌ HUGGING_FACE_API_TOKEN format invalid (should start with hf_)');
  }

  if (!results.checks.dnsLookup.success) {
    issues.push(`❌ DNS resolution failed: ${results.checks.dnsLookup.error}`);
  }

  if (!results.checks.apiConnection.success) {
    issues.push(`❌ API connection failed: ${results.checks.apiConnection.error}`);
  }

  if (issues.length === 0) {
    results.summary = '✅ All checks passed! HuggingFace API is accessible.';
  } else {
    results.summary = `❌ ${issues.length} issue(s) found:\n${issues.join('\n')}`;
  }

  return NextResponse.json(results, {
    status: issues.length === 0 ? 200 : 503
  });
}