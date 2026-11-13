/**
 * ============================================================
 * LUX ENGINE — parser.ts
 * ============================================================
 * Parser subset Lux Script → AST. Membaca token dari tokenizer.
 * Fitur: deklarasi variabel (var / varip / plain / BERTIPE `float x
 * = …`), reassignment (:=), if/else if/else (sebagai statement MAUPUN
 * nilai `x = if …`), for & while (dengan break/continue), switch,
 * definisi fungsi satu-ekspresi (f(a, b) => expr, parameter boleh
 * bertipe), pemanggilan, indexing history x[n], ternary, tuple
 * destructuring `[macd, sig, hist] = ta.macd(…)`, baris `import …`
 * diabaikan, call multi-baris (continuation di tokenizer).
 * ============================================================
 */

import { tokenize, type Token } from './tokenizer'

/* ---------- AST ---------- */

export type Expr =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'na' }
  | { t: 'ident'; name: string; line?: number }
  | { t: 'member'; obj: string; path: string[]; line?: number }
  | { t: 'index'; base: Expr; n: Expr; line?: number }
  | { t: 'un'; op: '-' | 'not' | '+'; e: Expr; line?: number }
  | { t: 'bin'; op: string; l: Expr; r: Expr; line?: number }
  | { t: 'ternary'; c: Expr; a: Expr; b: Expr; line?: number }
  | { t: 'call'; name: string; args: Expr[]; seq: number; line?: number }
  | { t: 'namedarg'; name: string; e: Expr }
  | { t: 'array'; items: Expr[]; line?: number }

export interface IfBranch { cond: Expr | null; body: Stmt[] }
export interface SwitchBranch { when: Expr | null; body: Stmt[] }

export type Stmt =
  | { t: 'expr'; e: Expr; line: number }
  | { t: 'declare'; name: string; isVar: boolean; e: Expr; line: number }
  | { t: 'assign'; name: string; e: Expr; line: number }
  | { t: 'tuple'; names: string[]; e: Expr; line: number }
  | { t: 'if'; branches: IfBranch[]; line: number }
  | { t: 'ifassign'; name: string; isVar: boolean; branches: IfBranch[]; line: number }
  | { t: 'switchassign'; name: string; isVar: boolean; subject: Expr | null; branches: SwitchBranch[]; line: number }
  | { t: 'while'; cond: Expr; body: Stmt[]; line: number }
  | { t: 'break'; line: number }
  | { t: 'continue'; line: number }
  | { t: 'for'; ivar: string; from: Expr; to: Expr; step: number; body: Stmt[]; line: number }
  | { t: 'funcdef'; name: string; params: string[]; body: Expr; line: number }
  | { t: 'header'; kind: 'indicator' | 'strategy'; name: string; line: number }

export interface LuxAst {
  header: Stmt | null
  body: Stmt[]
}

/* ---------- kata kunci tipe Pine (dilepas sebelum nama variabel) ---------- */

const TYPE_WORDS = new Set([
  'int', 'float', 'bool', 'string', 'color', 'line', 'label', 'box', 'table',
  'series', 'simple', 'const', 'array', 'matrix', 'map',
])

/* ---------- Parser ---------- */

class Parser {
  private toks: Token[]
  private pos = 0
  private seq = 0

  constructor(src: string) {
    this.toks = tokenize(src)
  }

  private peek(): Token {
    return this.toks[this.pos]
  }
  private next(): Token {
    return this.toks[this.pos++]
  }
  private isOp(v: string): boolean {
    const t = this.peek()
    return t.kind === 'op' && t.value === v
  }
  private eatOp(v: string): boolean {
    if (this.isOp(v)) {
      this.pos++
      return true
    }
    return false
  }
  private expectOp(v: string): void {
    if (!this.eatOp(v)) {
      const t = this.peek()
      throw new Error(`Baris ${t.line}: diharapkan "${v}", dapat "${t.value || t.kind}"`)
    }
  }
  private skipNewlines(): void {
    while (this.peek().kind === 'newline') this.pos++
  }

