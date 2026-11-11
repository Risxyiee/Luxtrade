/**
 * ceo-loop.ts — LOOP BELAJAR tim AI Kantor CEO.
 *
 * Model AI tidak "belajar" (bobotnya tetap). Yang dibangun di sini adalah loop:
 *   amati hasil → rapat & putuskan → jalankan → ukur → catat pelajaran → dipakai rapat berikutnya
 *
 * Empat bagian:
 *  1. Decision log + rapat mingguan (Senin): evaluasi taruhan minggu lalu secara KODE,
 *     debat 5 peran, Alexander memutuskan maks 2 taruhan baru, pelajaran disimpan.
 *  2. Atribusi sumber pendaftar: agregat harian dari /api/src-track (kunjungan & pendaftar per sumber).
 *  3. Otonomi bertingkat: jenis aksi menentukan 'auto' (Bos bisa veto) vs 'acc' (butuh ACC Bos).
 *     Klasifikasi dilakukan KODE, bukan LLM. Kill switch: kv autonomy:off.
 *  4. Agen Produk (Raka): backlog perbaikan website dari data → draf issue GitHub →
 *     dibuat HANYA setelah ACC Bos. Token GitHub cukup izin "Issues: write" — agen tidak bisa
 *     push kode, membuat PR, atau men-deploy.
 *
 * Semua ketergantungan disuntikkan lewat LoopDeps (pola sama dengan ceo-phase.ts).
 * Penyimpanan: agent_kv (dec:log, dec:lessons, meet:last, prod:backlog, src:day:<tanggal>).
 */
import type { PhaseDeps, PhaseInfo } from './ceo-phase'
import { weekKey } from './ceo-phase'

export interface LoopDeps extends PhaseDeps {
  /** GET REST Supabase (service role), mis. "bug_reports?select=description&limit=5". null kalau gagal */
  sbGet: (path: string) => Promise<unknown>
  /** jumlah user unik yang upload trade dalam N jam terakhir */
  activeUsers: (hours: number) => Promise<number>
}

/* ============================================================
   Tipe & konstanta
   ============================================================ */
export const ROLE_NAMES: Record<string, string> = {
  ceo: 'Alexander', cmo: 'Sinta', cso: 'Maya', gh: 'Farhan', coo: 'Bagas', cto: 'Raka', kevin: 'Kevin',
}
const PROPOSER_ROLES = ['cmo', 'cso', 'gh', 'coo', 'cto'] as const

/** Jenis aksi → tingkat otonomi. Jenis tak dikenal otomatis 'acc'. */
export const AUTO_TYPES = ['content', 'seo-article', 'reply-comment', 'draft'] as const
export const ACC_TYPES = ['email-blast', 'outbound-dm', 'pricing', 'landing-change', 'code-change', 'spend', 'other'] as const
const ALL_TYPES: string[] = [...AUTO_TYPES, ...ACC_TYPES]

export type Autonomy = 'auto' | 'acc'
export const autonomyOf = (type: string): Autonomy => ((AUTO_TYPES as readonly string[]).includes(type) ? 'auto' : 'acc')

export interface Decision {
  id: string
  week: string
  createdAt: string
  createdDay: string
  owner: string
  title: string
  why: string
  action: string
  type: string
  autonomy: Autonomy
  /** signups:all | signups:<src> | visits:<src> | manual */
  metric: string
  baseline: number
  target: number
  evalOn: string
  status: 'proposed' | 'open' | 'evaluated' | 'dropped'
  manualValue?: number
  result?: { measured: number | null; verdict: 'lanjut' | 'stop' | 'ubah'; lesson: string; at: string }
}
export interface Lesson { at: string; id: string; verdict: string; text: string }
export interface DayAgg { v: Record<string, number>; s: Record<string, number> }
export interface IssueDraft {
  id: string; at: string; title: string; problem: string; evidence: string; change: string
  acceptance: string[]; effort: string; status: 'draft' | 'created' | 'dropped'; issueUrl?: string
}

const MAX_NEW_BETS = 2
const MAX_OPEN = 4
const DAYS_LOADED = 12

/* ============================================================
   Util
   ============================================================ */
