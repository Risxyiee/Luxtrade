/**
 * GET /api/pine/events — riwayat event terbaru user (log dashboard).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { PineStoreError, listEvents } from '@/lib/pine/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const limitParam = Number(request.nextUrl.searchParams.get('limit') || '50');
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 200);
  try {
    const events = await listEvents(auth.user.id, limit);
    return NextResponse.json({ success: true, events });
  } catch (e) {
    if (e instanceof PineStoreError && e.code === 'TABLES_MISSING') {
      return NextResponse.json({ success: true, events: [], tablesMissing: true }, { status: 200 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
