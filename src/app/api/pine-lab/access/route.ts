/**
 * ============================================================
 * GET /api/pine-lab/access — cek gate untuk halaman /pine-lab
 * ============================================================
 * 401 = belum login; 403 = login tapi tanpa flag; 200 = boleh.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePineLab } from '@/lib/pine-lab/access'
import { PINE_LAB_CONFIG } from '@/lib/pine-lab/config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const gate = await requirePineLab(request)
  if (gate instanceof NextResponse) return gate
  return NextResponse.json({
    allowed: true,
    email: gate.user.email,
    quotas: {
      maxActiveScripts: PINE_LAB_CONFIG.MAX_ACTIVE_SCRIPTS,
      maxTotalScripts: PINE_LAB_CONFIG.MAX_TOTAL_SCRIPTS,
      maxManualRunsPerHour: PINE_LAB_CONFIG.MAX_MANUAL_RUNS_PER_HOUR,
      maxSourceKb: PINE_LAB_CONFIG.MAX_SOURCE_KB,
    },
    symbols: PINE_LAB_CONFIG.ALLOWED_SYMBOLS,
  })
}