function extractJson(text: string): unknown {
  const clean = text.replace(/```(?:json)?/gi, '').trim()
  const a = clean.indexOf('{'), b = clean.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try { return JSON.parse(clean.slice(a, b + 1)) } catch { return null }
}
async function readJson<T>(d: LoopDeps, key: string, def: T): Promise<T> {
  try { const raw = await d.kvGet(key); return raw ? (JSON.parse(raw) as T) : def } catch { return def }
}
const num = (x: unknown, def: number) => { const n = Number(x); return Number.isFinite(n) ? n : def }
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10)

export const loadDecisions = (d: LoopDeps) => readJson<Decision[]>(d, 'dec:log', [])
export const loadLessons = (d: LoopDeps) => readJson<Lesson[]>(d, 'dec:lessons', [])
const saveDecisions = (d: LoopDeps, list: Decision[]) => d.kvSet('dec:log', JSON.stringify(list.slice(0, 60)))
export const autonomyIsOff = async (d: LoopDeps) => (await d.kvGet('autonomy:off').catch(() => null)) === '1'
export async function setAutonomyOff(d: LoopDeps, off: boolean): Promise<void> {
  await d.kvSet('autonomy:off', off ? '1' : '0')
}

/* ============================================================
   2. ATRIBUSI SUMBER — agregat harian dari /api/src-track
   ============================================================ */
export async function loadDayAggs(d: LoopDeps, n = DAYS_LOADED): Promise<Map<string, DayAgg>> {
  const days = Array.from({ length: n }, (_, i) => d.wibDay(-i))
  const rows = await Promise.all(days.map((day) => readJson<DayAgg | null>(d, `src:day:${day}`, null)))
  const out = new Map<string, DayAgg>()
  days.forEach((day, i) => { const r = rows[i]; if (r) out.set(day, { v: r.v || {}, s: r.s || {} }) })
  return out
}

export function summarizeSources(aggs: Map<string, DayAgg>, days = 7, today = ''): { src: string; visits: number; signups: number }[] {
  const acc: Record<string, { visits: number; signups: number }> = {}
  const cutoff = today ? addDays(today, -(days - 1)) : ''
  for (const [day, a] of aggs) {
    if (cutoff && day < cutoff) continue
    for (const [k, n] of Object.entries(a.v)) (acc[k] ||= { visits: 0, signups: 0 }).visits += n
    for (const [k, n] of Object.entries(a.s)) (acc[k] ||= { visits: 0, signups: 0 }).signups += n
  }
  return Object.entries(acc).map(([src, v]) => ({ src, ...v })).sort((a, b) => b.signups - a.signups || b.visits - a.visits)
}

function measure(dec: Decision, aggs: Map<string, DayAgg>, usersNow: number): number | null {
  if (dec.metric === 'manual') return typeof dec.manualValue === 'number' ? dec.manualValue : null
  const [kind, src] = dec.metric.split(':')
  if (kind === 'signups' && src === 'all') return usersNow >= 0 ? Math.max(0, usersNow - dec.baseline) : null
  let sum = 0
  for (const [day, a] of aggs) {
    if (day < dec.createdDay) continue
    const bag = kind === 'visits' ? a.v : a.s
    sum += src === 'all' ? Object.values(bag).reduce((x, y) => x + y, 0) : (bag[src] || 0)
  }
  return sum
}
const verdictFor = (measured: number | null, target: number): 'lanjut' | 'stop' | 'ubah' =>
  measured === null ? 'ubah' : measured >= target ? 'lanjut' : measured < target * 0.5 ? 'stop' : 'ubah'

/* ============================================================
   Konteks untuk prompt agen lain — keputusan berlaku + pelajaran.
   Tambahkan hasilnya ke prompt tiap karyawan supaya KEPUTUSAN benar-benar mengarahkan kerja.
   ============================================================ */
export async function loopContextBlock(d: LoopDeps, role: string): Promise<string> {
  const [decs, lessons] = await Promise.all([loadDecisions(d), loadLessons(d)])
  const mine = decs.filter((x) => x.status === 'open' && (x.owner === role || role === 'ceo'))
  const parts: string[] = []
  if (mine.length)
    parts.push('\nKEPUTUSAN MINGGUAN YANG BERLAKU (hasil rapat — kerjamu WAJIB selaras):\n' +
      mine.map((x) => `- ${x.title} → ${x.action} (metrik ${x.metric}, target ${x.target}, evaluasi ${x.evalOn})`).join('\n'))
  if (lessons.length)
    parts.push('\nPELAJARAN TIM (jangan ulangi kesalahan yang sama):\n' +
      lessons.slice(0, 6).map((l) => `- [${l.verdict}] ${l.text}`).join('\n'))
  return parts.join('\n')
}

/* ============================================================
   1+3. RAPAT MINGGUAN
   ============================================================ */
export interface MeetingResult { ok: boolean; note: string; evaluated: number; created: number; failed?: string }

export async function runWeeklyMeeting(d: LoopDeps, info: PhaseInfo, opts: { force?: boolean } = {}): Promise<MeetingResult> {
  const wk = weekKey(d)
  const today = d.wibDay()
  if (!opts.force && (await d.kvGet(`meet:done:${wk}`).catch(() => null)))
    return { ok: true, note: 'Rapat minggu ini sudah dilaksanakan', evaluated: 0, created: 0 }

  const off = await autonomyIsOff(d)
  const decisions = await loadDecisions(d)
  const aggs = await loadDayAggs(d)
  const usersNow = info.users

  /* --- A. Evaluasi taruhan jatuh tempo (KODE, bukan LLM) --- */
  const evaluated: Decision[] = []
  for (const dec of decisions) {
    if (dec.status !== 'open' || dec.evalOn > today) continue
    const measured = measure(dec, aggs, usersNow)
    if (measured === null && dec.metric === 'manual' && dec.evalOn > addDays(today, -7)) continue // beri waktu Bos melapor
    dec.result = { measured, verdict: verdictFor(measured, dec.target), lesson: '', at: new Date().toISOString() }
    dec.status = 'evaluated'
    evaluated.push(dec)
  }

  const lessonsOld = await loadLessons(d)
  const stillOpen = decisions.filter((x) => x.status === 'open')
  const sources = summarizeSources(aggs, 7, today)
  const idxRaw = await readJson<{ title: string }[]>(d, 'art:index', [])
  const facts =
    `FAKTA NYATA MINGGU INI (${today}):\n` +
    `- Fase bisnis: ${info.phase}; pendaftar ${info.users >= 0 ? info.users : 'tidak diketahui'}; trade 7 hari ${info.trades7d >= 0 ? info.trades7d : 'tidak diketahui'}\n` +
    `- Sumber trafik 7 hari: ${sources.length ? sources.slice(0, 8).map((s) => `${s.src}: ${s.visits} kunjungan/${s.signups} daftar`).join('; ') : 'belum ada data atribusi'}\n` +
    `- Taruhan masih berjalan: ${stillOpen.length ? stillOpen.map((x) => `${x.title} [${x.metric}]`).join('; ') : 'tidak ada'}\n` +
    `- Hasil evaluasi minggu ini: ${evaluated.length ? evaluated.map((x) => `id ${x.id} "${x.title}" terukur ${x.result?.measured ?? 'tidak terukur'} dari target ${x.target} → ${x.result?.verdict}`).join('; ') : 'tidak ada yang jatuh tempo'}\n` +
    `- Artefak terbaru: ${idxRaw.slice(0, 6).map((a) => a.title).join(' | ') || '-'}\n` +
    (lessonsOld.length ? `- Pelajaran terkumpul: ${lessonsOld.slice(0, 6).map((l) => l.text).join(' | ')}\n` : '')

  const PRODUCT = 'Luxtradee (luxtradee.web.id): web app jurnal trading XAUUSD Indonesia (upload screenshot → evaluasi AI). Tujuan tunggal: menambah jumlah pengguna.'
  const mem = await d.memBlock().catch(() => '')

  /* --- B. Debat 5 peran (1 panggilan) --- */
  let dialog: { who: string; text: string }[] = []
  let proposals: { role: string; title: string; why: string; action: string; type: string; metric: string; target: number }[] = []
  let lessonsNew: { id: string; lesson: string }[] = []
  try {
    const r1 = await d.brain('cmo',
      `Kamu penulis notulen rapat mingguan tim AI. ${PRODUCT}\n` +
      'Peserta: Sinta (cmo, konten), Maya (cso, onboarding), Farhan (gh, akuisisi), Bagas (coo, outbound/kemitraan), Raka (cto, produk/website). ' +
      'ATURAN: tiap peserta mengusulkan 1 taruhan mingguan untuk menambah pengguna; mereka WAJIB berbeda pendapat sedikitnya sekali dan mengacu pada fakta/pelajaran; ' +
      'DILARANG mengulang taruhan yang sudah gagal; DILARANG mengarang angka di luar FAKTA. Kalau sampel angka sangat kecil, tulis pelajaran sebagai HIPOTESIS, bukan kesimpulan. ' +
      `type salah satu dari: ${ALL_TYPES.join(', ')}. metric salah satu dari: signups:all, signups:<sumber>, visits:<sumber>, manual (sumber contoh: tiktok, ig, yt, tg, fb, google). target = angka kecil yang realistis. ` +
      'Taruhan harus bisa selesai dikerjakan dalam 1 minggu. ' +
      'OUTPUT HANYA JSON: {"dialog":[{"who":"Sinta","text":"..."}],"lessons":[{"id":"<id keputusan yang dievaluasi>","lesson":"1 kalimat"}],"proposals":[{"role":"cmo","title":"","why":"","action":"","type":"","metric":"","target":0}]}. Dialog 6–8 giliran, tiap teks maks 200 karakter, bahasa Indonesia santai.',
      facts + mem, 2600, 0.8)
    const j = extractJson(r1.text) as { dialog?: unknown; lessons?: unknown; proposals?: unknown } | null
    if (j && Array.isArray(j.dialog))
      dialog = (j.dialog as { who?: string; text?: string }[]).map((t) => ({ who: String(t?.who || '').slice(0, 20), text: String(t?.text || '').slice(0, 260) })).filter((t) => t.who && t.text).slice(0, 10)
    if (j && Array.isArray(j.lessons))
      lessonsNew = (j.lessons as { id?: string; lesson?: string }[]).map((l) => ({ id: String(l?.id || ''), lesson: String(l?.lesson || '').slice(0, 220) })).filter((l) => l.id && l.lesson)
    if (j && Array.isArray(j.proposals))
      proposals = (j.proposals as Record<string, unknown>[])
        .map((p) => ({
          role: String(p?.role || '').toLowerCase(),
          title: String(p?.title || '').slice(0, 120),
          why: String(p?.why || '').slice(0, 260),
          action: String(p?.action || '').slice(0, 260),
          type: String(p?.type || 'other').toLowerCase(),
          metric: String(p?.metric || 'manual').toLowerCase(),
          target: Math.max(1, Math.round(num(p?.target, 1))),
        }))
        .filter((p) => (PROPOSER_ROLES as readonly string[]).includes(p.role) && p.title && p.action)
        .slice(0, 5)
  } catch (x) {
    await finalizeEvaluations(d, decisions, evaluated, [])
    return { ok: false, note: 'Debat gagal — evaluasi tetap disimpan', evaluated: evaluated.length, created: 0, failed: String((x as Error)?.message || x).slice(0, 140) }
  }

  /* --- C. Pelajaran dari evaluasi (fallback templat kalau LLM tidak mengisi) --- */
  for (const ev of evaluated) {
    const found = lessonsNew.find((l) => l.id === ev.id)
    ev.result!.lesson = found?.lesson ||
      `"${ev.title}": terukur ${ev.result!.measured ?? 'tidak terukur'} dari target ${ev.target} → ${ev.result!.verdict}.`
  }
  await finalizeEvaluations(d, decisions, evaluated, lessonsOld)

  /* --- D. Alexander memutuskan (1 panggilan) --- */
  const room = Math.max(0, Math.min(MAX_NEW_BETS, MAX_OPEN - stillOpen.length))
  const created: Decision[] = []
  let summary = ''
  if (proposals.length && room > 0) {
    try {
      const listing = proposals.map((p, i) => `#${i} [${ROLE_NAMES[p.role]}] ${p.title} — ${p.action} (metric ${p.metric}, target ${p.target}, type ${p.type})`).join('\n')
      const r2 = await d.brain('ceo',
        `Kamu Alexander, CEO AI Luxtradee. ${PRODUCT} Pilih MAKSIMAL ${room} usulan yang paling berdampak ke jumlah pengguna dengan effort kecil; tolak sisanya dengan alasan 1 kalimat. ` +
        'Jangan pilih dua taruhan dengan metric/sumber yang sama, jangan pilih yang mirip taruhan yang sudah gagal. Boleh menyesuaikan target (angka kecil realistis) dan evalDays (5–10). ' +
        'OUTPUT HANYA JSON: {"picked":[{"index":0,"target":3,"evalDays":7,"reason":"..."}],"rejected":[{"index":1,"reason":"..."}],"summary":"2 kalimat"}',
        facts + `\nUSULAN:\n${listing}`, 900, 0.4)
      const j2 = extractJson(r2.text) as { picked?: { index?: number; target?: number; evalDays?: number }[]; summary?: string } | null
      summary = String(j2?.summary || '').slice(0, 300)
      const used = new Set<number>()
      for (const pk of Array.isArray(j2?.picked) ? j2!.picked! : []) {
        const i = Math.round(num(pk?.index, -1))
        if (i < 0 || i >= proposals.length || used.has(i) || created.length >= room) continue
        used.add(i)
        const p = proposals[i]
        const type = ALL_TYPES.includes(p.type) ? p.type : 'other'
        const metric = /^(signups|visits):(all|[a-z0-9_-]{1,32})$/.test(p.metric) ? p.metric : 'manual'
        const evalDays = Math.max(5, Math.min(10, Math.round(num(pk?.evalDays, 7))))
        created.push({
          id: `d-${wk}-${created.length + 1}`, week: wk, createdAt: new Date().toISOString(), createdDay: today,
          owner: p.role, title: p.title, why: p.why, action: p.action, type,
          autonomy: off ? 'acc' : autonomyOf(type),
          metric, baseline: metric === 'signups:all' ? Math.max(0, info.users) : 0,
          target: Math.max(1, Math.round(num(pk?.target, p.target))), evalOn: addDays(today, evalDays),
          status: (off ? 'acc' : autonomyOf(type)) === 'auto' ? 'open' : 'proposed',
        })
      }
    } catch { /* tanpa keputusan baru; lihat catatan di bawah */ }
  }
  if (created.length) await saveDecisions(d, [...created, ...(await loadDecisions(d))])

  await d.kvSet('meet:last', JSON.stringify({ at: new Date().toISOString(), week: wk, dialog, summary, created: created.map((c) => c.id), evaluated: evaluated.map((e) => e.id) })).catch(() => false)
  if (proposals.length) await d.kvSet(`meet:done:${wk}`, '1').catch(() => false)
  for (const c of created) await d.mem('CEO Alexander', `Keputusan minggu ${wk}: ${c.title} → metrik ${c.metric} target ${c.target}, evaluasi ${c.evalOn} (${c.autonomy === 'auto' ? 'otomatis' : 'menunggu ACC Bos'})`).catch(() => {})

  const lines = [
    '🗓️ **RAPAT MINGGUAN TIM AI**',
    ...(evaluated.length ? ['Evaluasi: ' + evaluated.map((e) => `${e.title} → ${e.result!.verdict} (${e.result!.measured ?? '?'}/${e.target})`).join('; ')] : []),
    ...(summary ? [summary] : []),
    ...created.map((c) => `• ${ROLE_NAMES[c.owner]}: ${c.title} [${c.metric} ≥ ${c.target} sebelum ${c.evalOn}] — ${c.autonomy === 'auto' ? 'berjalan otomatis (Bos bisa veto di Kantor CEO)' : 'MENUNGGU ACC BOS di Kantor CEO'}`),
    ...(!created.length ? [room === 0 ? 'Slot taruhan penuh — tidak ada taruhan baru.' : 'Tidak ada taruhan baru yang dipilih.'] : []),
    ...(off ? ['_(kill switch otonomi AKTIF — semua keputusan butuh ACC)_'] : []),
  ]
  await d.notify(lines.join('\n').slice(0, 1900)).catch(() => {})
  return { ok: true, note: summary || 'Rapat selesai', evaluated: evaluated.length, created: created.length }
}

