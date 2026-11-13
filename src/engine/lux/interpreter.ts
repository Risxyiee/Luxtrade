/**
 * ============================================================
 * LUX ENGINE — interpreter.ts
 * ============================================================
 * Eksekusi AST bar-per-bar (bar-by-bar) ala Pine:
 *   - Semua variabel user = series buffer (NaN = na, string juga bisa).
 *   - `var x = e`  → inisialisasi SEKALI (bar pertama), persist.
 *   - `x = e`      → deklarasi dieksekusi ulang tiap bar.
 *   - `x := e`     → reassignment nilai bar ini.
 *   - `x[n]`       → lihat riwayat (n bar ke belakang).
 *   - ta.* stateful per call-site (seq token) — konsisten tiap bar.
 *   - Tuple Pine: [m, s, h] = ta.macd(…), ta.bb, ta.dmi, ta.supertrend.
 *   - Konstanta member Pine (strategy.long, color.red, timeframe.period,
 *     barstate.*, math.pi, dayofweek.*) → nilai/no-op visual.
 *   - Waktu dibaca dalam zona Asia/Jakarta (year/month/dayofmonth/
 *     dayofweek/hour/minute/second — built-in & fungsi).
 *
 * SANDBOX (guardrail di dalam mesin — CF Workers tidak punya
 * worker_threads/child_process, jadi isolasi = batas keras):
 *   - deadline wall-clock (default 2000 ms), dicek tiap 25 bar;
 *   - langkah (step budget) total untuk semua loop;
 *   - cap jumlah bar, event, dan plot.
 * Satu script yang berat/error TIDAK bisa menggantung host —
 * error selalu dilempar sebagai LuxError yang bisa ditangkap.
 * ============================================================
 */

import type { LuxAst, Expr, Stmt, IfBranch, SwitchBranch } from './parser'
import { parseLux } from './parser'
import type { LuxCandle, LuxEvent, LuxPlot, LuxRunOptions, LuxRunResult, LuxValue } from './types'

export class LuxError extends Error {
  code: NonNullable<LuxRunResult['errorCode']>
  constructor(message: string, code: NonNullable<LuxRunResult['errorCode']>) {
    super(message)
    this.code = code
  }
}

/** Sinyal kontrol loop (break/continue) — kelas privat modul. */
class BreakSig { }
class ContinueSig { }

/* ---------- Nilai helper ---------- */

const NA = NaN
function isNa(v: LuxValue): boolean {
  return typeof v === 'number' && Number.isNaN(v)
}
function toBool(v: LuxValue): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return !Number.isNaN(v) && v !== 0
  return v.length > 0
}
function toNum(v: LuxValue): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  const n = Number(v)
  return Number.isFinite(n) ? n : NA
}
/** Angka → string rapi ala Pine (buang .0 membuang presisi berlebih). */
function numToStr(v: number): string {
  if (Number.isNaN(v)) return 'na'
  if (!Number.isFinite(v)) return v > 0 ? 'Infinity' : '-Infinity'
  return String(v)
}
function luxToStr(v: LuxValue): string {
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return numToStr(v)
}

/* ---------- State call-site ta.* ---------- */

interface SmaState { buf: number[]; sum: number }
interface EmaState { seeded: boolean; seedBuf: number[]; value: number; alpha: number; len: number }
interface CrossState { prevA: number; prevB: number; has: boolean }

type CallState =
  | { k: 'sma'; s: SmaState }
  | { k: 'ema'; s: EmaState }
  | { k: 'rma'; s: EmaState }
  | { k: 'wma'; s: SmaState }
  | { k: 'stdev'; s: SmaState }
  | { k: 'rsi'; up: EmaState; dn: EmaState }
  | { k: 'atr'; s: EmaState }
  | { k: 'cross'; s: CrossState }
  | { k: 'cum'; s: number }
  | { k: 'chg'; s: number; has: boolean }
  | { k: 'alertbar'; bar: number }
  | { k: 'hh'; s: SmaState; mode: 'hi' | 'lo' }
  | { k: 'arr'; buf: number[] }
  | { k: 'count'; n: number; has: boolean }
  | { k: 'vwap'; pv: number; vol: number; day: number }
  | { k: 'sar'; trend: number; ep: number; af: number; cur: number; started: boolean }
  | { k: 'strend'; prevLower: number; prevUpper: number; prevSt: number; prevDir: number; has: boolean }
  | { k: 'dmi'; up: EmaState; dn: EmaState; tr: EmaState; adx: EmaState; prevH: number; prevL: number; has: boolean }

/* ---------- Series user ---------- */

interface SeriesVar {
  /** Buffer nilai per bar. Hole (undefined) = belum pernah di-assign. */
  buf: (LuxValue | undefined)[]
  isVar: boolean
  declared: boolean
}
type FrameVal = { kind: 'series'; sv: SeriesVar } | { kind: 'local'; v: LuxValue }

/* ---------- Peta posisi named-arg Pine (subset umum) ---------- */
const KWARG_POS: Record<string, Record<string, number>> = {
  input: { defval: 0 },
  'input.int': { defval: 0, minval: 2, maxval: 3 },
  'input.float': { defval: 0, minval: 2, maxval: 3 },
  'input.bool': { defval: 0 },
  'input.string': { defval: 0 },
  'input.source': { defval: 0 },
  plot: { series: 0, title: 1 },
  plotshape: { series: 0, title: 1 },
  plotchar: { series: 0, title: 1 },
  alertcondition: { condition: 0, title: 1, message: 2 },
  alert: { message: 0, freq: 1 },
  sma: { source: 0, length: 1 },
  'ta.sma': { source: 0, length: 1 },
  ema: { source: 0, length: 1 },
  'ta.ema': { source: 0, length: 1 },
  rma: { source: 0, length: 1 },
  'ta.rma': { source: 0, length: 1 },
  wma: { source: 0, length: 1 },
  'ta.wma': { source: 0, length: 1 },
  vwma: { source: 0, length: 1 },
  'ta.vwma': { source: 0, length: 1 },
  stdev: { source: 0, length: 1 },
  'ta.stdev': { source: 0, length: 1 },
  rsi: { source: 0, length: 1 },
  'ta.rsi': { source: 0, length: 1 },
  highest: { source: 0, length: 1 },
  'ta.highest': { source: 0, length: 1 },
  lowest: { source: 0, length: 1 },
  'ta.lowest': { source: 0, length: 1 },
  atr: { length: 0 },
  'ta.atr': { length: 0 },
  hline: { price: 0 },
  'strategy.entry': { id: 0, direction: 1 },
  'strategy.exit': { id: 0 },
  'ta.macd': { source: 0, fastlen: 1, slowlen: 2, signallen: 3 },
  'ta.bb': { source: 0, length: 1, mult: 2 },
  'ta.dmi': { dilen: 0, adilen: 1 },
  'ta.supertrend': { factor: 0, atrperiod: 1 },
  'ta.linreg': { source: 0, length: 1, offset: 2 },
  'ta.barssince': { condition: 0 },
  'ta.valuewhen': { condition: 0, source: 1, occurrence: 2 },
  'ta.wpr': { length: 0 },
  'ta.cci': { source: 0, length: 1 },
  'ta.mfi': { source: 0, length: 1 },
  'ta.stoch': { source: 0, high: 1, low: 2, length: 3 },
  'ta.pivothigh': { source: 0, leftbars: 1, rightbars: 2 },
  'ta.pivotlow': { source: 0, leftbars: 1, rightbars: 2 },
  math: { },
}

/* ---------- Zona waktu helper (Asia/Jakarta) ---------- */

const TZ = 'Asia/Jakarta'
const DOW_NUM: Record<string, number> = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 }

/* ---------- Interpreter ---------- */

class Interp {
  private ast: LuxAst
  private candles: LuxCandle[]
  private n: number
  private opts: Required<Pick<LuxRunOptions, 'deadlineMs' | 'maxEvents'>> & { maxBars: number }

  private deadline: number
  private events: LuxEvent[] = []
  private plots = new Map<number, { title: string; values: number[] }>()
  private callStates = new Map<number, CallState>()
  /** Hasil tuple call terakhir (ta.macd/ta.bb/ta.dmi/ta.supertrend). */
  private lastTuple: LuxValue[] | null = null

  // built-in series precomputed
  private open: number[] = []
  private high: number[] = []
  private low: number[] = []
  private close: number[] = []
  private volume: number[] = []
  private timeArr: number[] = []

  private vars = new Map<string, SeriesVar>()
  private funcs = new Map<string, { params: string[]; body: Expr }>()
  private locals: Map<string, FrameVal> | null = null

  private steps = 0
  private stepBudget: number

  private dtfCache = new Map<string, Intl.DateTimeFormat>()

  constructor(ast: LuxAst, candles: LuxCandle[], opts: LuxRunOptions) {
    this.ast = ast
    const maxBars = Math.max(10, Math.min(opts.maxBars ?? 3000, 5000))
    // Ambil maxBars TERAKHIR (paling relevan untuk sinyal)
    this.candles = candles.length > maxBars ? candles.slice(candles.length - maxBars) : candles
    this.n = this.candles.length
    this.opts = {
      deadlineMs: Math.min(Math.max(opts.deadlineMs ?? 2000, 100), 10_000),
      maxEvents: Math.min(Math.max(opts.maxEvents ?? 100, 1), 500),
      maxBars,
    }
    this.deadline = Date.now() + this.opts.deadlineMs
    // Budget langkah: script produksi realistis (panel table.cell tiap bar,
    // multi-plot, logika sinyal) ≈ 300+ eval/bar. Guard utama tetap
    // wall-clock deadline — budget ini hanya pagar kedua anti-loop.
    this.stepBudget = 400_000 + this.n * 150
  }

