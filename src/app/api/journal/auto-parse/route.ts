import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { callLLM, extractJson } from '@/lib/ai-llm'
import { analyzeImageWithAiml } from '@/lib/aiml-vision'
import { analyzeImageWithZAIVision } from '@/lib/zai-vision'

/**
 * ============================================================
 * POST /api/journal/auto-parse — AUTO JURNAL (permintaan Bos)
 * ============================================================
 * Dua input, SATU endpoint:
 *   1. TEKS  (JSON {text}) — tempel teks mentah trade (history MT4/MT5,
 *      notifikasi broker, tulisan bebas) → LLM mengurai.
 *   2. FOTO  (multipart 'image') — upload screenshot trade (MT4/MT5,
 *      TradingView, notifikasi) → AI VISION membaca angka langsung
 *      dari gambar. Hasil ditampilkan LANGSUNG di landing dengan
 *      tampilan kaya dashboard (permintaan Bos: "upload foto nanti
 *      langsung muncul hasil kaya yang di dashboard").
 *
 * ATURAN JUJUR:
 *  - AI TIDAK PERNAH mengarang angka — hanya angka yang terbaca.
 *  - SL/TP/lot yang tidak terlihat → kosong ('') + dilapor di `missing`.
 *  - Semua provider mati → 503 + pesan jelas. TIDAK ada fallback mengarang.
 *  - Foto tamu DIPROSES DI MEMORI — TIDAK disimpan ke storage (privasi).
 *
 * Keamanan:
 *  - Rate limit 10 permintaan / 10 menit / IP (panggilan vision berbayar).
 *  - Teks dibatasi 2.000 karakter; gambar ≤10 MB, hanya image/*.
 * ============================================================
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_TEXT = 2000
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
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

/** Kolom ekstra yang bisa dibaca dari screenshot (tidak ada di teks):
 *  harga keluar & profit/loss — untuk kartu hasil gaya dashboard. */
export interface ParsedTradeExtra {
  exit: string
  profit: string
}

const TEXT_PROMPT = `Kamu parser jurnal trading. Tugasmu MENGURAI teks mentah trade yang ditempel user (history MT4/MT5, notifikasi broker, history exchange, atau tulisan bebas) menjadi SATU objek JSON saja — tanpa penjelasan, tanpa markdown.

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

const VISION_PROMPT = `Analyze this trading platform screenshot (MT4/MT5, TradingView, broker/exchange app) and extract the trade data. Return ONLY one JSON object, no markdown, no explanation:
{"pair":"XAUUSD","type":"BUY","size":"0.10","entry_price":"2034.50","exit_price":"2040.20","stop_loss":"2030.00","take_profit":"2050.00","profit":"27.50"}

