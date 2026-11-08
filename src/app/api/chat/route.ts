import { NextRequest, NextResponse } from 'next/server'
import { geminiChat, isGeminiAvailableAsync } from '@/lib/gemini'
import { checkRateLimit } from '@/lib/rate-limit'
import { getCronAdmin } from '@/lib/cron-supabase'
import { extractEmail, clipLeadMessage } from '@/lib/growth-sentinel'

// Force dynamic rendering — prevent CF Workers from caching/stale response
export const dynamic = 'force-dynamic'

// System prompt for LuxTradee CS bot
const SYSTEM_PROMPT = `Kamu adalah asisten customer service LuxTradee — jurnal trading AI untuk trader Indonesia.

TUGASMU:
- Jawab pertanyaan tentang LuxTradee dengan ramah dan profesional
- Bisa bahasa Indonesia dan English
- Jangan pernah kasih harga pasti kalau ga yakin, arahkan ke halaman pricing (#pricing)
- Kalau ditanya hal di luar LuxTradee/trading, bilang kamu cuma CS LuxTradee

ESCALATION KE ADMIN:
- Kalau user minta bicara admin, minta bantuan manusia/live agent, atau pertanyaan yang kamu ga bisa jawab (misal: masalah teknis serius, billing dispute, bug report, permintaan khusus) → WAJIB arahkan ke Telegram @Risxyiee
- Contoh: "Kalau butuh bantuan langsung dari admin, silakan chat Telegram @Risxyiee ya — mereka bisa bantu lebih lanjut! 📱"
- JANGAN pernah bilang kamu bisa handle masalah teknis/billing sendiri — selalu escalate ke Telegram untuk hal serius

INFO PRODUK:
- LuxTradee = jurnal trading AI untuk prop firm traders
- Paket Gratis: 10 trade/bulan, 10 AI queries/bulan, analitik dasar
- Paket PRO: Rp49K/bulan, unlimited trades, AI pattern detection, auto extract screenshot MT5/TV, equity curve, export CSV/PDF, psychology tracking
- AI Vision: upload screenshot MT5/TradingView → auto extract data trade
- AI Pattern Detection: deteksi pola loss berulang (FOMO, overtrading, dll)
- Payment: Midtrans (QRIS, Virtual Account, e-wallet — via Midtrans Snap)
- Support: Telegram @Risxyiee, email luxtradee@gmail.com, Discord
- Bisa import dari MT4/MT5/cTrader via CSV atau screenshot
- Data aman, terenkripsi, nggak dijual ke pihak ketiga
- No auto-renew, bisa cancel kapan pun
- Non-refundable (produk digital)

GAYA JAWAB:
- Singkat, to the point, tapi ramah
- Pakai emoji secukupnya
- Kalau ga yakin, arahkan ke Telegram @Risxyiee atau Discord`

/**
 * PROAKTIF (Growth Engine — karyawan Kevin/ Sentinel): CS bot bukan cuma
 * nunggu ditanya — dia dikasih amunisi harian (hook + angka RIIL) oleh
 * cron /api/cron/growth-sentinel via agent_kv, plus misi menangkap lead
 * (visitor yang tertarik → minta email → tabel growth_leads → draf email
 * welcome masuk antrean ACC Bos). Semua angka yang boleh dikutip bot
 * HANYA dari blok DATA RIIL di bawah (anti-halusinasi).
 */