async function finalizeEvaluations(d: LoopDeps, all: Decision[], evaluated: Decision[], lessonsOld: Lesson[]): Promise<void> {
  if (!evaluated.length) return
  for (const ev of evaluated) if (!ev.result!.lesson) ev.result!.lesson = `"${ev.title}": ${ev.result!.verdict} (${ev.result!.measured ?? 'tidak terukur'}/${ev.target}).`
  await saveDecisions(d, all)
  const fresh: Lesson[] = evaluated.map((e) => ({ at: new Date().toISOString(), id: e.id, verdict: e.result!.verdict, text: e.result!.lesson }))
  if (lessonsOld.length || fresh.length) await d.kvSet('dec:lessons', JSON.stringify([...fresh, ...lessonsOld].slice(0, 20))).catch(() => false)
  for (const e of evaluated) await d.mem(`${(ROLE_NAMES[e.owner] || e.owner)}`, `Evaluasi taruhan: ${e.result!.lesson}`).catch(() => {})
}

/* ---------- Aksi Bos atas keputusan ---------- */
export async function ackDecision(d: LoopDeps, id: string, to: 'open' | 'dropped'): Promise<{ ok: boolean; error?: string }> {
  const list = await loadDecisions(d)
  const dec = list.find((x) => x.id === id)
  if (!dec) return { ok: false, error: 'keputusan tidak ditemukan' }
  if (to === 'open' && dec.status !== 'proposed') return { ok: false, error: 'hanya keputusan berstatus menunggu ACC yang bisa di-ACC' }
  if (to === 'dropped' && dec.status !== 'proposed' && dec.status !== 'open') return { ok: false, error: 'keputusan sudah selesai' }
  const was = dec.status
  dec.status = to
  await saveDecisions(d, list)
  await d.mem('CEO Alexander', to === 'open' ? `Bos ACC keputusan: ${dec.title}` : `Bos ${was === 'open' ? 'VETO' : 'menolak'} keputusan: ${dec.title}`).catch(() => {})
  return { ok: true }
}