  private parseBlock(): Stmt[] {
    this.skipNewlines()
    if (!this.eatIndentIfAny()) return []
    const stmts: Stmt[] = []
    this.skipNewlines()
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      stmts.push(this.parseStatement())
      this.skipNewlines()
    }
    this.eatDedentIfAny()
    return stmts
  }

  private eatIndentIfAny(): boolean {
    if (this.peek().kind === 'indent') {
      this.pos++
      return true
    }
    return false
  }
  private eatDedentIfAny(): boolean {
    if (this.peek().kind === 'dedent') {
      this.pos++
      return true
    }
    return false
  }

  /** Lewati kata tipe Pine (int/float/…/array<T>) — dipakai sebelum nama variabel. */
  private skipType(): void {
    // ulangi utk qualifier beruntun: `series float`, `simple int`
    for (;;) {
      const t = this.peek()
      if (t.kind !== 'ident' || !TYPE_WORDS.has(t.value)) return
      this.pos++
      // generic: array<float> / matrix<float> / map<string, float>
      if (this.isOp('<')) {
        let depth = 0
        do {
          const tk = this.next()
          if (tk.kind === 'eof' || (tk.kind === 'newline' && depth === 0)) {
            throw new Error(`Baris ${t.line}: generic type tidak ditutup ">"`)
          }
          if (tk.kind === 'op' && tk.value === '<') depth++
          if (tk.kind === 'op' && tk.value === '>') depth--
        } while (depth > 0)
      }
    }
  }

  parseProgram(): LuxAst {
    let header: Stmt | null = null
    const body: Stmt[] = []
    this.skipNewlines()
    while (this.peek().kind !== 'eof') {
      const s = this.parseStatement()
      if (s.t === 'header') {
        if (!header) header = s
      } else {
        body.push(s)
      }
      this.skipNewlines()
    }
    return { header, body }
  }

  private parseStatement(): Stmt {
    const t = this.peek()
    const line = t.line

    // Header indikator/strategi
    if (t.kind === 'ident' && (t.value === 'indicator' || t.value === 'strategy')) {
      const nt = this.toks[this.pos + 1]
      if (nt && nt.kind === 'op' && nt.value === '(') {
        const kind = t.value as 'indicator' | 'strategy'
        this.pos += 2
        let name = ''
        // Argumen pertama biasanya judul string
        if (this.peek().kind === 'str') name = String(this.next().value)
        let depth = 1
        while (depth > 0 && this.peek().kind !== 'eof') {
          const tk = this.next()
          if (tk.kind === 'op' && tk.value === '(') depth++
          if (tk.kind === 'op' && tk.value === ')') depth--
        }
        return { t: 'header', kind, name, line }
      }
    }

    // `import user/lib/1 as x` → diabaikan (subset tanpa library eksternal)
    if (t.kind === 'ident' && t.value === 'import') {
      while (this.peek().kind !== 'newline' && this.peek().kind !== 'eof') this.pos++
      return { t: 'expr', e: { t: 'na' }, line }
    }

    // `export f(x) => …` (library script) → lewati prefix, lanjut statement
    if (t.kind === 'ident' && t.value === 'export') {
      const nt = this.toks[this.pos + 1]
      if (nt && nt.kind === 'ident' && nt.value !== 'if' && nt.value !== 'for' && nt.value !== 'var') {
        this.pos++
        return this.parseStatement()
      }
    }

    // tuple destructuring: [a, b, c] = expr   /   [a, b] := expr
    if (t.kind === 'op' && t.value === '[') {
      this.pos++
      const names: string[] = []
      for (;;) {
        const id = this.next()
        if (id.kind !== 'ident') throw new Error(`Baris ${line}: tuple destructuring butuh nama variabel`)
        names.push(id.value)
        if (this.eatOp(',')) continue
        break
      }
      this.expectOp(']')
      if (this.eatOp(':=')) {
        const e = this.parseExpr()
        return { t: 'tuple', names, e, line }
      }
      this.expectOp('=')
      const e = this.parseExpr()
      return { t: 'tuple', names, e, line }
    }

    if (t.kind === 'ident') {
      // funcdef: name(params) => expr — nt2 boleh ')' (0 param) atau ident atau tipe
      const nt = this.toks[this.pos + 1]
      const nt2 = this.toks[this.pos + 2]
      if (
        nt && nt.kind === 'op' && nt.value === '(' &&
        nt2 && (nt2.value === ')' || nt2.kind === 'ident')
      ) {
        // Mungkin funcdef ATAU pemanggilan statement — bedakan dengan
        // mencari `=>` sebelum newline pada level yang sama.
        if (this.looksLikeFuncdef()) return this.parseFuncdef()
      }

      // var / varip — boleh diikuti tipe: `var float stop = …`
      if (t.value === 'var' || t.value === 'varip') {
        this.pos++
        this.skipType()
        const nameTok = this.next()
        if (nameTok.kind !== 'ident') throw new Error(`Baris ${line}: diharapkan nama variabel setelah var`)
        if (this.isOp(':=')) {
          this.pos++
          const e = this.parseExpr()
          return { t: 'assign', name: nameTok.value, e, line }
        }
        this.expectOp('=')
        // `var x = if cond …` / `var x = switch …` — nilai blok
        const blk = this.tryParseValueBlock(nameTok.value, true, line)
        if (blk) return blk
        const e = this.parseExpr()
        return { t: 'declare', name: nameTok.value, isVar: true, e, line }
      }

      // if / for / while / switch / break / continue
      if (t.value === 'if') return this.parseIf()
      if (t.value === 'for') return this.parseFor()
      if (t.value === 'while') return this.parseWhile()
      if (t.value === 'switch') return this.parseSwitchAssign(null, false, line)
      if (t.value === 'break' && this.toks[this.pos + 1]?.kind !== 'op' && this.toks[this.pos + 1]?.kind !== 'ident') {
        this.pos++
        return { t: 'break', line }
      }
      if (t.value === 'continue' && this.toks[this.pos + 1]?.kind !== 'op' && this.toks[this.pos + 1]?.kind !== 'ident') {
        this.pos++
        return { t: 'continue', line }
      }

      // deklarasi bertipe: `float x = …` (harus diikuti NAMA variabel, bukan `.` call)
      if (TYPE_WORDS.has(t.value)) {
        const ntA = this.toks[this.pos + 1]
        if (ntA && ntA.kind === 'ident' && !TYPE_WORDS.has(ntA.value)) {
          const ntB = this.toks[this.pos + 2]
          if (ntB && ntB.kind === 'op' && (ntB.value === '=' || ntB.value === ':=')) {
            this.skipType()
            const nameTok = this.next()
            if (this.eatOp(':=')) {
              const e = this.parseExpr()
              return { t: 'assign', name: nameTok.value, e, line }
            }
            this.expectOp('=')
            const blk = this.tryParseValueBlock(nameTok.value, false, line)
            if (blk) return blk
            const e = this.parseExpr()
            return { t: 'declare', name: nameTok.value, isVar: false, e, line }
          }
        }
      }

      // reassignment x := …
      const after = this.toks[this.pos + 1]
      if (after && after.kind === 'op' && after.value === ':=') {
        this.pos += 2
        const e = this.parseExpr()
        return { t: 'assign', name: t.value, e, line }
      }

      // assignment sederhana x = … (deklarasi ulang tiap bar — Pine style)
      if (after && after.kind === 'op' && after.value === '=') {
        this.pos += 2
        // `x = if cond …` / `x = switch …` — nilai blok sebagai ekspresi
        const blk = this.tryParseValueBlock(t.value, false, line)
        if (blk) return blk
        const e = this.parseExpr()
        return { t: 'declare', name: t.value, isVar: false, e, line }
      }

      // x[n] = … → tidak didukung (subset)
      if (after && after.kind === 'op' && after.value === '[') {
        throw new Error(`Baris ${line}: assignment ke riwayat x[n] = … belum didukung Lux subset`)
      }
    }

    // expression statement (plot / alertcondition / dsb.)
    const e = this.parseExpr()
    return { t: 'expr', e, line }
  }

  /** Setelah `name =` — cek blok nilai `if …` / `switch …`. */
  private tryParseValueBlock(name: string, isVar: boolean, line: number): Stmt | null {
    const tk = this.peek()
    if (tk.kind === 'ident' && tk.value === 'if') {
      const st = this.parseIf()
      return { t: 'ifassign', name, isVar, branches: st.branches, line }
    }
    if (tk.kind === 'ident' && tk.value === 'switch') {
      this.pos++
      return this.parseSwitchAssign(name, isVar, line)
    }
    return null
  }

  /** Deteksi `name(params) => …` tanpa mengkonsumsi token. */
  private looksLikeFuncdef(): boolean {
    const save = this.pos
    try {
      this.next() // name
      this.next() // (
      let depth = 1
      while (depth > 0) {
        const tk = this.peek()
        if (tk.kind === 'eof' || tk.kind === 'newline') return false
        if (tk.kind === 'op' && tk.value === '(') depth++
        if (tk.kind === 'op' && tk.value === ')') depth--
        this.pos++
      }
      // setelah tutup kurung harus langsung `=>` pada baris sama
      return this.peek().kind === 'op' && this.peek().value === '=>'
    } finally {
      this.pos = save
    }
  }

  private parseFuncdef(): Stmt {
    const line = this.peek().line
    const name = this.next().value
    this.expectOp('(')
    const params: string[] = []
    while (!this.isOp(')')) {
      // parameter boleh bertipe: f(int a, float b = 3) => …
      const p = this.next()
      if (p.kind !== 'ident') throw new Error(`Baris ${line}: parameter fungsi harus nama`)
      let pname = p.value
      if (TYPE_WORDS.has(p.value)) {
        // tipe param → nama parameter adalah token berikut
        const nm = this.next()
        if (nm.kind !== 'ident') throw new Error(`Baris ${line}: parameter fungsi harus nama`)
        pname = nm.value
      }
      params.push(pname)
      // default value → di-parse lalu dibuang (subset: positional saja)
      if (this.eatOp('=')) this.parseExpr()
      if (!this.eatOp(',')) break
    }
    this.expectOp(')')
    this.expectOp('=>')
    const body = this.parseExpr()
    return { t: 'funcdef', name, params, body, line }
  }

  private parseIf(): Stmt {
    const line = this.peek().line
    this.next() // if
    const branches: IfBranch[] = []
    const cond = this.parseExpr()
    branches.push({ cond, body: this.parseBlock() })
    this.skipNewlines()
    while (this.peek().kind === 'ident' && (this.peek().value === 'else' || this.peek().value === 'elif')) {
      if (this.peek().value === 'elif') {
        this.next()
        const c2 = this.parseExpr()
        branches.push({ cond: c2, body: this.parseBlock() })
      } else {
        // else — cek `else if` (Pine memakai "else" + baris "if")
        const save = this.pos
        this.next()
        this.skipNewlines()
        if (this.peek().kind === 'ident' && this.peek().value === 'if') {
          this.next()
          const c3 = this.parseExpr()
          branches.push({ cond: c3, body: this.parseBlock() })
        } else {
          this.pos = save
          this.next() // else
          branches.push({ cond: null, body: this.parseBlock() })
          break
        }
      }
      this.skipNewlines()
    }
    return { t: 'if', branches, line }
  }

  private parseSwitchAssign(name: string | null, isVar: boolean, line: number): Stmt {
    // sudah melewati kata `switch` (kecuali dipanggil dari parseStatement)
    if (name === null && this.peek().kind === 'ident' && this.peek().value === 'switch') this.pos++
    let subject: Expr | null = null
    if (!this.isOp(':') && this.peek().kind !== 'newline' && this.peek().kind !== 'indent') {
      subject = this.parseExpr()
    }
    this.skipNewlines()
    if (!this.eatIndentIfAny()) {
      throw new Error(`Baris ${line}: body switch harus di-indent`)
    }
    const branches: SwitchBranch[] = []
    this.skipNewlines()
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      // branch: `expr => stmt` | `=> stmt` (default)
      let when: Expr | null = null
      if (!this.isOp('=>')) {
        when = this.parseExpr()
      }
      this.expectOp('=>')
      const body: Stmt[] = []
      this.skipNewlines()
      if (this.eatIndentIfAny()) {
        this.skipNewlines()
        while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
          body.push(this.parseStatement())
          this.skipNewlines()
        }
        this.eatDedentIfAny()
      } else {
        body.push(this.parseStatement())
      }
      branches.push({ when, body })
      this.skipNewlines()
    }
    this.eatDedentIfAny()
    if (name === null) {
      // switch statement murni — nilai dibuang; jalankan sebagai ifassign ke nama tiruan
      return { t: 'switchassign', name: '__lux_switch_discard', isVar: false, subject, branches, line }
    }
    return { t: 'switchassign', name, isVar, subject, branches, line }
  }

  private parseWhile(): Stmt {
    const line = this.peek().line
    this.next() // while
    const cond = this.parseExpr()
    const body = this.parseBlock()
    return { t: 'while', cond, body, line }
  }

  private parseFor(): Stmt {
    const line = this.peek().line
    this.next() // for
    const ivarTok = this.next()
    if (ivarTok.kind !== 'ident') throw new Error(`Baris ${line}: diharapkan nama variabel loop`)
    this.expectOp('=')
    const from = this.parseExpr()
    const toTok = this.next()
    if (toTok.kind !== 'ident' || toTok.value !== 'to') {
      throw new Error(`Baris ${line}: diharapkan "to" di dalam for`)
    }
    const to = this.parseExpr()
    let step = 1
    const byTok = this.peek()
    if (byTok.kind === 'ident' && byTok.value === 'by') {
      this.next()
      const s = this.parseExpr()
      if (s.t !== 'num') throw new Error(`Baris ${line}: step for harus angka literal di subset ini`)
      step = s.v
    }
    const body = this.parseBlock()
    return { t: 'for', ivar: ivarTok.value, from, to, step, body, line }
  }

  /* ---------- Ekspresi (precedence climbing) ---------- */

  parseExpr(): Expr {
    return this.parseTernary()
  }

  /** Argumen pemanggilan — dukung named arg Pine: `title='X'`. */
  private parseCallArg(): Expr {
    const t = this.peek()
    if (t.kind === 'ident') {
      const nt = this.toks[this.pos + 1]
      if (nt && nt.kind === 'op' && nt.value === '=') {
        this.pos += 2
        const e = this.parseExpr()
        return { t: 'namedarg', name: t.value, e }
      }
    }
    return this.parseExpr()
  }

  private parseTernary(): Expr {
    const c = this.parseBinary(0)
    const line = c.line
    if (this.isOp('?')) {
      this.pos++
      const a = this.parseTernary()
      this.expectOp(':')
      const b = this.parseTernary()
      return { t: 'ternary', c, a, b, line }
    }
    return c
  }

  private static LEVELS: string[][] = [
    ['or'],
    ['and'],
    ['==', '!='],
    ['<', '>', '<=', '>='],
    ['+', '-'],
    ['*', '/', '%'],
  ]

  private parseBinary(level: number): Expr {
    if (level >= Parser.LEVELS.length) return this.parseUnary()
    let l = this.parseBinary(level + 1)
    for (;;) {
      const t = this.peek()
      if (t.kind === 'op' && Parser.LEVELS[level].includes(t.value)) {
        this.pos++
        const r = this.parseBinary(level + 1)
        l = { t: 'bin', op: t.value, l, r, line: t.line }
        continue
      }
      // `and` / `or` datang sebagai ident
      if (t.kind === 'ident' && Parser.LEVELS[level].includes(t.value)) {
        this.pos++
        const r = this.parseBinary(level + 1)
        l = { t: 'bin', op: t.value, l, r, line: t.line }
        continue
      }
      return l
    }
  }

  private parseUnary(): Expr {
    const t = this.peek()
    if (t.kind === 'op' && (t.value === '-' || t.value === '+')) {
      this.pos++
      const e = this.parseUnary()
      return t.value === '-' ? { t: 'un', op: '-', e, line: t.line } : e // unary + = passthrough
    }
    if (t.kind === 'ident' && t.value === 'not') {
      this.pos++
      const e = this.parseUnary()
      return { t: 'un', op: 'not', e, line: t.line }
    }
    return this.parsePostfix()
  }

  private parsePostfix(): Expr {
    let base = this.parsePrimary()
    for (;;) {
      if (this.isOp('[')) {
        const openLine = this.peek().line
        this.pos++
        const n = this.parseExpr()
        this.expectOp(']')
        base = { t: 'index', base, n, line: openLine }
        continue
      }
      return base
    }
  }

  private parsePrimary(): Expr {
    const t = this.next()
    if (t.kind === 'num') return { t: 'num', v: Number(t.value) }
    if (t.kind === 'str') return { t: 'str', v: t.value }
    if (t.kind === 'op' && t.value === '(') {
      const e = this.parseExpr()
      this.expectOp(')')
      return e
    }
    if (t.kind === 'op' && t.value === '[') {
      // Array literal Pine: [a, b, c] — dipakai di named arg (input.string
      // options=[…], dsb.). Dievaluasi jadi nilai abstrak (interpreter → na).
      const items: Expr[] = []
      while (!this.isOp(']')) {
        if (this.peek().kind === 'eof') {
          throw new Error(`Baris ${t.line}: array literal tidak ditutup "]"`)
        }
        items.push(this.parseExpr())
        if (!this.eatOp(',')) break
      }
      this.expectOp(']')
      return { t: 'array', items, line: t.line }
    }
    if (t.kind === 'ident') {
      // call? — HARUS dicek sebelum literal: `na(x)` adalah FUNGSI is-na,
      // bukan literal na diikuti kurung (bug lama: sisa token bocor).
      if (this.isOp('(')) {
        this.pos++
        const args: Expr[] = []
        while (!this.isOp(')')) {
          args.push(this.parseCallArg())
          if (!this.eatOp(',')) break
        }
        this.expectOp(')')
        return { t: 'call', name: t.value, args, seq: this.seq++, line: t.line }
      }

      // literal
      if (t.value === 'true') return { t: 'bool', v: true }
      if (t.value === 'false') return { t: 'bool', v: false }
      if (t.value === 'na') return { t: 'na' }

      // member path (ta.sma / math.abs / close)
      if (this.isOp('.')) {
        const path: string[] = [t.value]
        while (this.eatOp('.')) {
          const p = this.next()
          if (p.kind !== 'ident') throw new Error(`Baris ${t.line}: diharapkan nama member`)
          path.push(p.value)
        }
        // call berantai: ta.crossover(x, y) — NAMA penuh dipertahankan
        // (biar konstanta `color.new`, `str.format`, `label.new` jelas).
        if (this.isOp('(')) {
          this.pos++
          const args: Expr[] = []
          while (!this.isOp(')')) {
            args.push(this.parseCallArg())
            if (!this.eatOp(',')) break
          }
          this.expectOp(')')
          return { t: 'call', name: path.join('.'), args, seq: this.seq++, line: t.line }
        }
        const obj = path[0]
        return { t: 'member', obj, path: path.slice(1), line: t.line }
      }

      return { t: 'ident', name: t.value, line: t.line }
    }
    throw new Error(`Baris ${t.line}: token tak terduga "${t.value || t.kind}"`)
  }
}

export function parseLux(src: string): LuxAst {
  return new Parser(src).parseProgram()
}
