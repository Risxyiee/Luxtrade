/**
 * GET/POST /api/pine/cron-live — siklus LIVE Pine Signals (semua user).
 * Auth: Bearer PINE_CRON_SECRET atau CRON_SECRET — fail-closed
 * (pola sama dengan /api/cron/strategy-alerts).
 *
 * Slot cron H1: jalankan beberapa menit setelah jam (mis. menit ke-2)
 * supaya candle H1 benar-benar sudah close di sumber data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runLiveCycle } from '@/lib/pine/live';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authOk(request: NextRequest): boolean {
  const secret = process.env.PINE_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${secret}`;
}

async function handle(request: NextRequest) {
  if (!authOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const summary = await runLiveCycle({ trigger: 'live' });
  return NextResponse.json({ success: true, summary });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