export async function reportManual(d: LoopDeps, id: string, value: number): Promise<{ ok: boolean; error?: string }> {
  const list = await loadDecisions(d)
  const dec = list.find((x) => x.id === id)
  if (!dec || dec.metric !== 'manual') return { ok: false, error: 'bukan keputusan bermetrik manual' }
  dec.manualValue = value
  await saveDecisions(d, list)
  return { ok: true }
}

/* ---------- Snapshot untuk dashboard ---------- */
export async function getLoopSnapshot(d: LoopDeps, info: PhaseInfo) {
  const [decs, lessons, aggs, backlog, last, off] = await Promise.all([
    loadDecisions(d), loadLessons(d), loadDayAggs(d),
    readJson<IssueDraft[]>(d, 'prod:backlog', []),
    readJson<unknown>(d, 'meet:last', null),
    autonomyIsOff(d),
  ])
  const decisions = decs.map((x) => ({ ...x, progress: x.status === 'open' ? measure(x, aggs, info.users) : null }))
  return {
    decisions, lessons: lessons.slice(0, 10),
    sources: summarizeSources(aggs, 7, d.wibDay()),
    backlog: backlog.slice(0, 20), meeting: last, autonomyOff: off,
    githubReady: !!(d.env('GITHUB_TOKEN') && d.env('GITHUB_REPO')),
  }
}

