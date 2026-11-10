/**
 * ============================================================
 * pine-style.ts — EDIT VISUAL skrip Pine® ala tab "Styles"
 * Settings TradingView (permintaan Bos 2026-11: "pineku kurang
 * lengkap, yang tampil di TradingView gabisa edit visual")
 * ============================================================
 * Masalah: skrip Pine milik user + preset Luxtradee jalan via
 * `chart.runIndicator(source)` (vela-pinets). Dialog Settings chart
 * hanya menampilkan `input.*` Pine — TIDAK ada tab Styles untuk
 * plot, jadi warna/tebal garis/sembunyikan tidak bisa diubah.
 *
 * Solusi (100% lewat API resmi Vela — tanpa hack DOM):
 *   1. Parse setiap statement `plot(...)` / `plotshape(...)` /
 *      `plotchar(...)` / `hline(...)` di source (tahan multi-baris,
 *      string, komentar, dan `plot(a), plot(b)` satu baris).
 *   2. Dialog Styles menampilkan tiap baris plot dgn picker warna +
 *      tebal + jenis garis + saklar tampil/sembunyi.
 *   3. Simpan → source ASLI ditulis ulang (kwarg color/linewidth/
 *      style diganti; sembunyi = statement dikomentari) lalu
 *      `handle.updateCode(newSource)` — id/legend/pane tetap,
 *      engine menghitung ulang di tempat; gagal compile → kode
 *      lama balik otomatis (jaminan API updateCode).
 *   4. Override per skrip disimpan di localStorage (key:
 *      `preset:<i>` / `pine:<id>`) + dipakai ulang otomatis setiap
 *      skrip dijalankan/restore — persis perilaku Styles TV.
 */

/* ---------------- Warna bawaan Pine → hex ---------------- */
const PINE_COLORS: Record<string, string> = {
  aqua: '#00bcd4',
  black: '#363a45',
  blue: '#2962ff',
  fuchsia: '#e040fb',
  gray: '#787b86',
  green: '#089981',
  lime: '#00e676',
  maroon: '#880e4f',
  navy: '#311b92',
  olive: '#808e95',
  orange: '#ff9800',
  purple: '#9c27b0',
  red: '#f23645',
  silver: '#b2b5be',
  teal: '#26a69a',
  white: '#ffffff',
  yellow: '#ffeb3b',
}

/* ---------------- Jenis garis (dropdown) ---------------- */
export const PLOT_STYLE_OPTS: Array<{ v: string; label: string }> = [
  { v: 'plot.style_line', label: 'Garis' },
  { v: 'plot.style_linebr', label: 'Garis (putus null)' },
  { v: 'plot.style_histogram', label: 'Histogram' },
  { v: 'plot.style_columns', label: 'Kolom' },
  { v: 'plot.style_area', label: 'Area' },
  { v: 'plot.style_stepline', label: 'Tangga' },
  { v: 'plot.style_circles', label: 'Titik bulat' },
  { v: 'plot.style_cross', label: 'Silaang' },
]
export const HLINE_STYLE_OPTS: Array<{ v: string; label: string }> = [
  { v: 'hline.style_solid', label: 'Solid' },
  { v: 'hline.style_dashed', label: 'Putus-putus' },
  { v: 'hline.style_dotted', label: 'Titik-titik' },
]

export type VisualKind = 'plot' | 'plotshape' | 'plotchar' | 'hline'

/** Satu statement visual yang terbaca dari source asli. */
export interface VisualCall {
  kind: VisualKind
  /** Urutan kemunculan di source (basis kunci override `c<index>`). */
  index: number
  /** Urutan di antara call DENGAN KIND SAMA — identitas anti-geser. */
  ordinal: number
  /** Label utk dialog: kwarg `title="..."` atau potongan ekspresi. */
  title: string
  /** Warna efektif (hex lowercase) atau null bila tak bisa diurai. */
  color: string | null
  /** Tebal garis (plot/hline saja; plotshape/plotchar = null). */
  width: number | null
  /** Token style mentah (`plot.style_line` / `hline.style_dashed`). */
  style: string | null
  /** false bila `display=display.none`. */
  visible: boolean
}

