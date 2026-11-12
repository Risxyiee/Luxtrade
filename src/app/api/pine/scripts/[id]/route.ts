/**
 * /api/pine/scripts/[id] — detail, update (versi otomatis), hapus script.
 * Validasi ulang wajib saat source berubah; gagal validasi = tidak disimpan.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePro } from '@/lib/require-pro';
import { validatePineSource } from '@/lib/pine/pine-runner';
import { PineStoreError, deleteScript, getScript, updateScript } from '@/lib/pine/store';
import { PINE_LIMITS } from '@/lib/pine/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

async function userIdOf(request: NextRequest): Promise<string | null> {
  const { getAuthenticatedUser } = await import('@/lib/api-auth');
  const auth = await getAuthenticatedUser(request);
  return auth.user?.id || null;
}

function storeError(e: unknown): NextResponse {
  if (e instanceof PineStoreError && e.code === 'TABLES_MISSING') {
    return NextResponse.json({ error: e.message, tablesMissing: true }, { status: 503 });
  }
  const msg = e instanceof Error ? e.message : 'Kesalahan tak terduga';
  const status = e instanceof PineStoreError && e.code === 'DB_UNAVAILABLE' ? 503 : 500;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const uid = await userIdOf(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const script = await getScript(id, uid);
    if (!script) return NextResponse.json({ error: 'Script tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ success: true, script });
  } catch (e) {
    return storeError(e);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { error, user } = await requirePro(request);
  if (error) return error;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 });
  }

  const existing = await getScript(id, user!.id).catch(() => null);
  if (!existing) return NextResponse.json({ error: 'Script tidak ditemukan' }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  if (body.config && typeof body.config === 'object' && !Array.isArray(body.config)) {
    patch.config = body.config;
  }
  if (typeof body.alerts_enabled === 'boolean') patch.alerts_enabled = body.alerts_enabled;
  if (body.status === 'ACTIVE' || body.status === 'PAUSED') patch.status = body.status;
  if (typeof body.symbol === 'string') patch.symbol = body.symbol.toUpperCase();
  if (typeof body.timeframe === 'string') patch.timeframe = body.timeframe.toUpperCase();

  let sourceChanged = false;
  if (typeof body.source === 'string' && body.source.trim() && body.source !== existing.source) {
    if (body.source.length > PINE_LIMITS.MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: `source melebihi ${PINE_LIMITS.MAX_SOURCE_BYTES} byte` }, { status: 413 });
    }
    const validation = await validatePineSource(body.source);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: 'Validasi gagal — perubahan tidak disimpan', validation },
        { status: 422 }
      );
    }
    patch.source = body.source;
    patch.validation = { ...validation, validatedAt: new Date().toISOString() };
    patch.version = existing.version + 1;
    sourceChanged = true;
  }

  try {
    const script = await updateScript(id, user!.id, patch);
    return NextResponse.json({ success: true, script, sourceChanged });
  } catch (e) {
    return storeError(e);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { error, user } = await requirePro(request);
  if (error) return error;
  const { id } = await ctx.params;
  try {
    await deleteScript(id, user!.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return storeError(e);
  }
}
