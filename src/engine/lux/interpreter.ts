/**
 * ============================================================
 * LUX ENGINE — interpreter.ts
 * ============================================================
 * Eksekusi AST bar-per-bar (bar-by-bar) ala Pine:
 *   - Semua variabel user = series buffer (NaN = na).
 *   - `var x = e`  → inisialisasi SEKALI (bar pertama), persist.
 *   - `x = e`      → deklarasi dieksekusi ulang tiap bar.
 *   - `x := e`     → reassignment nilai bar ini.
 *   - `x[n]`       → lihat riwayat (n bar ke belakang).
 *   - ta.* stateful per call-site (seq token) — konsisten tiap bar.
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

import type { LuxAst, Expr, Stmt } from './parser'
import { parseLux } from './parser'
import type { LuxCandle, LuxEvent, LuxPlot, LuxRunOptions, LuxRunResult, LuxValue } from './types'

export class LuxError extends Error {
  code: NonNullable<LuxRunResult['errorCode']>
  constructor(message: string, code: NonNullable<LuxRunResult['errorCode']>) {
    super(message)
    this.code = code
  }
}

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

/* ---------- Series user ---------- */

interface SeriesVar {
  /** Buffer nilai per bar. Hole (undefined) = belum pernah di-assign. */
  buf: number[]
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
}

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
    this.stepBudget = 200_000 + this.n * 50
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
    while (b.length <= bar) b.push(undefined as unknown as number)
  }

  /* ---------- statement ---------- */
  private execStmt(st: Stmt, bar: number): void {
    this.tick()
    switch (st.t) {
      case 'expr':
        this.evalExpr(st.e, bar)
        return
      case 'declare': {
        // `x = e` dieksekusi ulang tiap bar (declare); `var x = e` sekali.
        // Buffer memakai HOLE (undefined) — beda dengan NaN yang benar-benar
        // di-assign — supaya nilai var yang persist bisa dilacak mundur.
        if (st.isVar) {
          let sv = this.vars.get(st.name)
          if (!sv) {
            sv = { buf: [], isVar: true, declared: false }
            this.vars.set(st.name, sv)
          }
          if (!sv.declared) {
            const v = this.evalExpr(st.e, bar)
            this.extendBuf(sv, bar)
            sv.buf[bar] = toNum(v)
            sv.declared = true
          } else {
            this.extendBuf(sv, bar) // jaga panjang buffer; nilai tetap dari bar lalu
          }
          return
        }
        const v = this.evalExpr(st.e, bar)
        let sv = this.vars.get(st.name)
        if (!sv || sv.isVar) {
          sv = { buf: [], isVar: false, declared: true }
          this.vars.set(st.name, sv)
        }
        this.extendBuf(sv, bar)
        sv.buf[bar] = toNum(v)
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
        sv.buf[bar] = toNum(v)
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
      case 'for': {
        const from = toNum(this.evalExpr(st.from, bar))
        const to = toNum(this.evalExpr(st.to, bar))
        const step = st.step || 1
        if (!Number.isFinite(from) || !Number.isFinite(to)) return
        let guard = 0
        if (step > 0) {
          for (let i = from; i <= to + 1e-9; i += step) {
            this.tick()
            if (++guard > 5000) throw new LuxError('Loop for melebihi 5000 iterasi', 'STEP_BUDGET')
            this.setLocal(st.ivar, i)
            for (const s2 of st.body) this.execStmt(s2, bar)
          }
        } else {
          for (let i = from; i >= to - 1e-9; i += step) {
            this.tick()
            if (++guard > 5000) throw new LuxError('Loop for melebihi 5000 iterasi', 'STEP_BUDGET')
            this.setLocal(st.ivar, i)
            for (const s2 of st.body) this.execStmt(s2, bar)
          }
        }
        this.setLocal(st.ivar, NA)
        return
      }
      case 'funcdef':
        this.funcs.set(st.name, { params: st.params, body: st.body })
        return
      case 'declareSeries':
        throw new LuxError('Assignment ke riwayat series belum didukung', 'RUNTIME_ERROR')
      case 'header':
        return
    }
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
        return this.readIdent(e.name, bar, 0)
      case 'member': {
        // hanya built-in: e.g. `input.int` sudah lewat call; member murni jarang
        // di subset. treat sebagai ident bertitik → unknown.
        throw new LuxError(`Member "${e.obj}.${e.path.join('.')}" tidak dikenal`, 'RUNTIME_ERROR')
      }
      case 'index': {
        if (e.base.t !== 'ident') throw new LuxError('Hanya variabel yang bisa diindeks riwayat x[n]', 'RUNTIME_ERROR')
        const nV = toNum(this.evalExpr(e.n, bar))
        const back = Math.round(nV)
        if (!Number.isFinite(back) || back < 0) return NA
        return this.readIdent(e.base.name, bar, back)
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
      case 'call':
        return this.evalCall(e.name, e.args, e.seq, bar)
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

  private readIdent(name: string, bar: number, back: number): LuxValue {
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
      case 'time': return this.readSeries(this.timeArr, bar, back)
      case 'hl2': return this.readSeries(this.open, bar, back) * 0 // placeholder dihitung di bawah
      case 'bar_index':
        return back === 0 ? bar : NA
      case 'na':
        return NA
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
        if (loc) return loc.kind === 'local' ? loc.v : this.readSeries(loc.sv.buf, bar, back)
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
          if (b[j] !== undefined) return b[j]
        }
      }
      return NA
    }
    throw new LuxError(`Variabel "${name}" tidak dikenal`, 'RUNTIME_ERROR')
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

  private evalCall(name: string, rawArgs: Expr[], seq: number, bar: number): LuxValue {
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

    // fungsi user
    const fn = this.funcs.get(name)
    if (fn) {
      const saved = this.locals
      this.locals = new Map()
      for (let i = 0; i < fn.params.length; i++) {
        this.locals.set(fn.params[i], { kind: 'local', v: this.evalExpr(args[i], bar) })
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
        return this.arg(args, 0, bar) // defval
      case 'indicator':
      case 'strategy':
        return NA

      /* ── konversi ── */
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
        const h = this.readSeries(this.high, bar, 0)
        const l = this.readSeries(this.low, bar, 0)
        const pc = this.readSeries(this.close, bar, 1)
        const tr = Number.isNaN(pc) ? h - l : Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))
        return this.pushEma(st.s, tr)
      }
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
      case 'pow': case 'math.pow': return Math.pow(this.argNum(args, 0, bar), this.argNum(args, 1, bar))
      case 'sqrt': case 'math.sqrt': {
        const v = this.argNum(args, 0, bar)
        return v < 0 ? NA : Math.sqrt(v)
      }
      case 'round': case 'math.round': return Math.round(this.argNum(args, 0, bar))
      case 'floor': case 'math.floor': return Math.floor(this.argNum(args, 0, bar))
      case 'ceil': case 'math.ceil': return Math.ceil(this.argNum(args, 0, bar))
      case 'log': case 'math.log': {
        const v = this.argNum(args, 0, bar)
        return v > 0 ? Math.log(v) : NA
      }
      case 'exp': case 'math.exp': return Math.exp(this.argNum(args, 0, bar))
      case 'sign': case 'math.sign': {
        const v = this.argNum(args, 0, bar)
        return v > 0 ? 1 : v < 0 ? -1 : 0
      }

      /* ── str.* ── */
      case 'tostring': case 'str.tostring': {
        const v = this.arg(args, 0, bar)
        if (typeof v === 'string') return v
        if (typeof v === 'boolean') return v ? 'true' : 'false'
        if (Number.isNaN(v)) return 'na'
        const fmt = this.argNum(args, 1, bar, NaN)
        return Number.isFinite(fmt) ? v.toFixed(Math.max(0, Math.min(8, Math.round(fmt)))) : String(v)
      }
      case 'tonumber': case 'str.tonumber': {
        const v = this.arg(args, 0, bar)
        return toNum(v)
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
      case 'table':
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
    }

    throw new LuxError(`Fungsi "${name}" belum didukung Lux subset`, 'RUNTIME_ERROR')
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
    if (this.events.length >= this.opts.maxEvents) return
    // Sanitasi output: potong panjang, buang kontrol char
    const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 280)
    this.events.push({
      time: this.timeArr[bar] ?? 0,
      bar,
      title: clean(String(title ?? '')).slice(0, 80) || 'Alert',
      message: clean(String(message ?? '')) || 'Lux signal',
    })
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