export interface PlotStyleOverride {
  title?: string
  color?: string
  width?: number
  style?: string
  visible?: boolean
}

export interface PineStyleEntry {
  plots: Record<string, PlotStyleOverride>
  savedAt?: number
}

/* Baris dialog — nilai efektif (bawaan + override) siap edit. */
export interface StyleRow {
  index: number
  kind: VisualKind
  title: string
  color: string | null
  /** true = user benar-benar memilih warna (bukan seed default picker). */
  colorTouched?: boolean
  /** null = kontrol tebal tidak ditampilkan (plotshape/plotchar). */
  width: number | null
  style: string | null
  styleOpts: Array<{ v: string; label: string }> | null
  visible: boolean
}

/* ============================================================
   LOCATOR — temukan SEMUA statement visual di source.
   ============================================================ */
interface RawCall {
  kind: VisualKind
  ordinal: number
  inner: string
  li: number
  col: number
  endLine: number
  endIdx: number
}

function stripInlineComment(line: string): string {
  /* buang `// ...` yang TIDAK berada di dalam string */
  let inStr: string | null = null
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inStr) {
      if (ch === '\\') { i++; continue }
      if (ch === inStr) inStr = null
      continue
    }
    if (ch === '"' || ch === "'") { inStr = ch; continue }
    if (ch === '/' && line[i + 1] === '/') return line.slice(0, i)
  }
  return line
}

function findCallEnd(lines: string[], startLine: number, openIdx: number): { endLine: number; endIdx: number } | null {
  let depth = 0
  for (let li = startLine; li < lines.length; li++) {
    const line = stripInlineComment(lines[li])
    const from = li === startLine ? openIdx : 0
    let i = from
    let inStr: string | null = null
    while (i < line.length) {
      const ch = line[i]
      if (inStr) {
        if (ch === '\\') { i += 2; continue }
        if (ch === inStr) inStr = null
        i++; continue
      }
      if (ch === '"' || ch === "'") { inStr = ch; i++; continue }
      if (ch === '/' && line[i + 1] === '/') break
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) return { endLine: li, endIdx: i }
      }
      i++
    }
  }
  return null
}

/** Pecah isi tanda kurung per argumen top-level (hormati kurung & string). */
function splitArgs(inner: string): string[] {
  const out: string[] = []
  let depth = 0
  let inStr: string | null = null
  let cur = ''
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (inStr) {
      cur += ch
      if (ch === '\\') { const nx = inner[i + 1]; if (nx !== undefined) { cur += nx; i++ } continue }
      if (ch === inStr) inStr = null
      continue
    }
    if (ch === '"' || ch === "'") { inStr = ch; cur += ch; continue }
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  if (cur.trim().length > 0) out.push(cur)
  return out.map((s) => s.trim()).filter((s) => s.length > 0)
}

function unquote(v: string): string | null {
  const t = v.trim()
  if ((t.startsWith('"') && t.endsWith('"') && t.length >= 2) || (t.startsWith("'") && t.endsWith("'") && t.length >= 2)) {
    return t.slice(1, -1)
  }
  return null
}

