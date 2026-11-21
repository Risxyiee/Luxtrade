import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { callLLM, extractJson } from '@/lib/ai-llm'

/**
 * ============================================================
 * POST /api/journal/auto-parse — AUTO JURNAL (permintaan Bos)
 * ============================================================
 * Tamu (belum punya akun) tidak perlu mengetik angka satu per satu:
 * tempel saja teks mentah trade-nya (history MT4/MT5, notifikasi
 * aplikasi broker, history exchange, atau tulisan bebas), AI mengurai
 * menjadi kolom jurnal: pair, arah, entry, SL, TP, lot, catatan.
 * Form jurnal tamu di landing terisi otomatis → tamu review → simpan.
 *
 * ATURAN JUJUR:
 *  - AI TIDAK PERNAH mengarang angka — hanya angka yang ada di teks.
 *  - SL/TP/lot yang tidak disebut → kosong ('') + dilapor di `missing`
 *    supaya UI bisa bilang "isi manual ya".
 *  - LLM tidak tersedia / semua provider gagal → 503 + pesan jelas
 *    (UI mengarahkan isi manual). TIDAK ada fallback mengarang.
 *
 * Keamanan:
 *  - Rate limit 10 permintaan / 10 menit / IP (panggilan LLM berbayar).
 *  - Input dibatasi 2–2.000 karakter, dipotong keras di server.
 * ============================================================
 */

export const dynamic = 'force-dynamic'

const MAX_TEXT = 2000
const RATE = { maxRequests: 10, windowMs: 10 * 60 * 1000 }

export interface ParsedTradeFields {
  pair: string
  direction: 'BUY' | 'SELL'
  entry: string
  sl: string
  tp: string
  lot: string
  note: string
}

const SYSTEM_PROMPT = `Kamu parser jurnal trading. Tugasmu MENGURAI teks mentah trade yang ditempel user (history MT4/MT5, notifikasi broker, history exchange, atau tulisan bebas) menjadi SATU objek JSON saja — tanpa penjelasan, tanpa markdown.

FORMAT WAJIB (JSON murni):
{"pair":"XAUUSD","direction":"BUY","entry":"2034.50","sl":"2030.00","tp":"2050.00","lot":"0.10","note":"breakout London, RR 1:2"}

ATURAN KETAT:
1. pair: simbol instrumen huruf besar tanpa spasi (XAUUSD, EURUSD, BTCUSD, dst). Ambil dari teks; kalau tidak disebut sama sekali → "XAUUSD".
2. direction: "BUY" atau "SELL". buy/long/beli/purchase → BUY; sell/short/jual → SELL. Tidak jelas → "BUY".
3. entry/sl/tp/lot: STRING angka bersih — tanpa "USD"/"$", tanpa koma ribuan, tanpa teks. Desimal pakai titik. Contoh "2034.5", "0.10".
4. Harga OPEN posisi = entry. Kalau ada close/profit, abaikan utk entry — entry tetap harga buka.
5. JANGAN MENGARANG. Angka yang tidak ada di teks → kosong "" (terutama sl, tp, lot). Ini pelanggaran serius.
6. note: 1 kalimat singkat (maks 100 karakter) dari konteks/strategi user. Tidak ada → "".
7. Teks sama sekali bukan trade (tidak ada harga & tidak ada maksud mencatat posisi) → kembalikan {"error":"bukan_trade"}.
8. Balas HANYA JSON. Tidak boleh teks lain.`

/** Bersihkan angka: buang semua kecuali digit, titik, minus (koma desimal → titik). */
function num(v: unknown): string {
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (!s) return ''
  const m = s.match(/^-?\d+(?:\.\d+)?/)
  return m ? m[0] : ''
}

function sanitize(j: any): { fields?: ParsedTradeFields; error?: string } {
  if (!j || typeof j !== 'object') return { error: 'AI memberi jawaban tak valid — coba lagi.' }
  if (j.error) return { error: 'Teks belum terbaca sebagai trade — tulis harga & arahnya (buy/sell) ya.' }

  const pair = String(j.pair || 'XAUUSD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'XAUUSD'
  const direction = String(j.direction || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY'
  const entry = num(j.entry)
  const sl = num(j.sl)
  const tp = num(j.tp)
  const lot = num(j.lot)
  const note = String(j.note || '').replace(/\s+/g, ' ').trim().slice(0, 120)

  if (!entry) {
    return { error: 'Harga entry tidak ketemu di teks — tulis misal "buy xauusd 2034.5 sl 2030 tp 2050".' }
  }

  return {
    fields: {
      pair,
      direction: direction as 'BUY' | 'SELL',
      entry,
      sl,
      tp,
      lot,
      note,
    },
  }
}

export async function POST(request: NextRequest) {
  /* Rate limit dulu — sebelum sentuh LLM (murah). */
  const limited = checkRateLimit(request, `auto-journal:${getClientIp(request)}`, {
    ...RATE,
    message: 'Terlalu sering — tunggu beberapa menit lagi ya.',
  })
  if (limited) return limited

  const body = await request.json().catch(() => null) as { text?: string } | null
  const text = String(body?.text || '').trim()
  if (text.length < 2) {
    return NextResponse.json({ ok: false, error: 'Tempel teks trade-nya dulu (mis. dari MT4/MT5 atau tulis sendiri).' }, { status: 400 })
  }
  const raw = text.slice(0, MAX_TEXT)

  const res = await callLLM(
    SYSTEM_PROMPT,
    `TEKS TRADE TAMU:\n"""\n${raw}\n"""`,
    300,
    { timeoutMs: 20_000 }
  )
  if (!res || !res.text) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Layanan AI sedang tidak tersedia — coba lagi sebentar, atau isi form manual dulu ya.',
      },
      { status: 503 }
    )
  }

  const parsed = extractJson<Record<string, unknown>>(res.text)
  const out = sanitize(parsed)
  if (out.error || !out.fields) {
    return NextResponse.json({ ok: false, error: out.error || 'Gagal mengurai teks — coba tulis ulang lebih jelas.' }, { status: 422 })
  }

  const f = out.fields
  const missing: string[] = []
  if (!f.sl) missing.push('SL')
  if (!f.tp) missing.push('TP')
  if (!f.lot) missing.push('lot')

  return NextResponse.json({
    ok: true,
    fields: f,
    missing,
    provider: res.provider,
    note: missing.length
      ? `${missing.join(', ')} tidak ada di teks — cek & isi manual ya.`
      : 'Semua kolom terisi — cek ulang angkanya lalu simpan.',
  })
}
