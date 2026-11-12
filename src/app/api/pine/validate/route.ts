/**
 * POST /api/pine/validate — validasi source Pine (statis + dry-run).
 * Dipakai editor saat menyimpan: script yang gagal validasi TIDAK disimpan.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { validatePineSource } from '@/lib/pine/pine-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 });
  }
  const source = typeof body.source === 'string' ? body.source : '';
  if (!source.trim()) {
    return NextResponse.json({ error: 'source wajib diisi' }, { status: 400 });
  }

  const result = await validatePineSource(source);
  return NextResponse.json({ success: true, validation: result });
}
