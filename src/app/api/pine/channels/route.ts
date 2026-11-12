/**
 * /api/pine/channels — kanal alert user (push/telegram/webhook).
 * GET: daftar. POST: simpan/ubah (upsert per type). DELETE: hapus.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePro } from '@/lib/require-pro';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { PineStoreError, deleteChannel, listChannels, upsertChannel } from '@/lib/pine/store';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = ['push', 'telegram', 'webhook'] as const;

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const channels = await listChannels(auth.user.id);
    return NextResponse.json({ success: true, channels });
  } catch (e) {
    if (e instanceof PineStoreError && e.code === 'TABLES_MISSING') {
      return NextResponse.json({ success: true, channels: [], tablesMissing: true }, { status: 200 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requirePro(request);
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 });
  }
  const type = String(body.type || '');
  if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json({ error: 'type harus push|telegram|webhook' }, { status: 400 });
  }
  const config =
    body.config && typeof body.config === 'object' && !Array.isArray(body.config)
      ? (body.config as Record<string, unknown>)
      : {};
  if (type === 'telegram' && !String(config.chatId || '').trim()) {
    return NextResponse.json({ error: 'chatId wajib untuk kanal telegram' }, { status: 400 });
  }
  if (type === 'webhook' && !/^https?:\/\//i.test(String(config.url || ''))) {
    return NextResponse.json({ error: 'URL http(s) wajib untuk kanal webhook' }, { status: 400 });
  }
  if (typeof config.secret === 'string') {
    config.secret = config.secret.slice(0, 200);
  }

  try {
    const channel = await upsertChannel(
      user!.id,
      type as (typeof ALLOWED_TYPES)[number],
      config,
      body.enabled !== false
    );
    return NextResponse.json({ success: true, channel });
  } catch (e) {
    if (e instanceof PineStoreError && e.code === 'TABLES_MISSING') {
      return NextResponse.json({ error: e.message, tablesMissing: true }, { status: 503 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { error, user } = await requirePro(request);
  if (error) return error;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 });
  try {
    await deleteChannel(id, user!.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof PineStoreError && e.code === 'TABLES_MISSING') {
      return NextResponse.json({ error: e.message, tablesMissing: true }, { status: 503 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