/* ============================================================
   4. AGEN PRODUK — backlog perbaikan website → draf issue GitHub
   ============================================================ */
export async function runProductReview(d: LoopDeps, info: PhaseInfo, opts: { force?: boolean } = {}): Promise<{ ok: boolean; added: number; note: string }> {
  const wk = weekKey(d)
  if (!opts.force && (await d.kvGet(`prod:done:${wk}`).catch(() => null))) return { ok: true, added: 0, note: 'Review produk minggu ini sudah ada' }

  const [total, onboarded, pro, activated30, bugs, qa, e2e, idx, backlog] = await Promise.all([
    d.count('profiles').catch(() => -1),
    d.count('profiles', 'onboarding_completed=eq.true').catch(() => -1),
    d.count('profiles', 'is_pro=eq.true').catch(() => -1),
    d.activeUsers(24 * 30).catch(() => -1),
    d.sbGet('bug_reports?select=description&order=created_at.desc&limit=5').catch(() => null),
    readJson<{ total?: number; fails?: { path: string; status: number }[] } | null>(d, 'qa:last', null),
    readJson<{ e2eSteps?: { label: string; ok: boolean; detail?: string }[] } | null>(d, 'e2e:last', null),
    readJson<{ id: string; role: string; kind: string }[]>(d, 'art:index', []),
    readJson<IssueDraft[]>(d, 'prod:backlog', []),
  ])
  const pickBody = async (kind: string) => {
    const a = idx.find((x) => x.kind === kind)
    return a ? ((await d.kvGet(`art:body:${a.id}`).catch(() => null)) || '').slice(0, 1400) : ''
  }
  const [seo, onboard] = await Promise.all([pickBody('seo-audit'), pickBody('onboarding')])

  const funnelMeaningful = total >= 10
  const funnel = `Funnel: pendaftar ${total} → selesai onboarding ${onboarded} → pernah upload (30 hari) ${activated30} → PRO ${pro}` +
    (funnelMeaningful ? '' : ' (sampel terlalu kecil — JANGAN menyimpulkan titik bocor dari rasio ini)')
  const bugList = Array.isArray(bugs) ? (bugs as { description?: string }[]).map((b) => String(b.description || '').replace(/\s+/g, ' ').slice(0, 160)).filter(Boolean) : []
  const e2eFails = (e2e?.e2eSteps || []).filter((s) => !s.ok).map((s) => `${s.label}: ${s.detail || 'gagal'}`).slice(0, 5)
  const facts =
    `DATA NYATA:\n- ${funnel}\n` +
    `- QA terakhir: ${qa ? `${qa.total ?? '?'} rute, gagal: ${(qa.fails || []).map((f) => `${f.path}→${f.status}`).join(', ') || 'tidak ada'}` : 'belum ada'}\n` +
    `- E2E login terakhir langkah gagal: ${e2eFails.join('; ') || 'tidak ada / belum ada'}\n` +
    `- Laporan bug terbaru: ${bugList.join(' | ') || 'tidak ada'}\n` +
    (seo ? `- AUDIT SEO TERAKHIR:\n${seo}\n` : '') +
    (onboard ? `- RANCANGAN ONBOARDING (hambatan hasil prediksi Maya, bukan data user):\n${onboard}\n` : '') +
    `- Usulan yang SUDAH ada (jangan duplikat): ${backlog.slice(0, 12).map((b) => b.title).join(' | ') || '-'}\n`

  const r = await d.brain('cto',
    'Kamu Raka, CTO dan PRODUCT OWNER AI Luxtradee (web app jurnal trading XAUUSD). Dari DATA NYATA, usulkan MAKSIMAL 3 perbaikan website yang paling berpotensi menaikkan jumlah pengguna. ' +
    'ATURAN: tiap usulan WAJIB punya "evidence" yang mengutip data di atas (QA/E2E/bug/audit SEO/funnel/onboarding) — tanpa bukti, jangan diusulkan. DILARANG mengarang angka/fitur yang tidak ada di data. ' +
    'Satu usulan = satu perubahan kecil yang bisa dikerjakan developer dalam ≤1 hari. ' +
    'OUTPUT HANYA JSON: {"issues":[{"title":"","problem":"","evidence":"","change":"","acceptance":["kriteria 1","kriteria 2"],"effort":"rendah|sedang|tinggi"}]}',
    facts, 1800, 0.4)
  const j = extractJson(r.text) as { issues?: Record<string, unknown>[] } | null
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const existing = new Set(backlog.map((b) => norm(b.title)))
  const fresh: IssueDraft[] = []
  for (const it of Array.isArray(j?.issues) ? j!.issues! : []) {
    const title = String(it?.title || '').slice(0, 120)
    const evidence = String(it?.evidence || '').slice(0, 400)
    if (!title || evidence.length < 15 || existing.has(norm(title)) || fresh.length >= 3) continue
    existing.add(norm(title))
    fresh.push({
      id: `iss-${d.wibDay()}-${fresh.length + 1}`, at: new Date().toISOString(), title,
      problem: String(it?.problem || '').slice(0, 400), evidence, change: String(it?.change || '').slice(0, 500),
      acceptance: (Array.isArray(it?.acceptance) ? (it.acceptance as unknown[]) : []).map((a) => String(a).slice(0, 160)).slice(0, 5),
      effort: String(it?.effort || 'sedang').slice(0, 12), status: 'draft',
    })
  }
  if (!fresh.length) return { ok: false, added: 0, note: 'Model tidak menghasilkan usulan yang berbukti' }
  await d.kvSet('prod:backlog', JSON.stringify([...fresh, ...backlog].slice(0, 40)))
  await d.kvSet(`prod:done:${wk}`, '1').catch(() => false)
  await d.mem('CTO Raka', `Backlog produk: ${fresh.map((f) => f.title).join('; ')}`).catch(() => {})
  await d.notify(`🧰 **BACKLOG PRODUK (Raka)** — ${fresh.length} usulan perbaikan website berbukti data, menunggu keputusan Bos di Ruang CTO:\n${fresh.map((f) => `• ${f.title} (effort ${f.effort})`).join('\n')}`).catch(() => {})
  return { ok: true, added: fresh.length, note: 'ok' }
}

