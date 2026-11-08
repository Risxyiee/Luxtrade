import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'
import { getMarketListenerStatus } from '@/services/marketListener'

/**
 * GET /api/vip-signals/latest — feed sinyal VIP terakhir (PUBLIK).
 *
 * Sumber: tabel market_alerts (log setiap sinyal yang ter-broadcast
 * oleh Real-time Alert Engine — jalur WS maupun cron REST).
 * Dipakai untuk verifikasi dari luar (probe Bos) & bahan widget
 * frontend nanti ("Sinyal VIP Terbaru" = alat marketing).
 *
 * Tanpa nilai secret. Error DB → ok:false + daftar kosong (tetap 200
 * agar probe eksternal tidak salah paham server mati).
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 20)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 20

  const admin = await getSupabaseAdminAsync()
  if (!admin) {
    return NextResponse.json({
      ok: false,
      error: 'database tidak tersedia',
      engine: getMarketListenerStatus(),
      signals: [],
    })
  }

  try {
    const { data, error } = await admin
      .from('market_alerts')
      .select('id, symbol, action, entry_price, sl, tp, trigger_price, source, broadcast_count, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      return NextResponse.json({ ok: false, error: 'tabel market_alerts belum siap', signals: [] })
    }
    return NextResponse.json({
      ok: true,
      count: (data ?? []).length,
      engine: getMarketListenerStatus(),
      signals: data ?? [],
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'gagal membaca sinyal', signals: [] })
  }
}
