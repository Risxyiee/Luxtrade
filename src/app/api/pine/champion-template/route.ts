/**
 * GET /api/pine/champion-template — sumber Pine port Champion v6
 * (file referensi parity Uji A) sebagai template awal editor user.
 */
import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getAuthenticatedUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser(request as never);
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const p = path.join(process.cwd(), 'src', 'lib', 'pine', 'champion-v6.pine');
    const source = readFileSync(p, 'utf8');
    return NextResponse.json({ success: true, source });
  } catch {
    return NextResponse.json({ error: 'Template tidak tersedia' }, { status: 404 });
  }
}