  /* ---------- guardrail ---------- */
  private tick(): void {
    this.steps++
    if (this.steps % 512 === 0 && Date.now() > this.deadline) {
      throw new LuxError(`Eksekusi melewati batas waktu ${this.opts.deadlineMs} ms`, 'TIMEOUT')
    }
    if (this.steps > this.stepBudget) {
      throw new LuxError('Budget langkah eksekusi habis (script terlalu berat)', 'STEP_BUDGET')
    }
  }

  /* ---------- entry ---------- */
  run(): LuxRunResult {
    const t0 = Date.now()
    try {
      // precompute built-in series
      for (const c of this.candles) {
        this.open.push(c.open)
        this.high.push(c.high)
        this.low.push(c.low)
        this.close.push(c.close)
        this.volume.push(c.volume ?? 0)
        this.timeArr.push(c.time)
      }

      for (let bar = 0; bar < this.n; bar++) {
        if ((bar & 31) === 0 && Date.now() > this.deadline) {
          throw new LuxError(`Eksekusi melewati batas waktu ${this.opts.deadlineMs} ms`, 'TIMEOUT')
        }
        this.execBar(bar)
      }

      const plotArr: LuxPlot[] = []
      for (const [, p] of this.plots) {
        if (plotArr.length >= 12) break
        // isi hole (bar tanpa plot, mis. di dalam if) dengan NaN
        const vals: number[] = []
        for (let i = 0; i < this.n; i++) vals.push(p.values[i] ?? NA)
        plotArr.push({ title: p.title, values: vals })
      }
      return { ok: true, bars: this.n, events: this.events, plots: plotArr, durationMs: Date.now() - t0 }
    } catch (e) {
      if (e instanceof LuxError) {
        return { ok: false, bars: 0, events: [], plots: [], durationMs: Date.now() - t0, error: e.message, errorCode: e.code }
      }
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, bars: 0, events: [], plots: [], durationMs: Date.now() - t0, error: msg, errorCode: 'RUNTIME_ERROR' }
    }
  }

  /* ---------- satu bar ---------- */
  private execBar(bar: number): void {
    for (const s of this.ast.body) {
      this.execStmt(s, bar)
    }
  }

  private readSeries(buf: number[] | null, bar: number, back: number): number {
    if (!buf) return NA
    const idx = bar - back
    if (idx < 0 || idx >= buf.length) return NA
    return buf[idx]
  }

  /** Perluas buffer series sampai index `bar` (pakai hole, bukan NaN). */
  private extendBuf(sv: SeriesVar, bar: number): void {
    const b = sv.buf
    while (b.length <= bar) b.push(undefined as unknown as LuxValue)
  }

  /* ---------- waktu (Asia/Jakarta) ---------- */
  private dtf(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    let f = this.dtfCache.get(key)
    if (!f) {
      f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour12: false, ...opts })
      this.dtfCache.set(key, f)
    }
    return f
  }
  /** Komponen waktu bar (epoch detik → Asia/Jakarta). */
  private jakartaParts(epochSec: number): { year: number; month: number; day: number; dow: number; hour: number; minute: number; second: number } {
    const d = new Date(epochSec * 1000)
    const get = (key: string, opts: Intl.DateTimeFormatOptions): number => {
      const p = this.dtf(key, opts).formatToParts(d).find((x) => x.type === key.slice(0, 1).toUpperCase() + key.slice(1))
      // formatToParts type names: 'year','month','day','weekday','hour','minute','second'
      return p ? Number(p.value) : 0
    }
    const year = get('year', { year: 'numeric' })
    const month = Number(this.dtf('month', { month: '2-digit' }).formatToParts(d).find((x) => x.type === 'month')?.value ?? 1)
    const day = Number(this.dtf('day', { day: '2-digit' }).formatToParts(d).find((x) => x.type === 'day')?.value ?? 1)
    const wd = this.dtf('weekday', { weekday: 'short' }).formatToParts(d).find((x) => x.type === 'weekday')?.value ?? 'Mon'
    const hour = Number(this.dtf('hour', { hour: '2-digit' }).formatToParts(d).find((x) => x.type === 'hour')?.value ?? 0) % 24
    const minute = Number(this.dtf('minute', { minute: '2-digit' }).formatToParts(d).find((x) => x.type === 'minute')?.value ?? 0)
    const second = Number(this.dtf('second', { second: '2-digit' }).formatToParts(d).find((x) => x.type === 'second')?.value ?? 0)
    return { year, month, day, dow: DOW_NUM[wd.slice(0, 3)] ?? 1, hour, minute, second }
  }
  private timeOf(args: Expr[], bar: number, back = 0): number {
    // Argumen opsional: epoch ms ala Pine → detik. Tanpa argumen = waktu bar.
    if (args.length > 0) {
      const v = toNum(this.evalExpr(args[0], bar))
      if (Number.isFinite(v) && v > 1e12) return Math.floor(v / 1000)
      if (Number.isFinite(v) && v > 1e9) return Math.floor(v) // sudah detik
      return this.timeArr[bar - back] ?? 0
    }
    return this.timeArr[bar - back] ?? 0
  }

  /* ---------- statement ---------- */
  private execStmt(st: Stmt, bar: number): void {
    this.tick()
    switch (st.t) {
      case 'expr':
        this.evalExpr(st.e, bar)
        return
      case 'declare': {
        const v = this.evalExpr(st.e, bar)
        this.assignDeclared(st.name, st.isVar, v, bar)
        return
      }
      case 'assign': {
        const v = this.evalExpr(st.e, bar)
        let sv = this.vars.get(st.name)
        if (!sv) {
          sv = { buf: [], isVar: true, declared: true }
          this.vars.set(st.name, sv)
        }
        this.extendBuf(sv, bar)
        sv.buf[bar] = v
        return
      }
      case 'tuple': {
        // [a, b, c] = ta.macd(…) — tuple dari built-in, elemen = series numerik
        this.lastTuple = null
        const first = this.evalExpr(st.e, bar)
        const vals = this.lastTuple ?? [first]
        for (let i = 0; i < st.names.length; i++) {
          this.assignDeclared(st.names[i], false, vals[i] ?? NA, bar)
        }
        return
      }
      case 'if': {
        for (const br of st.branches) {
          if (br.cond === null || toBool(this.evalExpr(br.cond, bar))) {
            for (const s2 of br.body) this.execStmt(s2, bar)
            return
          }
        }
        return
      }
      case 'ifassign': {
        const v = this.execIfValue(st.branches, bar)
        this.assignDeclared(st.name, st.isVar, v, bar)
        return
      }
      case 'switchassign': {
        const subj = st.subject === null ? NA : this.evalExpr(st.subject, bar)
        let chosen: SwitchBranch | null = null
        for (const br of st.branches) {
          if (br.when === null) {
            if (!chosen) chosen = br
            continue
          }
          const w = this.evalExpr(br.when, bar)
          if (this.binOp('==', subj, w) === true) {
            chosen = br
            break
          }
        }
        const v = chosen ? this.execBodyValue(chosen.body, bar) : NA
        this.assignDeclared(st.name, st.isVar, v, bar)
        return
      }
      case 'while': {
        let guard = 0
        for (;;) {
          this.tick()
          if (++guard > 5000) throw new LuxError('Loop while melebihi 5000 iterasi', 'STEP_BUDGET')
          if (!toBool(this.evalExpr(st.cond, bar))) break
          try {
            for (const s2 of st.body) this.execStmt(s2, bar)
          } catch (e) {
            if (e instanceof BreakSig) break
            if (e instanceof ContinueSig) continue
            throw e
          }
        }
        return
      }
      case 'break':
        throw new BreakSig()
      case 'continue':
        throw new ContinueSig()
      case 'for': {
        const from = toNum(this.evalExpr(st.from, bar))
        const to = toNum(this.evalExpr(st.to, bar))
        const step = st.step || 1
        if (!Number.isFinite(from) || !Number.isFinite(to)) return
        let guard = 0
        try {
          if (step > 0) {
            for (let i = from; i <= to + 1e-9; i += step) {
              this.tick()
              if (++guard > 5000) throw new LuxError('Loop for melebihi 5000 iterasi', 'STEP_BUDGET')
              this.setLocal(st.ivar, i)
              try {
                for (const s2 of st.body) this.execStmt(s2, bar)
              } catch (e) {
                if (e instanceof ContinueSig) continue
                throw e
              }
            }
          } else {
            for (let i = from; i >= to - 1e-9; i += step) {
              this.tick()
              if (++guard > 5000) throw new LuxError('Loop for melebihi 5000 iterasi', 'STEP_BUDGET')
              this.setLocal(st.ivar, i)
              try {
                for (const s2 of st.body) this.execStmt(s2, bar)
              } catch (e) {
                if (e instanceof ContinueSig) continue
                throw e
              }
            }
          }
        } catch (e) {
          if (e instanceof BreakSig) { this.setLocal(st.ivar, NA); return }
          throw e
        }
        this.setLocal(st.ivar, NA)
        return
      }
      case 'funcdef':
        this.funcs.set(st.name, { params: st.params, body: st.body })
        return
      case 'header':
        return
    }
  }

  /** Jalankan body if/switch → nilai ekspresi terakhir (semantik Pine). */
  private execBodyValue(body: Stmt[], bar: number): LuxValue {
    let v: LuxValue = NA
    for (const s2 of body) {
      if (s2.t === 'expr') {
        v = this.evalExpr(s2.e, bar)
      } else if (s2.t === 'declare' || s2.t === 'ifassign' || s2.t === 'switchassign') {
        this.execStmt(s2, bar)
        v = this.readIdent(s2.name, bar, 0)
      } else {
        this.execStmt(s2, bar)
      }
    }
    return v
  }
  private execIfValue(branches: IfBranch[], bar: number): LuxValue {
    for (const br of branches) {
      if (br.cond === null || toBool(this.evalExpr(br.cond, bar))) {
        return this.execBodyValue(br.body, bar)
      }
    }
    return NA
  }

  /** Deklarasi/assignment series user — nilai mentah (angka/bool/string). */
  private assignDeclared(name: string, isVar: boolean, v: LuxValue, bar: number): void {
    if (isVar) {
      let sv = this.vars.get(name)
      if (!sv) {
        sv = { buf: [], isVar: true, declared: false }
        this.vars.set(name, sv)
      }
      if (!sv.declared) {
        this.extendBuf(sv, bar)
        sv.buf[bar] = v
        sv.declared = true
      } else {
        this.extendBuf(sv, bar) // jaga panjang buffer; nilai tetap dari bar lalu
      }
      return
    }
    let sv = this.vars.get(name)
    if (!sv || sv.isVar) {
      sv = { buf: [], isVar: false, declared: true }
      this.vars.set(name, sv)
    }
    this.extendBuf(sv, bar)
    sv.buf[bar] = v
  }

  private setLocal(name: string, v: LuxValue): void {
    if (!this.locals) this.locals = new Map()
    this.locals.set(name, { kind: 'local', v })
  }

  /* ---------- ekspresi ---------- */
  private evalExpr(e: Expr, bar: number): LuxValue {
    this.tick()
    switch (e.t) {
      case 'num':
        return e.v
      case 'str':
        return e.v
      case 'bool':
        return e.v
      case 'na':
        return NA
      case 'ident':
        return this.readIdent(e.name, bar, 0, e.line)
      case 'member':
        return this.memberVal(e.obj, e.path, bar, e.line)
      case 'index': {
        if (e.base.t !== 'ident') throw new LuxError('Hanya variabel yang bisa diindeks riwayat x[n]', 'RUNTIME_ERROR')
        const nV = toNum(this.evalExpr(e.n, bar))
        const back = Math.round(nV)
        if (!Number.isFinite(back) || back < 0) return NA
        return this.readIdent(e.base.name, bar, back, e.line)
      }
      case 'un': {
        const v = this.evalExpr(e.e, bar)
        if (e.op === '-') return -toNum(v)
        return !toBool(v)
      }
      case 'bin': {
        // short-circuit logis
        if (e.op === 'and') return toBool(this.evalExpr(e.l, bar)) && toBool(this.evalExpr(e.r, bar))
        if (e.op === 'or') return toBool(this.evalExpr(e.l, bar)) || toBool(this.evalExpr(e.r, bar))
        const l = this.evalExpr(e.l, bar)
        const r = this.evalExpr(e.r, bar)
        return this.binOp(e.op, l, r)
      }
      case 'ternary': {
        const c = this.evalExpr(e.c, bar)
        return toBool(c) ? this.evalExpr(e.a, bar) : this.evalExpr(e.b, bar)
      }
      case 'namedarg':
        // Tidak boleh dievaluasi langsung — dinormalisasi di evalCall.
        return NA
      case 'array':
        // Array literal (options=[…] dsb.) — subset: nilai abstrak, tidak
        // bisa diakses elemennya (array.get dsb. tetap ditolak).
        return NA
      case 'call':
        return this.evalCall(e.name, e.args, e.seq, bar, e.line)
    }
  }

  private binOp(op: string, l: LuxValue, r: LuxValue): LuxValue {
    if (op === '==') {
      if (typeof l === 'string' || typeof r === 'string') return String(l) === String(r)
      return l === r || (isNa(l) && isNa(r))
    }
    if (op === '!=') {
      if (typeof l === 'string' || typeof r === 'string') return String(l) !== String(r)
      return !(l === r || (isNa(l) && isNa(r)))
    }
    // konkatenasi string ala Pine: "XAU " + "LONG"
    if (op === '+' && (typeof l === 'string' || typeof r === 'string')) {
      return luxToStr(l) + luxToStr(r)
    }
    const a = toNum(l)
    const b = toNum(r)
    switch (op) {
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      case '/': return b === 0 ? NA : a / b
      case '%': return b === 0 ? NA : a % b
      case '<': return a < b
      case '>': return a > b
      case '<=': return a <= b
      case '>=': return a >= b
    }
    throw new LuxError(`Operator "${op}" tidak dikenal`, 'RUNTIME_ERROR')
  }

  private readIdent(name: string, bar: number, back: number, line?: number): LuxValue {
    // lokal fungsi (scalar) — hanya di baris dalam pemanggilan fungsi
    if (this.locals) {
      const loc = this.locals.get(name)
      if (loc && loc.kind === 'local') return loc.v
    }
    // built-in series
    switch (name) {
      case 'open': return this.readSeries(this.open, bar, back)
      case 'high': return this.readSeries(this.high, bar, back)
      case 'low': return this.readSeries(this.low, bar, back)
      case 'close': return this.readSeries(this.close, bar, back)
      case 'volume': return this.readSeries(this.volume, bar, back)
      case 'time': {
        const t = this.readSeries(this.timeArr, bar, back)
        return Number.isNaN(t) ? NA : t * 1000 // Pine: epoch MILLISECOND
      }
      case 'bar_index':
        return back === 0 ? bar : NA
      case 'last_bar_index':
        return back === 0 ? this.n - 1 : NA
      case 'na':
        return NA
      // waktu — komponen Asia/Jakarta (Pine built-in bar hour dll.)
      case 'year': return this.jakartaParts(this.timeArr[bar - back] ?? 0).year
      case 'month': return this.jakartaParts(this.timeArr[bar - back] ?? 0).month
      case 'dayofmonth': return this.jakartaParts(this.timeArr[bar - back] ?? 0).day
      case 'dayofweek': return this.jakartaParts(this.timeArr[bar - back] ?? 0).dow
      case 'hour': return this.jakartaParts(this.timeArr[bar - back] ?? 0).hour
      case 'minute': return this.jakartaParts(this.timeArr[bar - back] ?? 0).minute
      case 'second': return this.jakartaParts(this.timeArr[bar - back] ?? 0).second
    }
    if (name === 'hl2' || name === 'hlc3' || name === 'ohlc4') {
      const h = this.readSeries(this.high, bar, back)
      const l = this.readSeries(this.low, bar, back)
      const c = this.readSeries(this.close, bar, back)
      if (name === 'hl2') return (h + l) / 2
      if (name === 'hlc3') return (h + l + c) / 3
      const o = this.readSeries(this.open, bar, back)
      return (o + h + l + c) / 4
    }
    // variabel user
    const sv = this.vars.get(name)
    if (sv) {
      if (this.locals) {
        const loc = this.locals.get(name)
        if (loc) {
          if (loc.kind === 'local') return loc.v
          const lv = loc.sv.buf[bar - back]
          return lv === undefined ? NA : lv
        }
      }
      const idx = bar - back
      const b = sv.buf
      if (idx < 0 || idx >= b.length) return NA
      const v = b[idx]
      if (v !== undefined) return v
      // Hole = belum di-assign di bar itu.
      // - var (persist): nilai efektif = nilai DEFINED terakhir ≤ idx
      //   (Pine: var dipertahankan antar bar).
      // - plain (dideklarasi tiap bar): belum di-assign = na.
      if (sv.isVar) {
        for (let j = idx; j >= 0; j--) {
          if (b[j] !== undefined) return b[j] as LuxValue
        }
      }
      return NA
    }
    // konstanta member bertitik yang tidak lewat parser member
    // (tokenizer menggabung `strategy.long` jadi SATU ident)
    if (name.includes('.')) {
      const parts = name.split('.')
      return this.memberVal(parts[0], parts.slice(1), bar, line)
    }
    throw new LuxError(`Variabel "${name}" tidak dikenal${line ? ` (baris ${line})` : ''}`, 'RUNTIME_ERROR')
  }

  /* ---------- konstanta member Pine ---------- */
  private memberVal(obj: string, path: string[], bar: number, line?: number): LuxValue {
    const p = path.join('.')
    switch (obj) {
      case 'strategy':
        switch (p) {
          case 'long': return 'long'
          case 'short': return 'short'
          case 'position_size':
          case 'opentrades':
          case 'closedtrades':
          case 'wintrades':
          case 'losstrades':
          case 'equity':
          case 'netprofit':
          case 'initial_capital':
            return 0
          case 'position_avg_price': return NA
          case 'closedtrades.entry_price':
          case 'closedtrades.exit_price': return NA
        }
        return NA // argumen visual (strategy.closedtrades.* dsb.) — no-op
      case 'timeframe':
        switch (p) {
          case 'period': return '60' // engine H1
          case 'multiplier': return 60
          case 'isintraday': return true
          case 'isdaily':
          case 'isweekly':
          case 'ismonthly': return false
          case 'isseconds': return false
        }
        return NA
      case 'syminfo':
        switch (p) {
          case 'ticker': return 'XAUUSD'
          case 'tickerid': return 'OANDA:XAUUSD'
          case 'currency': return 'USD'
          case 'basecurrency': return 'XAU'
          case 'type': return 'metals'
          case 'mintick': return 0.01
          case 'pricescale': return 100
          case 'minmove': return 1
          case 'session': return 'regular'
        }
        return NA
      case 'barstate':
        switch (p) {
          case 'isconfirmed': return true
          case 'ishistory': return true
          case 'isrealtime': return false
          case 'isnew': return false
          case 'isfirst': return bar === 0
          case 'islast': return bar === this.n - 1
          case 'islastconfirmedhistory': return bar === this.n - 1
        }
        return NA
      case 'math':
        switch (p) {
          case 'pi': return Math.PI
          case 'e': return Math.E
          case 'phi': return (1 + Math.sqrt(5)) / 2
          case 'rphi': return (Math.sqrt(5) - 1) / 2
          case 'inf': return Infinity
        }
        return NA
      case 'dayofweek': {
        // Pine: Sunday=1 … Saturday=7
        const m: Record<string, number> = {
          sunday: 1, sun: 1, monday: 2, mon: 2, tuesday: 3, tue: 3,
          wednesday: 4, wed: 4, thursday: 5, thu: 5, friday: 6, fri: 6,
          saturday: 7, sat: 7,
        }
        if (m[p] !== undefined) return m[p]
        return NA
      }
      // namespace visual/label — konstanta apa pun = no-op
      case 'color': case 'shape': case 'location': case 'size':
      case 'display': case 'format': case 'xloc': case 'yloc':
      case 'plot': case 'hline': case 'extend': case 'alert':
      case 'session': case 'scale': case 'order': case 'currency':
      case 'adjust': case 'barmerge': case 'text': case 'position':
      case 'line': case 'label': case 'box': case 'table':
        return NA
      case 'input': case 'na': case 'open': case 'high': case 'low':
      case 'close': case 'volume': case 'time': case 'int': case 'float':
      case 'bool': case 'string': case 'array': case 'matrix': case 'map':
        return NA
    }
    throw new LuxError(`Konstanta/member "${obj}.${p}" tidak dikenal${line ? ` (baris ${line})` : ''}`, 'RUNTIME_ERROR')
  }

  /* ---------- pemanggilan ---------- */
  private arg(args: Expr[], i: number, bar: number): LuxValue {
    return i < args.length ? this.evalExpr(args[i], bar) : NA
  }
  private argNum(args: Expr[], i: number, bar: number, def = NaN): number {
    if (i >= args.length) return def
    const v = toNum(this.evalExpr(args[i], bar))
    return Number.isFinite(v) ? v : def
  }
  private argStr(args: Expr[], i: number, bar: number, def = ''): string {
    if (i >= args.length) return def
    const v = this.evalExpr(args[i], bar)
    return typeof v === 'string' ? v : isNa(v) ? def : String(v)
  }

  private state<T extends CallState>(seq: number, make: () => T): T {
    let s = this.callStates.get(seq) as T | undefined
    if (!s) {
      s = make()
      this.callStates.set(seq, s)
    }
    return s
  }

  /** WMA manual atas buffer numerik (untuk hma/linreg/median). */
  private static wmaOf(buf: number[], start: number, len: number): number {
    if (start + len > buf.length) return NA
    let num = 0
    let den = 0
    for (let i = 0; i < len; i++) {
      const w = i + 1
      num += buf[start + i] * w
      den += w
    }
    return den === 0 ? NA : num / den
  }

  private evalCall(name: string, rawArgs: Expr[], seq: number, bar: number, line?: number): LuxValue {
    this.lastTuple = null
    // Normalisasi named args Pine (title='X') → posisi argumen.
    const kw = KWARG_POS[name]
    let args: Expr[]
    if (rawArgs.some((a) => a.t === 'namedarg')) {
      args = []
      let cursor = 0
      for (const a of rawArgs) {
        if (a.t === 'namedarg') {
          const idx = kw ? kw[a.name] : undefined
          if (idx !== undefined) {
            args[idx] = a.e
          }
          // kwarg tak dikenal → dibuang
        } else {
          while (args[cursor] !== undefined) cursor++
          args[cursor] = a
          cursor++
        }
      }
      for (let i = 0; i < args.length; i++) if (args[i] === undefined) args[i] = { t: 'na' }
    } else {
      args = rawArgs
    }

    // fungsi user — argumen DIEVALUASI DULU di frame caller (loop var `i`
    // dsb. masih terlihat), baru locals di-swap ke frame fungsi.
    const fn = this.funcs.get(name)
    if (fn) {
      const saved = this.locals
      const argVals: LuxValue[] = []
      for (let i = 0; i < fn.params.length; i++) {
        argVals.push(this.evalExpr(args[i], bar))
      }
      this.locals = new Map()
      for (let i = 0; i < fn.params.length; i++) {
        this.locals.set(fn.params[i], { kind: 'local', v: argVals[i] })
      }
      const out = this.evalExpr(fn.body, bar)
      this.locals = saved
      return out
    }

    switch (name) {
      /* ── deklarasi ── */
      case 'input':
      case 'input.int':
      case 'input.float':
      case 'input.bool':
      case 'input.string':
      case 'input.source':
      case 'input.timeframe':
      case 'input.symbol':
      case 'input.session':
      case 'input.color':
      case 'input.time':
      case 'input.textarea':
      case 'input.price':
        return this.arg(args, 0, bar) // defval
      case 'indicator':
      case 'strategy':
        return NA
      case 'color.new':
      case 'color.rgb':
      case 'color.from_gradient':
        return NA // visual no-op

      /* ── konversi ── */
      case 'int':
      case 'float':
      case 'number': {
        const v = toNum(this.arg(args, 0, bar))
        return name === 'int' ? Math.round(v) : v
      }
      case 'bool': return toBool(this.arg(args, 0, bar))
      case 'str': case 'string': return luxToStr(this.arg(args, 0, bar))
      case 'nz': {
        const v = toNum(this.arg(args, 0, bar))
        return Number.isNaN(v) ? this.argNum(args, 1, bar, 0) : v
      }
      case 'na2': return NA
      case 'na': {
        const v = this.arg(args, 0, bar)
        return isNa(v)
      }
      case 'fixnan': {
        const st = this.state(seq, () => ({ k: 'chg' as const, s: NA, has: false }))
        const v = toNum(this.arg(args, 0, bar))
        if (!Number.isNaN(v)) {
          st.s = v
          st.has = true
          return v
        }
        return st.has ? st.s : NA
      }

      /* ── ta.* ── */
      case 'sma': return this.taRolling(seq, this.argNum(args, 0, bar), Math.round(this.argNum(args, 1, bar, 1)), 'mean')
      case 'ta.sma': return this.taRolling(seq, this.argNum(args, 0, bar), Math.round(this.argNum(args, 1, bar, 1)), 'mean')
      case 'wma': return this.taRolling(seq, this.argNum(args, 0, bar), Math.round(this.argNum(args, 1, bar, 1)), 'wma')
      case 'ta.wma': return this.taRolling(seq, this.argNum(args, 0, bar), Math.round(this.argNum(args, 1, bar, 1)), 'wma')
      case 'highest': return this.taRolling(seq, this.argNum(args, 0, bar), Math.round(this.argNum(args, 1, bar, 1)), 'hi')
      case 'ta.highest': return this.taRolling(seq, this.argNum(args, 0, bar), Math.round(this.argNum(args, 1, bar, 1)), 'hi')
      case 'lowest': return this.taRolling(seq, this.argNum(args, 0, bar), Math.round(this.argNum(args, 1, bar, 1)), 'lo')
      case 'ta.lowest': return this.taRolling(seq, this.argNum(args, 0, bar), Math.round(this.argNum(args, 1, bar, 1)), 'lo')
      case 'stdev':
      case 'ta.stdev':
        return this.taRolling(seq, this.argNum(args, 0, bar), Math.round(this.argNum(args, 1, bar, 1)), 'stdev')
      case 'ema':
      case 'ta.ema':
        return this.taEma(seq, this.argNum(args, 0, bar), Math.max(1, Math.round(this.argNum(args, 1, bar, 1))), 'ema')
      case 'rma':
      case 'ta.rma':
        return this.taEma(seq, this.argNum(args, 0, bar), Math.max(1, Math.round(this.argNum(args, 1, bar, 1))), 'rma')
      case 'rsi':
      case 'ta.rsi': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 14)))
        const st = this.state(seq, () => ({
          k: 'rsi' as const,
          up: { seeded: false, seedBuf: [], value: NA, alpha: 1 / len, len },
          dn: { seeded: false, seedBuf: [], value: NA, alpha: 1 / len, len },
        }))
        void st
        // dua call-site state terpisah utk rma up/dn — kunci NEGATIF
        // (namespace turunan) supaya tidak pernah tabrakan dengan
        // call-site asli yang bernomor seq >= 0:
        const up = this.state(-(seq * 10 + 1), () => this.mkEma('rma', len))
        const dn = this.state(-(seq * 10 + 2), () => this.mkEma('rma', len))
        const chg = this.state(-(seq * 10 + 3), () => ({ k: 'chg' as const, s: NA, has: false }))
        const prev = chg.has ? chg.s : NA
        chg.s = src
        chg.has = true
        const gain = Number.isNaN(prev) ? NA : Math.max(src - prev, 0)
        const loss = Number.isNaN(prev) ? NA : Math.max(prev - src, 0)
        const au = this.pushEma(up, gain)
        const ad = this.pushEma(dn, loss)
        if (Number.isNaN(au) || Number.isNaN(ad)) return NA
        if (ad === 0) return 100
        const rs = au / ad
        return 100 - 100 / (1 + rs)
      }
      case 'atr':
      case 'ta.atr': {
        const len = Math.max(1, Math.round(this.argNum(args, 0, bar, 14)))
        const st = this.state(seq, () => ({ k: 'atr' as const, s: this.mkEma('rma', len) }))
        const tr = this.trueRange(bar)
        return this.pushEma(st.s, tr)
      }
      case 'tr':
      case 'ta.tr':
        return this.trueRange(bar)
      case 'crossover':
      case 'ta.crossover':
        return this.taCross(seq, this.argNum(args, 0, bar), this.argNum(args, 1, bar), 'up')
      case 'crossunder':
      case 'ta.crossunder':
        return this.taCross(seq, this.argNum(args, 0, bar), this.argNum(args, 1, bar), 'down')
      case 'cross':
      case 'ta.cross':
        return this.taCross(seq, this.argNum(args, 0, bar), this.argNum(args, 1, bar), 'any')
      case 'change':
      case 'ta.change': {
        const v = this.argNum(args, 0, bar)
        const st = this.state(seq, () => ({ k: 'chg' as const, s: NA, has: false }))
        const prev = st.has ? st.s : NA
        st.s = v
        st.has = true
        return Number.isNaN(prev) ? NA : v - prev
      }
      case 'cum':
      case 'ta.cum': {
        const v = this.argNum(args, 0, bar)
        const st = this.state(seq, () => ({ k: 'cum' as const, s: 0 }))
        if (!Number.isNaN(v)) st.s += v
        return st.s
      }
      case 'vwma':
      case 'ta.vwma': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 20)))
        const vol = this.volume[bar] ?? 0
        const num = this.taRolling(-(seq * 10 + 1), src * vol, len, 'mean')
        const den = this.taRolling(-(seq * 10 + 2), vol, len, 'mean')
        return den > 0 ? num / den : NA
      }
      case 'hma':
      case 'ta.hma': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(2, Math.round(this.argNum(args, 1, bar, 20)))
        const w1 = this.taRolling(-(seq * 10 + 1), src, Math.max(1, Math.round(len / 2)), 'wma')
        const w2 = this.taRolling(-(seq * 10 + 2), src, len, 'wma')
        const diff = 2 * w1 - w2
        const st = this.state(seq, () => ({ k: 'arr' as const, buf: [] }))
        if (Number.isFinite(diff)) st.buf.push(diff)
        const k = Math.max(1, Math.round(Math.sqrt(len)))
        return st.buf.length >= k ? Interp.wmaOf(st.buf, st.buf.length - k, k) : NA
      }
      case 'mom':
      case 'ta.mom': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 10)))
        const st = this.state(seq, () => ({ k: 'arr' as const, buf: [] }))
        const prev = st.buf.length >= len + 1 ? st.buf[st.buf.length - 1 - len] : NA
        if (Number.isFinite(src)) st.buf.push(src)
        return Number.isFinite(prev) ? src - prev : NA
      }
      case 'roc':
      case 'ta.roc': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 9)))
        const st = this.state(seq, () => ({ k: 'arr' as const, buf: [] }))
        const prev = st.buf.length >= len + 1 ? st.buf[st.buf.length - 1 - len] : NA
        if (Number.isFinite(src)) st.buf.push(src)
        return Number.isFinite(prev) && prev !== 0 ? (100 * (src - prev)) / prev : NA
      }
      case 'stoch':
      case 'ta.stoch': {
        const src = this.argNum(args, 0, bar)
        const hiV = args.length >= 3 ? this.argNum(args, 1, bar) : this.readSeries(this.high, bar, 0)
        const loV = args.length >= 3 ? this.argNum(args, 2, bar) : this.readSeries(this.low, bar, 0)
        const len = Math.max(1, Math.round(this.argNum(args, args.length >= 3 ? 3 : 1, bar, 14)))
        const hh = this.taRolling(-(seq * 10 + 1), hiV, len, 'hi')
        const ll = this.taRolling(-(seq * 10 + 2), loV, len, 'lo')
        if (Number.isNaN(hh) || Number.isNaN(ll) || hh === ll) return NA
        return ((src - ll) / (hh - ll)) * 100
      }
      case 'wpr':
      case 'ta.wpr': {
        const len = Math.max(1, Math.round(this.argNum(args, 0, bar, 14)))
        const hh = this.taRolling(-(seq * 10 + 1), this.readSeries(this.high, bar, 0), len, 'hi')
        const ll = this.taRolling(-(seq * 10 + 2), this.readSeries(this.low, bar, 0), len, 'lo')
        const c = this.readSeries(this.close, bar, 0)
        if (Number.isNaN(hh) || Number.isNaN(ll) || hh === ll) return NA
        return (-100 * (hh - c)) / (hh - ll)
      }
      case 'cci':
      case 'ta.cci': {
        const tp = (this.readSeries(this.high, bar, 0) + this.readSeries(this.low, bar, 0) + this.readSeries(this.close, bar, 0)) / 3
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 20)))
        const st = this.state(seq, () => ({ k: 'arr' as const, buf: [] }))
        if (Number.isFinite(tp)) {
          st.buf.push(tp)
          if (st.buf.length > len) st.buf.shift()
        }
        if (st.buf.length < len) return NA
        const mean = st.buf.reduce((a, b) => a + b, 0) / len
        let dev = 0
        for (const x of st.buf) dev += Math.abs(x - mean)
        const md = dev / len
        return md === 0 ? NA : (tp - mean) / (0.015 * md)
      }
      case 'mfi':
      case 'ta.mfi': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 14)))
        const tp = Number.isFinite(src) ? src : (this.readSeries(this.high, bar, 0) + this.readSeries(this.low, bar, 0) + this.readSeries(this.close, bar, 0)) / 3
        const st = this.state(seq, () => ({ k: 'chg' as const, s: NA, has: false }))
        const prevTp = st.has ? st.s : NA
        st.s = tp
        st.has = true
        const vol = this.volume[bar] ?? 0
        const flow = tp * vol
        const pos = Number.isNaN(prevTp) ? 0 : tp > prevTp ? flow : 0
        const neg = Number.isNaN(prevTp) ? 0 : tp < prevTp ? flow : 0
        const ps = this.taRolling(-(seq * 10 + 1), pos, len, 'mean')
        const ns = this.taRolling(-(seq * 10 + 2), neg, len, 'mean')
        if (Number.isNaN(ps) || Number.isNaN(ns)) return NA
        if (ns === 0) return 100
        return 100 - 100 / (1 + ps / ns)
      }
      case 'obv':
      case 'ta.obv': {
        const st = this.state(seq, () => ({ k: 'chg' as const, s: 0, has: false }))
        const c = this.readSeries(this.close, bar, 0)
        const pc = this.readSeries(this.close, bar, 1)
        if (!st.has || Number.isNaN(pc)) {
          st.has = true
          return st.s
        }
        if (c > pc) st.s += this.volume[bar] ?? 0
        else if (c < pc) st.s -= this.volume[bar] ?? 0
        return st.s
      }
      case 'barssince':
      case 'ta.barssince': {
        const cond = toBool(this.arg(args, 0, bar))
        const st = this.state(seq, () => ({ k: 'count' as const, n: 0, has: false }))
        if (cond) {
          st.n = 0
          st.has = true
        } else if (st.has) {
          st.n++
        }
        return st.has ? st.n : NA
      }
      case 'valuewhen':
      case 'ta.valuewhen': {
        const cond = toBool(this.arg(args, 0, bar))
        const src = this.argNum(args, 1, bar)
        const occ = Math.max(0, Math.round(this.argNum(args, 2, bar, 0)))
        const st = this.state(seq, () => ({ k: 'arr' as const, buf: [] }))
        if (cond && Number.isFinite(src)) {
          st.buf.push(src)
          if (st.buf.length > 200) st.buf.shift()
        }
        return st.buf.length > occ ? st.buf[st.buf.length - 1 - occ] : NA
      }
      case 'highestbars':
      case 'ta.highestbars':
      case 'lowestbars':
      case 'ta.lowestbars': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 14)))
        const st = this.state(seq, () => ({ k: 'arr' as const, buf: [] }))
        if (Number.isFinite(src)) {
          st.buf.push(src)
          if (st.buf.length > len) st.buf.shift()
        }
        if (st.buf.length < len) return NA
        let best = 0
        for (let i = 1; i < st.buf.length; i++) {
          const cur = st.buf[i]
          const bi = st.buf[best]
          if (name.includes('highest') ? cur > bi : cur < bi) best = i
        }
        return -(len - 1 - best) // offset negatif ala Pine (0 = bar sekarang)
      }
      case 'linreg':
      case 'ta.linreg': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(2, Math.round(this.argNum(args, 1, bar, 20)))
        const offset = Math.round(this.argNum(args, 2, bar, 0))
        const st = this.state(seq, () => ({ k: 'arr' as const, buf: [] }))
        if (Number.isFinite(src)) {
          st.buf.push(src)
          if (st.buf.length > len) st.buf.shift()
        }
        if (st.buf.length < len) return NA
        // least squares: x = 0 (terlama) … len-1 (terbaru); nilai di x = len-1+offset
        let sx = 0
        let sy = 0
        let sxy = 0
        let sxx = 0
        for (let i = 0; i < len; i++) {
          sx += i
          sy += st.buf[i]
          sxy += i * st.buf[i]
          sxx += i * i
        }
        const den = len * sxx - sx * sx
        if (den === 0) return NA
        const slope = (len * sxy - sx * sy) / den
        const intercept = (sy - slope * sx) / len
        return intercept + slope * (len - 1 + offset)
      }
      case 'median':
      case 'ta.median': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 20)))
        const st = this.state(seq, () => ({ k: 'arr' as const, buf: [] }))
        if (Number.isFinite(src)) {
          st.buf.push(src)
          if (st.buf.length > len) st.buf.shift()
        }
        if (st.buf.length < len) return NA
        const s = [...st.buf].sort((a, b) => a - b)
        return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
      }
      case 'range':
      case 'ta.range': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 14)))
        const hi = this.taRolling(-(seq * 10 + 1), src, len, 'hi')
        const lo = this.taRolling(-(seq * 10 + 2), src, len, 'lo')
        return Number.isNaN(hi) || Number.isNaN(lo) ? NA : hi - lo
      }
      case 'vwap':
      case 'ta.vwap': {
        const st = this.state(seq, () => ({ k: 'vwap' as const, pv: 0, vol: 0, day: -1 }))
        const day = Math.floor((this.timeArr[bar] ?? 0) / 86_400)
        if (st.day !== day) {
          st.day = day
          st.pv = 0
          st.vol = 0
        }
        const tp = (this.readSeries(this.high, bar, 0) + this.readSeries(this.low, bar, 0) + this.readSeries(this.close, bar, 0)) / 3
        const vol = this.volume[bar] ?? 0
        st.pv += tp * vol
        st.vol += vol
        return st.vol > 0 ? st.pv / st.vol : NA
      }
      case 'sar':
      case 'ta.sar': {
        const start = this.argNum(args, 0, bar, 0.02)
        const inc = this.argNum(args, 1, bar, 0.02)
        const maxAf = this.argNum(args, 2, bar, 0.2)
        const st = this.state(seq, () => ({ k: 'sar' as const, trend: 1, ep: NA, af: start, cur: NA, started: false }))
        const h = this.readSeries(this.high, bar, 0)
        const l = this.readSeries(this.low, bar, 0)
        const pc = this.readSeries(this.close, bar, 1)
        if (!st.started) {
          st.started = true
          st.trend = pc <= h ? 1 : -1
          st.ep = st.trend === 1 ? h : l
          st.cur = st.trend === 1 ? l : h
          return st.cur
        }
        // update SAR
        st.cur = st.cur + st.af * (st.ep - st.cur)
        if (st.trend === 1) {
          st.cur = Math.min(st.cur, this.readSeries(this.low, bar, 1), pc - 0.01)
          if (h > st.ep) {
            st.ep = h
            st.af = Math.min(maxAf, st.af + inc)
          }
          if (l < st.cur) {
            st.trend = -1
            st.cur = st.ep
            st.ep = l
            st.af = start
          }
        } else {
          st.cur = Math.max(st.cur, this.readSeries(this.high, bar, 1), pc + 0.01)
          if (l < st.ep) {
            st.ep = l
            st.af = Math.min(maxAf, st.af + inc)
          }
          if (h > st.cur) {
            st.trend = 1
            st.cur = st.ep
            st.ep = h
            st.af = start
          }
        }
        return st.cur
      }
      case 'rising':
      case 'ta.rising':
      case 'falling':
      case 'ta.falling': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 1)))
        const st = this.state(seq, () => ({ k: 'arr' as const, buf: [] }))
        if (Number.isFinite(src)) {
          st.buf.push(src)
          if (st.buf.length > len + 1) st.buf.shift()
        }
        if (st.buf.length < len + 1) return false
        const up = name.includes('rising')
        for (let i = st.buf.length - len; i < st.buf.length; i++) {
          if (up ? st.buf[i] <= st.buf[i - 1] : st.buf[i] >= st.buf[i - 1]) return false
        }
        return true
      }
      case 'pivothigh':
      case 'ta.pivothigh':
      case 'pivotlow':
      case 'ta.pivotlow': {
        // (src, left, right) ATAU (left, right) — src default high/low
        let src: number
        let left: number
        let right: number
        if (args.length >= 3) {
          src = this.argNum(args, 0, bar)
          left = Math.max(1, Math.round(this.argNum(args, 1, bar)))
          right = Math.max(1, Math.round(this.argNum(args, 2, bar)))
        } else {
          src = name.includes('high') ? this.readSeries(this.high, bar, 0) : this.readSeries(this.low, bar, 0)
          left = Math.max(1, Math.round(this.argNum(args, 0, bar)))
          right = Math.max(1, Math.round(this.argNum(args, 1, bar)))
        }
        const st = this.state(seq, () => ({ k: 'arr' as const, buf: [] }))
        if (Number.isFinite(src)) st.buf.push(src)
        const need = left + right + 1
        if (st.buf.length < need) return NA
        const cIdx = st.buf.length - 1 - right
        const pivot = st.buf[cIdx]
        // SEMANTIK TradingView (highestbars/lowestbars): bila ada nilai KEMBAR,
        // bar yang LEBIH BARU menang → pivot TIDAK sah bila kembar berada di
        // sisi LEBIH BARU (index > cIdx), tetapi SAH bila kembar hanya di
        // sisi lebih lama (index < cIdx). Index buf: kecil = lama, besar = baru.
        for (let i = cIdx - left; i <= cIdx + right; i++) {
          if (i === cIdx) continue
          const other = st.buf[i]
          const isNewer = i > cIdx
          if (name.includes('high')) {
            if (isNewer ? other >= pivot : other > pivot) return NA
          } else {
            if (isNewer ? other <= pivot : other < pivot) return NA
          }
        }
        return pivot
      }

      /* ── tuple Pine ── */
      case 'macd':
      case 'ta.macd': {
        const src = this.argNum(args, 0, bar)
        const fast = Math.max(1, Math.round(this.argNum(args, 1, bar, 12)))
        const slow = Math.max(fast, Math.round(this.argNum(args, 2, bar, 26)))
        const sigLen = Math.max(1, Math.round(this.argNum(args, 3, bar, 9)))
        const ef = this.taEma(-(seq * 10 + 1), src, fast, 'ema')
        const es = this.taEma(-(seq * 10 + 2), src, slow, 'ema')
        const macdLine = Number.isNaN(ef) || Number.isNaN(es) ? NA : ef - es
        const signal = this.taEma(-(seq * 10 + 3), macdLine, sigLen, 'ema')
        const hist = Number.isNaN(macdLine) || Number.isNaN(signal) ? NA : macdLine - signal
        this.lastTuple = [macdLine, signal, hist]
        return macdLine
      }
      case 'bb':
      case 'ta.bb': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 20)))
        const mult = this.argNum(args, 2, bar, 2)
        const mid = this.taRolling(-(seq * 10 + 1), src, len, 'mean')
        const dev = this.taRolling(-(seq * 10 + 2), src, len, 'stdev')
        if (Number.isNaN(mid) || Number.isNaN(dev)) {
          this.lastTuple = [NA, NA, NA]
          return NA
        }
        this.lastTuple = [mid, mid + mult * dev, mid - mult * dev]
        return mid
      }
      case 'dmi':
      case 'ta.dmi': {
        const diLen = Math.max(1, Math.round(this.argNum(args, 0, bar, 14)))
        const adxLen = Math.max(1, Math.round(this.argNum(args, 1, bar, 14)))
        const st = this.state(seq, () => ({
          k: 'dmi' as const,
          up: { seeded: false, seedBuf: [], value: NA, alpha: 1 / diLen, len: diLen },
          dn: { seeded: false, seedBuf: [], value: NA, alpha: 1 / diLen, len: diLen },
          tr: { seeded: false, seedBuf: [], value: NA, alpha: 1 / diLen, len: diLen },
          adx: { seeded: false, seedBuf: [], value: NA, alpha: 1 / adxLen, len: adxLen },
          prevH: NA,
          prevL: NA,
          has: false,
        }))
        const h = this.readSeries(this.high, bar, 0)
        const l = this.readSeries(this.low, bar, 0)
        const tr = this.trueRange(bar)
        let plusDM = 0
        let minusDM = 0
        if (st.has && Number.isFinite(st.prevH) && Number.isFinite(st.prevL)) {
          const upMove = h - st.prevH
          const downMove = st.prevL - l
          if (upMove > downMove && upMove > 0) plusDM = upMove
          if (downMove > upMove && downMove > 0) minusDM = downMove
        }
        st.prevH = h
        st.prevL = l
        st.has = true
        const trur = this.pushEma(st.tr, tr)
        const pdi = trur > 0 ? (100 * this.pushEma(st.up, plusDM)) / trur : NA
        const mdi = trur > 0 ? (100 * this.pushEma(st.dn, minusDM)) / trur : NA
        let dx = NA
        if (Number.isFinite(pdi) && Number.isFinite(mdi) && pdi + mdi > 0) {
          dx = (100 * Math.abs(pdi - mdi)) / (pdi + mdi)
        }
        const adx = this.pushEma(st.adx, dx)
        this.lastTuple = [pdi, mdi, adx]
        return pdi
      }
      case 'supertrend':
      case 'ta.supertrend': {
        const factor = this.argNum(args, 0, bar, 3)
        const atrPeriod = Math.max(1, Math.round(this.argNum(args, 1, bar, 10)))
        const atrSt = this.state(-(seq * 10 + 1), () => this.mkEma('rma', atrPeriod))
        const atr = this.pushEma(atrSt, this.trueRange(bar))
        const st = this.state(seq, () => ({ k: 'strend' as const, prevLower: NA, prevUpper: NA, prevSt: NA, prevDir: 1, has: false }))
        if (Number.isNaN(atr)) {
          this.lastTuple = [NA, NA]
          return NA
        }
        const src = (this.readSeries(this.high, bar, 0) + this.readSeries(this.low, bar, 0)) / 2
        const c = this.readSeries(this.close, bar, 0)
        const pc = this.readSeries(this.close, bar, 1)
        let lower = src - factor * atr
        let upper = src + factor * atr
        if (st.has && Number.isFinite(st.prevLower) && Number.isFinite(st.prevUpper)) {
          lower = lower > st.prevLower || Number.isFinite(pc) && pc < st.prevLower ? lower : st.prevLower
          upper = upper < st.prevUpper || Number.isFinite(pc) && pc > st.prevUpper ? upper : st.prevUpper
        }
        let dir: number
        if (st.has && st.prevSt === st.prevUpper) {
          dir = c > upper ? -1 : 1
        } else {
          dir = c < lower ? 1 : -1
        }
        const stVal = dir === -1 ? lower : upper
        st.prevLower = lower
        st.prevUpper = upper
        st.prevSt = stVal
        st.prevDir = dir
        st.has = true
        this.lastTuple = [stVal, dir]
        return stVal
      }

      /* ── math.* ── */
      case 'abs': case 'math.abs': return Math.abs(this.argNum(args, 0, bar))
      case 'max': case 'math.max': {
        let m = -Infinity
        for (let i = 0; i < args.length; i++) m = Math.max(m, this.argNum(args, i, bar))
        return m
      }
      case 'min': case 'math.min': {
        let m = Infinity
        for (let i = 0; i < args.length; i++) m = Math.min(m, this.argNum(args, i, bar))
        return m
      }
      case 'avg': case 'math.avg': {
        let s = 0
        let n = 0
        for (let i = 0; i < args.length; i++) {
          const v = this.argNum(args, i, bar)
          if (Number.isFinite(v)) { s += v; n++ }
        }
        return n ? s / n : NA
      }
      case 'sum': case 'math.sum': {
        const src = this.argNum(args, 0, bar)
        const len = Math.max(1, Math.round(this.argNum(args, 1, bar, 20)))
        const m = this.taRolling(seq, src, len, 'mean')
        return Number.isNaN(m) ? NA : m * len
      }
      case 'pow': case 'math.pow': return Math.pow(this.argNum(args, 0, bar), this.argNum(args, 1, bar))
      case 'sqrt': case 'math.sqrt': {
        const v = this.argNum(args, 0, bar)
        return v < 0 ? NA : Math.sqrt(v)
      }
      case 'round': case 'math.round': {
        const v = this.argNum(args, 0, bar)
        const prec = this.argNum(args, 1, bar, NaN)
        return Number.isFinite(prec) ? Number(v.toFixed(Math.max(0, Math.min(8, Math.round(prec))))) : Math.round(v)
      }
      case 'floor': case 'math.floor': return Math.floor(this.argNum(args, 0, bar))
      case 'ceil': case 'math.ceil': return Math.ceil(this.argNum(args, 0, bar))
      case 'log': case 'math.log': {
        const v = this.argNum(args, 0, bar)
        return v > 0 ? Math.log(v) : NA
      }
      case 'log10': case 'math.log10': {
        const v = this.argNum(args, 0, bar)
        return v > 0 ? Math.log10(v) : NA
      }
      case 'exp': case 'math.exp': return Math.exp(this.argNum(args, 0, bar))
      case 'sign': case 'math.sign': {
        const v = this.argNum(args, 0, bar)
        return v > 0 ? 1 : v < 0 ? -1 : 0
      }
      case 'todegrees': case 'math.todegrees': return (this.argNum(args, 0, bar) * 180) / Math.PI
      case 'toradians': case 'math.toradians': return (this.argNum(args, 0, bar) * Math.PI) / 180

      /* ── str.* ── */
      case 'tostring': case 'str.tostring': {
        const v = this.arg(args, 0, bar)
        if (typeof v === 'string') return v
        if (typeof v === 'boolean') return v ? 'true' : 'false'
        if (Number.isNaN(v)) return 'na'
        const fmt = this.argNum(args, 1, bar, NaN)
        return Number.isFinite(fmt) ? v.toFixed(Math.max(0, Math.min(8, Math.round(fmt)))) : numToStr(v)
      }
      case 'tonumber': case 'str.tonumber': {
        const v = this.arg(args, 0, bar)
        return toNum(v)
      }
      case 'str.length': {
        const s = this.argStr(args, 0, bar)
        return s.length
      }
      case 'str.contains': {
        const s = this.argStr(args, 0, bar)
        const sub = this.argStr(args, 1, bar)
        return s.includes(sub)
      }
      case 'str.startswith': {
        const s = this.argStr(args, 0, bar)
        const sub = this.argStr(args, 1, bar)
        return s.startsWith(sub)
      }
      case 'str.endswith': {
        const s = this.argStr(args, 0, bar)
        const sub = this.argStr(args, 1, bar)
        return s.endsWith(sub)
      }
      case 'str.upper': return this.argStr(args, 0, bar).toUpperCase()
      case 'str.lower': return this.argStr(args, 0, bar).toLowerCase()
      case 'str.trim': return this.argStr(args, 0, bar).trim()
      case 'str.replace_all': {
        const s = this.argStr(args, 0, bar)
        const a = this.argStr(args, 1, bar)
        const b = this.argStr(args, 2, bar)
        return a === '' ? s : s.split(a).join(b)
      }
      case 'str.replace_one': {
        const s = this.argStr(args, 0, bar)
        const a = this.argStr(args, 1, bar)
        const b = this.argStr(args, 2, bar)
        return a === '' ? s : s.replace(a, b)
      }
      case 'str.substring': {
        const s = this.argStr(args, 0, bar)
        const b = Math.max(0, Math.round(this.argNum(args, 1, bar, 0)))
        const e = args.length >= 3 ? Math.round(this.argNum(args, 2, bar, s.length)) : s.length
        return s.slice(b, e)
      }
      case 'str.repeat': {
        const s = this.argStr(args, 0, bar)
        const n = Math.max(0, Math.min(100, Math.round(this.argNum(args, 1, bar, 1))))
        return s.repeat(n)
      }
      case 'str.format': {
        const fmt = this.argStr(args, 0, bar)
        return fmt.replace(/\{(\d+)\}/g, (_m, d) => luxToStr(this.arg(args, Number(d) + 1, bar)))
      }

      /* ── waktu ── */
      case 'year': return this.jakartaParts(this.timeOf(args, bar)).year
      case 'month': return this.jakartaParts(this.timeOf(args, bar)).month
      case 'dayofmonth': return this.jakartaParts(this.timeOf(args, bar)).day
      case 'dayofweek': return this.jakartaParts(this.timeOf(args, bar)).dow
      case 'hour': return this.jakartaParts(this.timeOf(args, bar)).hour
      case 'minute': return this.jakartaParts(this.timeOf(args, bar)).minute
      case 'second': return this.jakartaParts(this.timeOf(args, bar)).second
      case 'timenow': return Date.now()
      case 'time': {
        // time([timeframe, session, timezone]) → epoch ms bila bar DI DALAM
        // sesi, na di luar (dipakai: not na(time(timeframe.period, sessStr,
        // "Asia/Jakarta"))). Sesi subset "HHMM-HHMM[:dgt]"; multi-sesi dipisah
        // koma; zona waktu engine = Asia/Jakarta.
        const tSec = this.timeArr[bar] ?? 0
        const epochMs = Number.isNaN(tSec) ? NA : tSec * 1000
        const sess = this.argStr(args, 1, bar, '')
        if (!sess) return epochMs // time(timeframe) tanpa sesi → waktu bar
        const parts = this.jakartaParts(tSec)
        const mins = parts.hour * 60 + parts.minute
        const dow = parts.dow // Pine: Sunday=1 … Saturday=7
        for (const seg of sess.split(',')) {
          const m = seg.trim().match(/^(\d{2})(\d{2})-(\d{2})(\d{2})(?::([0-9]+))?$/)
          if (!m) continue
          const start = Number(m[1]) * 60 + Number(m[2])
          const end = Number(m[3]) * 60 + Number(m[4])
          if (m[5] && m[5].length > 0) {
            const dset = new Set(m[5].split('').map(Number))
            if (!dset.has(dow)) continue
          }
          const inSess = start <= end
            ? mins >= start && mins < end
            : mins >= start || mins < end // sesi lintas tengah malam
          if (inSess) return epochMs
        }
        return NA
      }
      case 'timestamp': {
        // timestamp(y, m, d [, hour, minute, second]) → epoch ms (UTC sederhana)
        const y = Math.round(this.argNum(args, 0, bar, 2026))
        const mo = Math.round(this.argNum(args, 1, bar, 1))
        const d = Math.round(this.argNum(args, 2, bar, 1))
        const h = Math.round(this.argNum(args, 3, bar, 0))
        const mi = Math.round(this.argNum(args, 4, bar, 0))
        const s = Math.round(this.argNum(args, 5, bar, 0))
        return Date.UTC(y, mo - 1, d, h, mi, s)
      }

      /* ── output ── */
      case 'plot':
      case 'plotshape':
      case 'plotchar': {
        let p = this.plots.get(seq)
        if (!p) {
          p = { title: this.argStr(args, 1, bar, `plot ${this.plots.size + 1}`), values: [] }
          this.plots.set(seq, p)
        }
        // BAR-ALIGNED: nilai disimpan per index bar (sparse) — plot di
        // dalam if tetap sejajar dengan candle di UI.
        const v = toNum(this.arg(args, 0, bar))
        p.values[bar] = Number.isNaN(v) ? NA : v
        return NA
      }
      case 'hline':
      case 'fill':
      case 'bgcolor':
      case 'barcolor':
      case 'label.new':
      case 'label':
      case 'line.new':
      case 'line':
      case 'box.new':
      case 'box':
      case 'table.new':
      case 'table.cell':
      case 'table':
      case 'alertcondition_freq':
        return NA // no-op visual
      case 'alertcondition': {
        const cond = toBool(this.arg(args, 0, bar))
        if (cond) this.pushEvent(bar, this.argStr(args, 1, bar, 'Alert'), this.argStr(args, 2, bar, 'Lux signal'))
        return NA
      }
      case 'alert': {
        const st = this.state(seq, () => ({ k: 'alertbar' as const, bar: -1 }))
        if (st.bar === bar) return NA // maks 1 alert() per bar per call-site
        st.bar = bar
        if (toBool(this.arg(args, 0, bar)) || typeof this.arg(args, 0, bar) === 'string') {
          const msg = typeof this.arg(args, 0, bar) === 'string' ? (this.arg(args, 0, bar) as string) : 'Lux alert'
          this.pushEvent(bar, 'alert', msg)
        }
        return NA
      }
      case 'strategy.cancel':
      case 'strategy.cancel_all':
      case 'strategy.close_all':
        return NA // pesan pending/close dibatalkan — no-op di mode sinyal
      case 'strategy.entry':
      case 'strategy.exit':
      case 'strategy.close': {
        // Mode alert-only: entry/exit dipetakan jadi event agar push tetap jalan.
        const idStr = this.argStr(args, 0, bar, name.split('.').pop() || 'order')
        // Pine: strategy.entry(id, direction, …) — direction arg ke-2 (strategy.long/short)
        const dirRaw = this.argStr(args, 1, bar, '')
        const dir = dirRaw.includes('long') ? 'LONG' : dirRaw.includes('short') ? 'SHORT' : ''
        if (dir) this.pushEvent(bar, idStr, `${dir} ${idStr}`)
        return NA
      }
      /* ── tidak didukung — pesan jelas ── */
      case 'request.security':
      case 'security':
        throw new LuxError(
          `Fungsi "${name}" belum didukung Lux subset (data timeframe/simbol lain tidak tersedia di engine H1 XAUUSD)${line ? ` — baris ${line}` : ''}`,
          'RUNTIME_ERROR',
        )
      case 'array.get':
      case 'array.push':
      case 'array.new_float':
      case 'array.new_int':
      case 'array.new_bool':
      case 'array.new_string':
      case 'array.size':
      case 'matrix.new':
      case 'map.new':
        throw new LuxError(
          `Tipe koleksi (array/matrix/map) belum didukung Lux subset${line ? ` — baris ${line}` : ''}. Gunakan variabel biasa atau ta.* functions.`,
          'RUNTIME_ERROR',
        )
    }

    throw new LuxError(`Fungsi "${name}" belum didukung Lux subset${line ? ` (baris ${line})` : ''}`, 'RUNTIME_ERROR')
  }

  /** True Range bar saat ini (TR). */
  private trueRange(bar: number): number {
    const h = this.readSeries(this.high, bar, 0)
    const l = this.readSeries(this.low, bar, 0)
    const pc = this.readSeries(this.close, bar, 1)
    return Number.isNaN(pc) ? h - l : Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))
  }

  private mkEma(kind: 'ema' | 'rma', len: number): EmaState {
    return {
      seeded: false,
      seedBuf: [],
      value: NA,
      alpha: kind === 'ema' ? 2 / (len + 1) : 1 / len,
      len,
    }
  }

  private pushEma(st: EmaState, v: number): number {
    if (Number.isNaN(v)) return st.value
    if (!st.seeded) {
      st.seedBuf.push(v)
      if (st.seedBuf.length < st.len) return NA
      let sum = 0
      for (const x of st.seedBuf) sum += x
      st.value = sum / st.len
      st.seeded = true
      st.seedBuf = []
      return st.value
    }
    st.value = st.alpha * v + (1 - st.alpha) * st.value
    return st.value
  }

  private taEma(seq: number, v: number, len: number, kind: 'ema' | 'rma'): number {
    const st = this.state(seq, () => ({ k: 'ema' as const, s: this.mkEma(kind, len) }))
    return this.pushEma(st.s, v)
  }

  private taRolling(
    seq: number,
    v: number,
    len: number,
    mode: 'mean' | 'wma' | 'hi' | 'lo' | 'stdev'
  ): number {
    const st = this.state(seq, () => ({ k: 'sma' as const, s: { buf: [], sum: 0 } }))
    const buf = st.s.buf
    if (Number.isNaN(v)) return NA
    buf.push(v)
    if (buf.length > len) {
      const dropped = buf.shift()!
      st.s.sum -= dropped
    }
    st.s.sum += v
    if (buf.length < len) return NA
    if (mode === 'mean') return st.s.sum / len
    if (mode === 'hi') return Math.max(...buf)
    if (mode === 'lo') return Math.min(...buf)
    if (mode === 'wma') {
      let num = 0
      let den = 0
      for (let i = 0; i < buf.length; i++) {
        const w = i + 1
        num += buf[i] * w
        den += w
      }
      return den === 0 ? NA : num / den
    }
    // stdev (populasi)
    const mean = st.s.sum / len
    let acc = 0
    for (const x of buf) acc += (x - mean) * (x - mean)
    return Math.sqrt(acc / len)
  }

  private taCross(seq: number, a: number, b: number, dir: 'up' | 'down' | 'any'): boolean {
    const st = this.state(seq, () => ({ k: 'cross' as const, s: { prevA: NA, prevB: NA, has: false } }))
    const prevA = st.s.has ? st.s.prevA : NA
    const prevB = st.s.has ? st.s.prevB : NA
    st.s.prevA = a
    st.s.prevB = b
    st.s.has = true
    if (Number.isNaN(prevA) || Number.isNaN(prevB) || Number.isNaN(a) || Number.isNaN(b)) return false
    const wasBelow = prevA <= prevB
    const wasAbove = prevA >= prevB
    const nowAbove = a > b
    const nowBelow = a < b
    if (dir === 'up') return wasBelow && nowAbove
    if (dir === 'down') return wasAbove && nowBelow
    return (wasBelow && nowAbove) || (wasAbove && nowBelow)
  }

  private pushEvent(bar: number, title: string, message: string): void {
    // Sanitasi output: potong panjang, buang kontrol char
    const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 280)
    const px = this.close[bar]
    // FIX: bila kuota penuh, buang event TERLAMA (depan) — bukan membuang
    // event BARU. Dulu `if (events.length >= max) return` memotong dari
    // sisi baru → histori menampilkan sinyal paling tua dan sinyal
    // terkini (Oktober–November) justru hilang dari hasil run.
    this.events.push({
      time: this.timeArr[bar] ?? 0,
      bar,
      title: clean(String(title ?? '')).slice(0, 80) || 'Alert',
      message: clean(String(message ?? '')) || 'Lux signal',
      price: Number.isFinite(px) ? px : undefined,
    })
    if (this.events.length > this.opts.maxEvents) this.events.shift()
  }
}

/* ---------- API publik modul ---------- */

export function runLuxScript(
  source: string,
  candles: LuxCandle[],
  opts: LuxRunOptions = {}
): LuxRunResult {
  let ast: LuxAst
  try {
    ast = parseLux(source)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, bars: 0, events: [], plots: [], durationMs: 0, error: msg, errorCode: 'PARSE_ERROR' }
  }
  const interp = new Interp(ast, candles, opts)
  return interp.run()
}