RULES:
1. pair: instrument symbol uppercase, no spaces (XAUUSD, EURUSD, BTCUSD...). Not visible → null.
2. type: exactly "BUY" or "SELL" (buy/long → BUY, sell/short → SELL). Not visible → null.
3. size: lot/volume as clean number string ("0.10"). Not visible → null.
4. entry_price: the OPEN price of the position. Not visible → null.
5. exit_price: close price if visible → else null.
6. stop_loss / take_profit: visible prices only → else null.
7. profit: P/L amount ("27.50" or "-31.25", negative for loss). Not visible → null.
8. NEVER INVENT numbers — use null for anything not clearly visible in the image. Numbers only from the image.
9. Ignore dates, times, order IDs, account numbers — only trade data above.`

/** Bersihkan angka: buang semua kecuali digit, titik, minus (koma desimal → titik). */
function num(v: unknown): string {
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (!s || s === 'null') return ''
  const m = s.match(/^-?\d+(?:\.\d+)?/)
  return m ? m[0] : ''
}

function buildNote(missing: string[], source: 'teks' | 'screenshot'): string {
  if (missing.length) {
    return `${missing.join(', ')} tidak terbaca di ${source} — cek & isi manual ya.`
  }
  return `Semua kolom terbaca dari ${source} — cek ulang angkanya lalu simpan.`
}

function sanitizeText(j: any): { fields?: ParsedTradeFields; error?: string } {
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

function sanitizeImage(j: any): { fields?: ParsedTradeFields; extra?: ParsedTradeExtra; error?: string } {
  if (!j || typeof j !== 'object') return { error: 'AI memberi jawaban tak valid — coba lagi.' }
  if (j.error) return { error: 'Screenshot belum terbaca sebagai trade — coba gambar yang lebih jelas ya.' }

  const rawPair = String(j.pair || j.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  const direction = String(j.type || j.direction || '').toUpperCase() === 'SELL' ? 'SELL' : 'BUY'
  const entry = num(j.entry_price ?? j.entry)
  const sl = num(j.stop_loss ?? j.sl)
  const tp = num(j.take_profit ?? j.tp)
  const lot = num(j.size ?? j.lot ?? j.volume)
  const exit = num(j.exit_price ?? j.exit)
  const profit = num(j.profit ?? j.profit_loss)

  if (!entry) {
    return {
      error:
        'Harga entry tidak terbaca dari screenshot — pastikan harga buka posisinya kelihatan, atau isi manual.',
    }
  }

  return {
    fields: {
      pair: rawPair || 'XAUUSD',
      direction: direction as 'BUY' | 'SELL',
      entry,
      sl,
      tp,
      lot,
      note: 'Dibaca AI dari screenshot trade',
    },
    extra: { exit, profit },
  }
}

/* ============================================================
   BRANCH 1 — FOTO (multipart/form-data, field 'image')
   ============================================================ */

async function handleImage(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData().catch(() => null)
  const image = formData?.get('image')

  if (!image || typeof image === 'string') {
    return NextResponse.json({ ok: false, error: 'Foto trade-nya belum kekirim — pilih screenshot dulu ya.' }, { status: 400 })
  }
  const file = image as File

  const fn = file.name.toLowerCase()
  const ft = (file.type || '').toLowerCase()
  if (fn.endsWith('.heic') || fn.endsWith('.heif') || ft.includes('heic') || ft.includes('heif')) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Format HEIC/HEIF belum didukung — screenshot ulang atau simpan sebagai JPG/PNG dulu ya.',
        code: 'HEIC_NOT_SUPPORTED',
      },
      { status: 400 }
    )
  }
  if (!ft.startsWith('image/')) {
    return NextResponse.json({ ok: false, error: 'File harus gambar (JPG, PNG, WebP).' }, { status: 400 })
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ ok: false, error: 'Ukuran foto maksimal 10 MB.' }, { status: 400 })
  }

  const buffer = new Uint8Array(await file.arrayBuffer())
  const base64 = Buffer.from(buffer).toString('base64')

  /* Rantai vision: AIML (Gemini → OpenRouter, dipakai dashboard) →
     GLM-4.6v (SDK platform — self-configure, jalan di semua lingkungan). */
  let text: string | null = null
  let provider = ''
  try {
    const r = await analyzeImageWithAiml(buffer, VISION_PROMPT, { timeout: 75_000 })
    if (r?.text) {
      text = r.text
      provider = r.provider || 'aiml'
    }
  } catch {
    /* lanjut ke provider berikutnya */
  }
  if (!text) {
    try {
      const r = await analyzeImageWithZAIVision(base64, VISION_PROMPT, {})
      if (r?.text) {
        text = r.text
        provider = 'glm-vision'
      }
    } catch {
      /* keduanya mati → 503 jujur */
    }
  }
  if (!text) {
    return NextResponse.json(
      { ok: false, error: 'Layanan AI sedang tidak tersedia — coba lagi sebentar, atau isi form manual dulu ya.' },
      { status: 503 }
    )
  }

  const parsed = extractJson<Record<string, unknown>>(text)
  const out = sanitizeImage(parsed)
  if (out.error || !out.fields) {
    return NextResponse.json({ ok: false, error: out.error || 'Gagal membaca screenshot — coba gambar lebih jelas.' }, { status: 422 })
  }

  const missing: string[] = []
  if (!out.fields.sl) missing.push('SL')
  if (!out.fields.tp) missing.push('TP')
  if (!out.fields.lot) missing.push('lot')

  return NextResponse.json({
    ok: true,
    source: 'image',
    fields: out.fields,
    extra: out.extra || { exit: '', profit: '' },
    missing,
    provider,
    note: buildNote(missing, 'screenshot'),
  })
}

/* ============================================================
   BRANCH 2 — TEKS (JSON {text}) — jalur lama yang sudah terbukti
   ============================================================ */

async function handleText(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as { text?: string } | null
  const text = String(body?.text || '').trim()
  if (text.length < 2) {
    return NextResponse.json({ ok: false, error: 'Tempel teks trade-nya dulu (mis. dari MT4/MT5 atau tulis sendiri).' }, { status: 400 })
  }
  const raw = text.slice(0, MAX_TEXT)

  const res = await callLLM(
    TEXT_PROMPT,
    `TEKS TRADE TAMU:\n"""\n${raw}\n"""`,
    300,
    { timeoutMs: 20_000 }
  )
  if (!res || !res.text) {
    return NextResponse.json(
      { ok: false, error: 'Layanan AI sedang tidak tersedia — coba lagi sebentar, atau isi form manual dulu ya.' },
      { status: 503 }
    )
  }

  const parsed = extractJson<Record<string, unknown>>(res.text)
  const out = sanitizeText(parsed)
  if (out.error || !out.fields) {
    return NextResponse.json({ ok: false, error: out.error || 'Gagal mengurai teks — coba tulis ulang lebih jelas.' }, { status: 422 })
  }

  const missing: string[] = []
  if (!out.fields.sl) missing.push('SL')
  if (!out.fields.tp) missing.push('TP')
  if (!out.fields.lot) missing.push('lot')

  return NextResponse.json({
    ok: true,
    source: 'text',
    fields: out.fields,
    extra: { exit: '', profit: '' },
    missing,
    provider: res.provider,
    note: buildNote(missing, 'teks'),
  })
}

export async function POST(request: NextRequest) {
  /* Rate limit dulu — sebelum sentuh AI (murah). */
  const limited = checkRateLimit(request, `auto-journal:${getClientIp(request)}`, {
    ...RATE,
    message: 'Terlalu sering — tunggu beberapa menit lagi ya.',
  })
  if (limited) return limited

  const contentType = (request.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('multipart/form-data')) {
    return handleImage(request)
  }
  return handleText(request)
}
