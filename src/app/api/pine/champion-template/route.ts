/**
 * GET /api/pine/champion-template — sumber Pine port Champion v6
 * (file referensi parity Uji A) sebagai template awal editor user.
 * Edge-safe: dibaca dari konstanta hasil bundling (CF Workers tanpa FS).
 */
import { NextResponse } from 'next/server';
import { CHAMPION_V6_SOURCE } from '@/lib/pine/champion-v6-source';
import { getAuthenticatedUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser(request as never);
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ success: true, source: CHAMPION_V6_SOURCE });
}