/** Buat issue GitHub dari draf — dipanggil HANYA setelah Bos menekan tombol (ACC). */
export async function createIssueFromDraft(d: LoopDeps, id: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const token = d.env('GITHUB_TOKEN')
  const repo = d.env('GITHUB_REPO')
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return { ok: false, error: 'GITHUB_TOKEN / GITHUB_REPO (format owner/nama) belum diset' }
  const list = await readJson<IssueDraft[]>(d, 'prod:backlog', [])
  const draft = list.find((x) => x.id === id)
  if (!draft) return { ok: false, error: 'draf tidak ditemukan' }
  if (draft.status === 'created') return { ok: true, url: draft.issueUrl }
  const body =
    `## Masalah\n${draft.problem}\n\n## Bukti dari data\n${draft.evidence}\n\n## Usulan perubahan\n${draft.change}\n\n` +
    `## Kriteria selesai\n${draft.acceptance.map((a) => `- [ ] ${a}`).join('\n') || '- [ ] (belum dirinci)'}\n\n` +
    `**Effort:** ${draft.effort}\n\n---\n_Diusulkan otomatis oleh Raka (CTO AI) dan disetujui Bos. Review manual sebelum merge/deploy._`
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'luxtrade-ceo-agent', 'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: draft.title, body, labels: ['ai-proposed'] }),
      signal: AbortSignal.timeout(15_000),
    })
    const js = (await res.json().catch(() => null)) as { html_url?: string; message?: string } | null
    if (!res.ok) return { ok: false, error: `GitHub HTTP ${res.status}: ${String(js?.message || '').slice(0, 120)}` }
    draft.status = 'created'
    draft.issueUrl = String(js?.html_url || '')
    await d.kvSet('prod:backlog', JSON.stringify(list))
    await d.mem('CTO Raka', `Issue GitHub dibuat (ACC Bos): ${draft.title}`).catch(() => {})
    return { ok: true, url: draft.issueUrl }
  } catch (x) {
    return { ok: false, error: String((x as Error)?.message || x).slice(0, 140) }
  }
}

export async function dropIssueDraft(d: LoopDeps, id: string): Promise<{ ok: boolean }> {
  const list = await readJson<IssueDraft[]>(d, 'prod:backlog', [])
  const draft = list.find((x) => x.id === id)
  if (!draft || draft.status === 'created') return { ok: false }
  draft.status = 'dropped'
  await d.kvSet('prod:backlog', JSON.stringify(list))
  return { ok: true }
}
