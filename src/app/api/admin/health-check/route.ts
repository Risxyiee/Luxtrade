import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

async function checkDatabaseConnection(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Check if Supabase is accessible by creating a client
    const supabase = await createSupabaseClient();

    // Simple health check - try to query a known table
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - start;

    if (error) {
      return {
        name: 'Supabase Database',
        status: 'unhealthy',
        responseTime,
        error: error.message,
      };
    }

    return {
      name: 'Supabase Database',
      status: 'healthy',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - start;
    return {
      name: 'Supabase Database',
      status: 'unhealthy',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

async function checkApiRoute(routeName: string, routePath: string): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const baseUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}${routePath}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const responseTime = Date.now() - start;

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage += ` - ${errorData.error}`;
        } else if (errorData.message) {
          errorMessage += ` - ${errorData.message}`;
        }
      } catch {
        // If we can't parse JSON, use status text
        errorMessage += ` - ${response.statusText}`;
      }

      return {
        name: routeName,
        status: 'unhealthy',
        responseTime,
        error: errorMessage,
      };
    }

    return {
      name: routeName,
      status: 'healthy',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - start;
    return {
      name: routeName,
      status: 'unhealthy',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown API error',
    };
  }
}

export async function GET() {
  const startTime = Date.now();

  // Run all health checks in parallel using Promise.allSettled
  const checks = await Promise.allSettled([
    checkDatabaseConnection(),
    checkApiRoute('Trades API', '/api/trades'),
    checkApiRoute('Journal API', '/api/journal'),
    // Note: AI API only supports POST requests, skipping GET health check
    checkApiRoute('Notifications API', '/api/notifications/preferences'),
    checkApiRoute('Trading Accounts API', '/api/trading-accounts'),
  ]);

  const results = checks.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        name: 'Unknown Service',
        status: 'unhealthy' as const,
        error: result.reason?.message || 'Unknown error',
      };
    }
  });

  const totalResponseTime = Date.now() - startTime;
  const healthyCount = results.filter((r) => r.status === 'healthy').length;
  const unhealthyCount = results.length - healthyCount;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    totalResponseTime,
    summary: {
      total: results.length,
      healthy: healthyCount,
      unhealthy: unhealthyCount,
      overallHealth: unhealthyCount === 0 ? 'healthy' : unhealthyCount === results.length ? 'unhealthy' : 'degraded',
    },
    results,
  });
}