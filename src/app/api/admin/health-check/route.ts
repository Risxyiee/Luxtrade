import { NextResponse, NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSelfFetch } from '@/lib/cloudflare-bindings';

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

interface ProbeOpts {
  baseUrl: string;
  cookieHeader: string;
  authHeader: string;
  selfFetch: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | null;
}

async function checkApiRoute(routeName: string, routePath: string, opts: ProbeOpts): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // WAJIB bawa sesi admin ke probe. Sejak hardening keamanan P0, semua API
    // menolak request anonim dengan 401 — probe TANPA cookie pasti merah
    // padahal API sehat. requireAdmin() sudah memastikan pemanggil endpoint
    // ini admin, jadi meneruskan cookie/Authorization miliknya aman.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (opts.cookieHeader) headers['Cookie'] = opts.cookieHeader;
    if (opts.authHeader) headers['Authorization'] = opts.authHeader;

    const url = `${opts.baseUrl}${routePath}`;

    // FIX 403 "HTTP 403 - Forbidden" di panel admin (2026-11-05):
    // Dulu probe pakai fetch(process.env.PUBLIC_SITE_URL || 'http://localhost:3000').
    // PUBLIC_SITE_URL tidak pernah diset → baseUrl jatuh ke localhost → runtime
    // Cloudflare Workers BLOK fetch ke loopback/private IP dengan 403 instan
    // (anti-SSRF) → semua API terlihat "Unhealthy 2ms" padahal sehat.
    //
    // Sekarang dua lapis:
    //   1. SELF service binding — worker memanggil dirinya langsung TANPA lewat
    //      edge/DNS publik (lihat komentar "Self Service Binding" wrangler.jsonc:
    //      fetch ke custom domain sendiri dari dalam worker terbukti 522/403).
    //      Respons = persis respons route asli.
    //   2. Fallback fetch publik dengan URL yang benar (NEXT_PUBLIC_SITE_URL),
    //      dipakai saat binding absen (lokal/dev).
    const response = opts.selfFetch
      ? await opts.selfFetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(10_000),
        })
      : await fetch(url, {
          method: 'GET',
          headers,
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        });

    const responseTime = Date.now() - start;

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let parsed = false;
      try {
        const errorData = await response.json() as { error?: string; message?: string };
        if (errorData?.error) {
          errorMessage += ` - ${errorData.error}`;
          parsed = true;
        } else if (errorData?.message) {
          errorMessage += ` - ${errorData.message}`;
          parsed = true;
        }
      } catch {
        // Body non-JSON (mis. halaman blok edge) — pakai statusText
      }
      if (!parsed) {
        errorMessage += ` - ${response.statusText || 'respons non-JSON'}`;
      }
      if (response.status === 401 || response.status === 403) {
        errorMessage += ' (sesi admin tidak terbawa ke probe — refresh halaman atau login ulang)';
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

export async function GET(request: NextRequest) {
  // P0 HARDENING: dulu TERBUKA — bocorkan status internal DB & latency API
  // ke publik. Sekarang khusus admin (dipakai /dashboard/admin/system-health).
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  const startTime = Date.now();

  // Service binding SELF (null saat lokal tanpa CF context) → fallback fetch publik.
  const selfFetch = await getSelfFetch();
  // Samakan variabel dengan rute lain: NEXT_PUBLIC_SITE_URL (bukan PUBLIC_SITE_URL
  // yang tidak pernah diset — itu penyebab fallback ke localhost & 403 anti-SSRF).
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id';
  const cookieHeader = request.headers.get('cookie') || '';
  const authHeader = request.headers.get('authorization') || '';

  // Run all health checks in parallel using Promise.allSettled
  const checks = await Promise.allSettled([
    checkDatabaseConnection(),
    checkApiRoute('Trades API', '/api/trades', { baseUrl, cookieHeader, authHeader, selfFetch }),
    checkApiRoute('Journal API', '/api/journal', { baseUrl, cookieHeader, authHeader, selfFetch }),
    // Note: AI API only supports POST requests, skipping GET health check
    checkApiRoute('Notifications API', '/api/notifications/preferences', { baseUrl, cookieHeader, authHeader, selfFetch }),
    checkApiRoute('Trading Accounts API', '/api/trading-accounts', { baseUrl, cookieHeader, authHeader, selfFetch }),
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
