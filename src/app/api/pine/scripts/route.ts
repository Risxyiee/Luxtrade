/**
 * /api/pine/scripts — daftar & buat script Pine milik user (fitur PRO).
 * Script yang gagal validasi TIDAK disimpan.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePro } from '@/lib/require-pro';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { validatePineSource } from '@/lib/pine/pine-runner';
import { PineStoreError, createScript, listScripts } from '@/lib/pine/store';
import { PINE_LIMITS } from '@/lib/pine/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const scripts = await listScripts(auth.user.id);
    return NextResponse.json({ success: true, scripts });
  } catch (e) {
    if (e instanceof PineStoreError && e.code === 'TABLES_MISSING') {
      return NextResponse.json({ success: true, scripts: [], tablesMissing: true, message: e.message }, { status: 200 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requirePro(request);
  if (error) return error;
  const userId = user!.id;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 });
  }

  const name = String(body.name || '').trim().slice(0, 80) || 'Script tanpa nama';
  const source = typeof body.source === 'string' ? body.source : '';
  const kind = body.kind === 'indicator' ? 'indicator' : 'strategy';
  const symbol = String(body.symbol || 'XAUUSD').toUpperCase();
  const timeframe = String(body.timeframe || 'H1').toUpperCase();
  const config =
    body.config && typeof body.config === 'object' && !Array.isArray(body.config)
      ? (body.config as Record<string, unknown>)
      : {};

  if (!source.trim()) {
    return NextResponse.json({ error: 'source wajib diisi' }, { status: 400 });
  }
  if (source.length > PINE_LIMITS.MAX_SOURCE_BYTES) {
    return NextResponse.json({ error: `source melebihi ${PINE_LIMITS.MAX_SOURCE_BYTES} byte` }, { status: 413 });
  }
  if (!['XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'US100'].includes(symbol)) {
    return NextResponse.json({ error: 'symbol tidak didukung' }, { status: 400 });
  }
  if (!['H1', 'M15', 'H4'].includes(timeframe)) {
    return NextResponse.json({ error: 'timeframe tidak didukung (H1/M15/H4)' }, { status: 400 });
  }

  // WAJIB lolos validasi sebelum disimpan
  const validation = await validatePineSource(source);
  if (!validation.ok) {
    return NextResponse.json(
      { success: false, error: 'Validasi gagal — script tidak disimpan', validation },
      { status: 422 }
    );
  }

  try {
    const script = await createScript({
      user_id: userId,
      name,
      kind,
      source,
      validation: { ...validation, validatedAt: new Date().toISOString() },
      config,
      symbol,
      timeframe,
    });
    return NextResponse.json({ success: true, script }, { status: 201 });
  } catch (e) {
    if (e instanceof PineStoreError && e.code === 'TABLES_MISSING') {
      return NextResponse.json({ error: e.message, tablesMissing: true }, { status: 503 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