async function buildGrowthContext(): Promise<{ block: string; hookGreeting: string }> {
  const admin = await getCronAdmin()
  if (!admin) return { block: '', hookGreeting: '' }
  let hookGreeting = ''
  try {
    const { data } = await admin
      .from('agent_kv')
      .select('key, value')
      .in('key', ['growth:cs-hook', 'growth:social-proof'])
    const rows = (data || []) as Array<{ key: string; value: string }>
    const hookRow = rows.find(r => r.key === 'growth:cs-hook')
    const proofRow = rows.find(r => r.key === 'growth:social-proof')
    const lines: string[] = []
    if (hookRow) {
      try {
        const hook = JSON.parse(hookRow.value) as { greeting?: string; note?: string }
        if (hook.greeting) {
          hookGreeting = String(hook.greeting).slice(0, 200)
          lines.push(`Hook sapaan hari ini (jadikan nada pembuka kamu saat relevan): "${hookGreeting}"`)
        }
      } catch { /* KV korup → skip */ }
    }
    if (proofRow) {
      try {
        const proof = JSON.parse(proofRow.value) as { members?: number; signals7d?: number | null }
        if (typeof proof.members === 'number' && proof.members >= 0) {
          lines.push(`- Total member Luxtradee: ${proof.members}`)
        }
        if (typeof proof.signals7d === 'number' && proof.signals7d >= 0) {
          lines.push(`- Sinyal VIP 7 hari terakhir: ${proof.signals7d}`)
        }
      } catch { /* skip */ }
    }
    if (!lines.length) return { block: '', hookGreeting: '' }
    return {
      block: `\n\nDATA RIIL LUXTRADEE HARI INI (boleh dikutip PERSIS — DILARANG mengarang angka lain):\n${lines.map(l => `- ${l}`).join('\n')}` +
        `\n\nMISI MENANGKAP LEAD (hormati ritme percakapan — jangan maksa):\n` +
        `- Kalau visitor terlihat tertarik (tanya fitur/harga/sinyal, chat sudah 2+ bolak-balik), tawarkan: "Mau aku kirim sinyal & tips harian gratis? Tinggal kasih email kamu aja 📬"\n` +
        `- Kalau visitor memberi email → ucapkan terima kasih singkat + bilang tim kami akan kirim sinyal & undangan daftar gratis (https://luxtradee.web.id/auth/signup). JANGAN minta data lain (no telp/alamat).\n` +
        `- Kalau visitor menolak → jangan tanya lagi, lanjut bantu pertanyaannya.`,
      hookGreeting,
    }
  } catch { /* agent_kv belum ada → tanpa konteks */ }
  return { block: '', hookGreeting: '' }
}

// In-memory conversation store
const conversations = new Map<string, Array<{role: 'user' | 'model'; content: string}>>()
const MAX_MESSAGES = 20

// Anti-spam lead: 1 sesi cukup menitipkan 1 email (set in-memory, Workers
// isolate boleh hilang — dedupe final oleh UNIQUE(email) di growth_leads)
const leadCapturedSessions = new Set<string>()

/**
 * Simpan lead ke growth_leads (tabel migrasi 043). Dedupe: email UNIQUE —
 * kalau sudah pernah, update pesan pertama HANYA jika lead masih 'new'.
 * Return 'inserted' | 'known' | 'error'.
 */
