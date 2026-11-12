/**
 * POST /api/pine/live-run — picu siklus live manual untuk user ini
 * (jalankan semua script ACTIVE miliknya pada candle H1 terakhir yang
 * sudah close, emit hanya event baru, kirim alert).
 * Untuk otomatis per jam: /api/pine/cron-live (cron server).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePro } from '@/lib/require-pro';
import { runLiveCycle } from '@/lib/pine/live';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { error, user } = await requirePro(request);
  if (error) return error;
  try {
    const summary = await runLiveCycle({ trigger: 'manual', onlyUserId: user!.id });
    return NextResponse.json({ success: true, summary });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