/** Token warna Pine → hex (#rrggbb) atau null. */
export function resolvePineColor(token: string): string | null {
  const t = token.trim()
  if (!t) return null
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(t)
  if (hex) {
    let h = t.slice(1)
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    if (h.length === 8) h = h.slice(0, 6)
    return `#${h.toLowerCase()}`
  }
  const named = /^color\.([a-z]+)$/i.exec(t)
  if (named) {
    const c = PINE_COLORS[named[1].toLowerCase()]
    if (c) return c
  }
  const wrapped = /^color\.new\(\s*([^,]+?)\s*(?:,\s*[-\d.]+\s*)?\)$/i.exec(t)
  if (wrapped) return resolvePineColor(wrapped[1])
  return null
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function locateCalls(lines: string[]): RawCall[] {
  const out: RawCall[] = []
  const ordinals: Record<string, number> = {}
  let li = 0
  let searchCol = 0
  while (li < lines.length) {
    const stripped = stripInlineComment(lines[li])
    const re = /(^|[^.\w])(plotshape|plotchar|plot|hline)\s*\(/g
    re.lastIndex = searchCol
    const m = re.exec(stripped)
    if (!m) { li++; searchCol = 0; continue }
    const kind = m[2] as VisualKind
    const col = m.index + m[0].length - 1 /* posisi "(" */
    const end = findCallEnd(lines, li, col)
    if (!end) { searchCol = col + 1; continue }
    const innerLines: string[] = []
    if (li === end.endLine) {
      innerLines.push(lines[li].slice(col + 1, end.endIdx))
    } else {
      for (let k = li; k <= end.endLine; k++) {
        if (k === li) innerLines.push(lines[k].slice(col + 1))
        else if (k === end.endLine) innerLines.push(lines[k].slice(0, end.endIdx))
        else innerLines.push(lines[k])
      }
    }
    ordinals[kind] = (ordinals[kind] || 0) + 1
    out.push({ kind, ordinal: ordinals[kind], inner: innerLines.join('\n'), li, col, endLine: end.endLine, endIdx: end.endIdx })
    /* lanjut memindai sisa baris penutup (mis. `, hline(30)`) */
    li = end.endLine
    searchCol = end.endIdx + 1
  }
  return out
}

/* ---------------- Parse semua statement visual ---------------- */
export function parseVisualCalls(source: string): VisualCall[] {
  if (!source || !/\b(plot|plotshape|plotchar|hline)\s*\(/.test(source)) return []
  const raws = locateCalls(source.split('\n'))
  const calls: VisualCall[] = []
  const seenTitles = new Map<string, number>()
  for (const raw of raws) {
    const args = splitArgs(raw.inner)
    let title: string | null = null
    let color: string | null = null
    let width: number | null = raw.kind === 'plot' || raw.kind === 'hline' ? 1 : null
    let style: string | null = null
    let visible = true
    let firstPos: string | null = null

    for (const a of args) {
      const kw = /^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(a)
      if (kw) {
        const key = kw[1].toLowerCase()
        const val = kw[2].trim()
        if (key === 'title') title = unquote(val)
        else if (key === 'color') color = resolvePineColor(val)
        else if (key === 'linewidth') {
          const n = parseInt(val, 10)
          width = Number.isFinite(n) ? Math.min(9, Math.max(1, n)) : width
        } else if (key === 'style' && raw.kind === 'plot') style = collapseWs(val)
        else if (key === 'linestyle' && raw.kind === 'hline') style = collapseWs(val)
        else if (key === 'display') visible = !/display\.none/.test(val)
      } else if (firstPos === null) {
        firstPos = a
      }
    }

    if (!title) {
      if (raw.kind === 'hline' && firstPos) title = `Level ${collapseWs(firstPos)}`
      else if (firstPos) {
        const prev = collapseWs(firstPos)
        title = prev.length > 42 ? `${prev.slice(0, 42)}…` : (prev || `Plot ${raw.ordinal}`)
      } else title = raw.kind === 'hline' ? `Level ${raw.ordinal}` : `Plot ${raw.ordinal}`
    }
    const n = (seenTitles.get(title) || 0) + 1
    seenTitles.set(title, n)
    if (n > 1) title = `${title} (${n})`

    calls.push({ kind: raw.kind, index: calls.length, ordinal: raw.ordinal, title, color, width, style, visible })
  }
  return calls
}

/* ---------------- Tulis ulang source dgn override ---------------- */
function rebuildCallText(kind: VisualKind, inner: string, ov: PlotStyleOverride): string {
  /* sembunyikan = seluruh statement dikomentari (paling aman — tidak
     bergantung pada dukungan `display=` di engine). */
  if (ov.visible === false) return `// ${kind}(${collapseWs(inner)})`

  const args = splitArgs(inner)
  const has: Record<string, boolean> = {}
  const out: string[] = []
  for (const a of args) {
    const kw = /^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(a)
    if (!kw) { out.push(a); continue }
    const key = kw[1].toLowerCase()
    has[key] = true
    if (key === 'color' && ov.color) { out.push(`color=${ov.color}`); continue }
    if (key === 'linewidth' && ov.width != null) { out.push(`linewidth=${ov.width}`); continue }
    if (key === 'style' && kind === 'plot' && ov.style) { out.push(`style=${ov.style}`); continue }
    if (key === 'linestyle' && kind === 'hline' && ov.style) { out.push(`linestyle=${ov.style}`); continue }
    if (key === 'display' && ov.visible === true && /display\.none/.test(kw[2])) { out.push('display=display.all'); continue }
    out.push(a)
  }
  /* kwarg yang belum ada → ditambahkan di akhir */
  if (ov.color && !has.color) out.push(`color=${ov.color}`)
  if (ov.width != null && !has.linewidth && (kind === 'plot' || kind === 'hline')) out.push(`linewidth=${ov.width}`)
  if (ov.style && !has.style && kind === 'plot') out.push(`style=${ov.style}`)
  if (ov.style && !has.linestyle && kind === 'hline') out.push(`linestyle=${ov.style}`)
  return `${kind}(${out.join(', ')})`
}

export function applyStyleOverrides(
  source: string,
  calls: VisualCall[],
  overrides: Record<string, PlotStyleOverride>,
): string {
  if (!source || !calls.length || !overrides) return source
  const byTitle = new Map<string, PlotStyleOverride>()
  const byIdx = new Map<string, PlotStyleOverride>()
  for (const [k, ov] of Object.entries(overrides)) {
    if (!ov || typeof ov !== 'object') continue
    if (ov.title) byTitle.set(ov.title, ov)
    byIdx.set(k, ov)
  }
  /* rencana perubahan — hanya call yang benar-benar beda */
  const plan = calls
    .map((c) => ({ c, ov: (c.title && byTitle.get(c.title)) || byIdx.get(`c${c.index}`) || null }))
    .filter(({ c, ov }): ov is PlotStyleOverride => {
      if (!ov) return false
      const colorDirty = ov.color != null && ov.color !== c.color
      const widthDirty = ov.width != null && c.width != null && ov.width !== c.width
      const styleDirty = ov.style != null && c.style != null && ov.style !== c.style
      const visibleDirty = ov.visible != null && ov.visible !== c.visible
      return colorDirty || widthDirty || styleDirty || visibleDirty
    })
  if (!plan.length) return source

  const lines = source.split('\n')
  const raws = locateCalls(lines)
  /* proses dari call TERAKHIR → awal supaya offset baris tetap valid */
  for (const { c, ov } of plan.slice().sort((a, b) => b.c.index - a.c.index)) {
    const raw = raws.find((r) => r.kind === c.kind && r.ordinal === c.ordinal)
    if (!raw) continue /* source berubah struktur → skip override ini */
    const indent = (lines[raw.li].match(/^\s*/) || [''])[0]
    const head = lines[raw.li].slice(0, raw.col - c.kind.length)
    const tail = lines[raw.endLine].slice(raw.endIdx + 1)
    const newText = rebuildCallText(c.kind, raw.inner, ov)
    lines.splice(raw.li, raw.endLine - raw.li + 1, head + indent + newText + tail)
  }
  return lines.join('\n')
}

/* ---------------- localStorage per skrip ---------------- */
const PINE_STYLE_LS = 'ltx-pine-styles-v1'

export function loadAllPineStyles(): Record<string, PineStyleEntry> {
  try {
    if (typeof window === 'undefined') return {}
    const raw = window.localStorage.getItem(PINE_STYLE_LS)
    if (!raw) return {}
    const j = JSON.parse(raw)
    if (!j || typeof j !== 'object') return {}
    return j as Record<string, PineStyleEntry>
  } catch { return {} }
}

export function loadPineStyles(key: string): PineStyleEntry | null {
  const all = loadAllPineStyles()
  const e = all[key]
  if (!e || !e.plots || typeof e.plots !== 'object') return null
  return e
}

export function savePineStyles(key: string, plots: Record<string, PlotStyleOverride>): void {
  try {
    if (typeof window === 'undefined') return
    const all = loadAllPineStyles()
    if (Object.keys(plots).length === 0) delete all[key]
    else all[key] = { plots, savedAt: Date.now() }
    window.localStorage.setItem(PINE_STYLE_LS, JSON.stringify(all))
  } catch { /* storage penuh / private mode — diam */ }
}

/* ---------------- Baris dialog ---------------- */
export function buildStyleRows(calls: VisualCall[], overrides: Record<string, PlotStyleOverride>): StyleRow[] {
  const byTitle = new Map<string, PlotStyleOverride>()
  const byIdx = new Map<string, PlotStyleOverride>()
  for (const [k, ov] of Object.entries(overrides || {})) {
    if (!ov) continue
    if (ov.title) byTitle.set(ov.title, ov)
    byIdx.set(k, ov)
  }
  return calls.map((c) => {
    const ov = (c.title && byTitle.get(c.title)) || byIdx.get(`c${c.index}`) || null
    return {
      index: c.index,
      kind: c.kind,
      title: c.title,
      color: ov?.color || c.color,
      width: c.width != null ? (ov?.width ?? c.width) : null,
      style: c.style != null ? (ov?.style ?? c.style) : null,
      styleOpts: c.kind === 'plot' ? PLOT_STYLE_OPTS : c.kind === 'hline' ? HLINE_STYLE_OPTS : null,
      visible: ov?.visible ?? c.visible,
    }
  })
}

/** Bandingkan baris dialog vs nilai bawaan → peta override siap simpan. */
export function rowsToOverrides(calls: VisualCall[], rows: StyleRow[]): Record<string, PlotStyleOverride> {
  const out: Record<string, PlotStyleOverride> = {}
  for (const r of rows) {
    const c = calls.find((x) => x.index === r.index)
    if (!c) continue
    const ov: PlotStyleOverride = { title: c.title }
    let dirty = false
    if (r.color && r.colorTouched && r.color.toLowerCase() !== (c.color || '').toLowerCase()) { ov.color = r.color.toLowerCase(); dirty = true }
    if (r.width != null && c.width != null && r.width !== c.width) { ov.width = r.width; dirty = true }
    if (r.style != null && c.style != null && r.style !== c.style) { ov.style = r.style; dirty = true }
    if (r.visible !== c.visible) { ov.visible = r.visible; dirty = true }
    if (dirty) out[`c${c.index}`] = ov
  }
  return out
}

/* ---------------- Terapkan ke chart via handle resmi ----------------
   updateCode() mengganti source IN PLACE — id/legend/pane tetap,
   engine menghitung ulang; gagal compile → kode lama otomatis balik. */
export async function applyPineStylesToChart(
  chart: any,
  key: string,
  baseSource: string,
  lastMap?: Record<string, string>,
  attempts = 3,
): Promise<boolean> {
  if (!chart || typeof chart.indicators !== 'function') return false
  const calls = parseVisualCalls(baseSource)
  if (!calls.length) return false
  const entry = loadPineStyles(key)
  const overrides = entry?.plots || {}
  const hasOverrides = Object.keys(overrides).length > 0
  if (!hasOverrides && !lastMap?.[key]) return false /* tak pernah di-styling */
  const next = hasOverrides ? applyStyleOverrides(baseSource, calls, overrides) : baseSource

  /* handle pencocokan: source asli ATAU source terakhir yang kita tulis */
  const last = lastMap?.[key]
  let handle: any = null
  for (let i = 0; i < attempts && !handle; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 600))
    const handles = ((chart.indicators() || []) as any[]).filter((x) => x?.source)
    handle =
      handles.find((x) => x.source === baseSource) ||
      (last ? handles.find((x) => x.source === last) : null) ||
      null
  }
  if (!handle || typeof handle.updateCode !== 'function') return false
  if (handle.source === next) { if (lastMap) lastMap[key] = next; return true }
  try {
    const r = await handle.updateCode(next)
    if (lastMap) lastMap[key] = r?.ok ? next : String(handle.source || baseSource)
    return r?.ok === true
  } catch {
    if (lastMap) lastMap[key] = String(handle.source || baseSource)
    return false
  }
}