async function captureLead(
  email: string, sessionId: string, message: string, language: string, uaHint: string,
): Promise<'inserted' | 'known' | 'error'> {
  const admin = await getCronAdmin()
  if (!admin) return 'error'
  try {
    const { data: existing } = await admin
      .from('growth_leads').select('id, status').eq('email', email).limit(1)
    const row = (existing as Array<{ id: string; status: string }> | null)?.[0]
    if (row) {
      if (row.status === 'new') {
        await admin.from('growth_leads')
          .update({ first_message: clipLeadMessage(message) || undefined })
          .eq('id', row.id)
      }
      return 'known'
    }
    const { error } = await admin.from('growth_leads').insert({
      email,
      source: 'cs-bot',
      language,
      first_message: clipLeadMessage(message),
      session_id: sessionId.slice(0, 80),
      ua_hint: uaHint.slice(0, 60),
      status: 'new',
    })
    if (error) {
      console.warn('[chat API] captureLead insert gagal:', error.message?.slice(0, 120))
      return 'error'
    }
    return 'inserted'
  } catch (err) {
    // Tabel belum ada (SQL 043 belum jalan) → senyap, bot tetap jawab
    console.warn('[chat API] captureLead error (tabel 043 belum ada?):', err instanceof Error ? err.message.slice(0, 120) : err)
    return 'error'
  }
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY (audit #7): dulu route ini TANPA auth dan tanpa rate limit IP —
    // limit lama hanya per `sessionId` yang dikirim client sendiri, jadi bisa
    // dilewati dengan sessionId acak → panggilan Gemini tak terbatas atas
    // nama API key kita. Sekarang: limit per-IP dulu, lalu limit per-session.
    const limited = checkRateLimit(req, 'chat', {
      maxRequests: 10,
      windowMs: 60_000,
      message: 'Terlalu banyak pesan. Tunggu sebentar ya.',
    })
    if (limited) return limited

    // CRITICAL: Use req.text() + JSON.parse() instead of req.json()
    // to avoid "Stream already consumed" error in Cloudflare Workers V8 Isolate
    // on the second+ request in the same session.
    const rawBody = await req.text()
    let sessionId: string
    let message: string
    let language: string

    try {
      const parsed = JSON.parse(rawBody)
      sessionId = parsed.sessionId
      message = parsed.message
      language = parsed.language || 'id'
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Check Gemini availability
    if (!await isGeminiAvailableAsync()) {
      console.error('[chat API] GEMINI_API_KEY not configured')
      return NextResponse.json({
        response: language === 'en'
          ? "Sorry, AI service is not configured. Please contact Telegram @Risxyiee."
          : "Maaf, layanan AI belum dikonfigurasi. Hubungi Telegram @Risxyiee."
      }, { status: 503 })
    }

    // Rate limit: max 20 messages per session (40 entries)
    const history = conversations.get(sessionId) || []
    if (history.length > MAX_MESSAGES * 2) {
      return NextResponse.json({
        response: language === 'en'
          ? "You've reached the chat limit. Please contact us on Telegram @Risxyiee for further assistance."
          : "Kamu udah cap batas chat. Hubungi kami di Telegram @Risxyiee untuk bantuan lebih lanjut.",
        limited: true
      })
    }

    // ── GROWTH: konteks proaktif (hook + social proof RIIL dari sentinel) ──
    const growth = await buildGrowthContext()
    const systemPrompt = SYSTEM_PROMPT + growth.block

    // Build Gemini messages from history
    const geminiMessages = [
      ...history.map(msg => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content }]
      })),
      { role: 'user' as const, parts: [{ text: message }] }
    ]

    // Call Gemini
    const result = await geminiChat(geminiMessages, {
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      maxTokens: 1024,
      systemInstruction: systemPrompt,
      timeoutMs: 30000,
    })

    const aiResponse = result.text ||
      (language === 'en' ? "Sorry, I couldn't process that. Please try again." : "Maaf, gagal memproses. Coba lagi ya.")

    // ── GROWTH: tangkap lead kalau visitor menitipkan email ──
    // Deteksi server-side (regex di lib murni) — bot tidak perlu "tool";
    // email yang muncul di pesan visitor = izin eksplisit dihubungi.
    let leadCaptured: boolean = false
    const emailInMsg = extractEmail(message)
    if (emailInMsg && !leadCapturedSessions.has(sessionId)) {
      const outcome = await captureLead(
        emailInMsg, sessionId, message, language,
        req.headers.get('user-agent') || '',
      )
      if (outcome === 'inserted' || outcome === 'known') {
        leadCapturedSessions.add(sessionId)
        leadCaptured = true
        console.log(`[chat API] lead ${outcome === 'inserted' ? 'BARU' : 'dikenal'} tersimpan: ${emailInMsg.replace(/(.{2}).+(@.*)/, '$1***$2')}`)
      }
    }

    // Save to history
    const updatedHistory = [
      ...history,
      { role: 'user' as const, content: message },
      { role: 'model' as const, content: aiResponse }
    ]
    // Trim old messages if too long
    if (updatedHistory.length > MAX_MESSAGES * 2) {
      conversations.set(sessionId, updatedHistory.slice(-MAX_MESSAGES))
    } else {
      conversations.set(sessionId, updatedHistory)
    }

    return NextResponse.json({ response: aiResponse, leadCaptured })
  } catch (error: any) {
    // Descriptive error logging for Cloudflare Workers diagnostics
    console.error('[chat API] Error:', {
      name: error?.name || 'Unknown',
      message: error?.message || 'No message',
      code: error?.code || 'N/A',
      stack: error?.stack?.substring(0, 300) || 'No stack',
    })

    const isTimeout = error instanceof Error && (
      error.message.includes('timed out') ||
      error.message.includes('Abort') ||
      error.name === 'TimeoutError'
    )
    const isKeyError = error instanceof Error && (
      error.message.includes('API_KEY') ||
      error.message.includes('not configured')
    )
    const errMsg = isTimeout
      ? 'Maaf, respon terlalu lama. Coba lagi atau hubungi Telegram @Risxyiee.'
      : isKeyError
        ? 'Maaf, layanan AI belum dikonfigurasi. Hubungi Telegram @Risxyiee.'
        : 'Maaf, sedang gangguan. Coba lagi atau hubungi Telegram @Risxyiee.'

    return NextResponse.json({ response: errMsg }, { status: isTimeout ? 504 : isKeyError ? 503 : 500 })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: await isGeminiAvailableAsync() ? 'ok' : 'not_configured',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  })
}
