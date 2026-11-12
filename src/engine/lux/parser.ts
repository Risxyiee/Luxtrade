/**
 * ============================================================
 * LUX ENGINE — parser.ts
 * ============================================================
 * Parser subset Lux Script → AST. Membaca token dari tokenizer.
 * Fitur: deklarasi variabel (var / plain), reassignment (:=),
 * if/else if/else, for (bounded), definisi fungsi satu-ekspresi
 * (f(a, b) => expr), pemanggilan, indexing history x[n], ternary.
 * ============================================================
 */

import { tokenize, type Token } from './tokenizer'

/* ---------- AST ---------- */

export type Expr =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'na' }
  | { t: 'ident'; name: string }
  | { t: 'member'; obj: string; path: string[] }
  | { t: 'index'; base: Expr; n: Expr }
  | { t: 'un'; op: '-' | 'not'; e: Expr }
  | { t: 'bin'; op: string; l: Expr; r: Expr }
  | { t: 'ternary'; c: Expr; a: Expr; b: Expr }
  | { t: 'call'; name: string; args: Expr[]; seq: number }
  | { t: 'namedarg'; name: string; e: Expr }

export type Stmt =
  | { t: 'expr'; e: Expr; line: number }
  | { t: 'declare'; name: string; isVar: boolean; e: Expr; line: number }
  | { t: 'assign'; name: string; e: Expr; line: number }
  | { t: 'declareSeries'; name: string; isVar: boolean; e: Expr; line: number } // x[n] = … jarang; tidak didukung
  | { t: 'if'; branches: { cond: Expr | null; body: Stmt[] }[]; line: number }
  | { t: 'for'; ivar: string; from: Expr; to: Expr; step: number; body: Stmt[]; line: number }
  | { t: 'funcdef'; name: string; params: string[]; body: Expr; line: number }
  | { t: 'header'; kind: 'indicator' | 'strategy'; name: string; line: number }

export interface LuxAst {
  header: Stmt | null
  body: Stmt[]
}

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

  /** Apakah token ident berikutnya memulai statement? (vs lanjutan ekspresi) */
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

    // `var x = expr` / `x = expr` / `x := expr` / `x[n] = …` (tolak)
    if (t.kind === 'ident') {
      // funcdef: name(params) => expr — nt2 boleh ')' (0 param) atau ident
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

      // var
      if (t.value === 'var' || t.value === 'varip') {
        this.pos++
        const nameTok = this.next()
        if (nameTok.kind !== 'ident') throw new Error(`Baris ${line}: diharapkan nama variabel setelah var`)
        if (this.isOp(':=')) {
          this.pos++
          const e = this.parseExpr()
          return { t: 'assign', name: nameTok.value, e, line }
        }
        this.expectOp('=')
        const e = this.parseExpr()
        return { t: 'declare', name: nameTok.value, isVar: true, e, line }
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
        const e = this.parseExpr()
        return { t: 'declare', name: t.value, isVar: false, e, line }
      }

      // x[n] = … → tidak didukung (subset)
      if (after && after.kind === 'op' && after.value === '[') {
        throw new Error(`Baris ${line}: assignment ke riwayat x[n] = … belum didukung Lux subset`)
      }
    }

    // if / else if / else
    if (t.kind === 'ident' && t.value === 'if') return this.parseIf()

    // for i = a to b [by s]
    if (t.kind === 'ident' && t.value === 'for') return this.parseFor()

    // expression statement (plot / alertcondition / dsb.)
    const e = this.parseExpr()
    return { t: 'expr', e, line }
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
      const p = this.next()
      if (p.kind !== 'ident') throw new Error(`Baris ${line}: parameter fungsi harus nama`)
      params.push(p.value)
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
    const branches: { cond: Expr | null; body: Stmt[] }[] = []
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
    if (this.isOp('?')) {
      this.pos++
      const a = this.parseTernary()
      this.expectOp(':')
      const b = this.parseTernary()
      return { t: 'ternary', c, a, b }
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
        l = { t: 'bin', op: t.value, l, r }
        continue
      }
      // `and` / `or` datang sebagai ident
      if (t.kind === 'ident' && Parser.LEVELS[level].includes(t.value)) {
        this.pos++
        const r = this.parseBinary(level + 1)
        l = { t: 'bin', op: t.value, l, r }
        continue
      }
      return l
    }
  }

  private parseUnary(): Expr {
    const t = this.peek()
    if (t.kind === 'op' && t.value === '-') {
      this.pos++
      return { t: 'un', op: '-', e: this.parseUnary() }
    }
    if (t.kind === 'ident' && t.value === 'not') {
      this.pos++
      return { t: 'un', op: 'not', e: this.parseUnary() }
    }
    return this.parsePostfix()
  }

  private parsePostfix(): Expr {
    let base = this.parsePrimary()
    for (;;) {
      if (this.isOp('[')) {
        this.pos++
        const n = this.parseExpr()
        this.expectOp(']')
        base = { t: 'index', base, n }
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
    if (t.kind === 'ident') {
      // literal
      if (t.value === 'true') return { t: 'bool', v: true }
      if (t.value === 'false') return { t: 'bool', v: false }
      if (t.value === 'na') return { t: 'na' }

      // call?
      if (this.isOp('(')) {
        this.pos++
        const args: Expr[] = []
        while (!this.isOp(')')) {
          args.push(this.parseCallArg())
          if (!this.eatOp(',')) break
        }
        this.expectOp(')')
        return { t: 'call', name: t.value, args, seq: this.seq++ }
      }

      // member path (ta.sma / math.abs / close)
      if (this.isOp('.')) {
        const path: string[] = [t.value]
        while (this.eatOp('.')) {
          const p = this.next()
          if (p.kind !== 'ident') throw new Error(`Baris ${t.line}: diharapkan nama member`)
          path.push(p.value)
        }
        const leaf = path[path.length - 1]
        // call berantai: ta.crossover(x, y)
        if (this.isOp('(')) {
          this.pos++
          const args: Expr[] = []
          while (!this.isOp(')')) {
            args.push(this.parseCallArg())
            if (!this.eatOp(',')) break
          }
          this.expectOp(')')
          return { t: 'call', name: leaf, args, seq: this.seq++ }
        }
        const obj = path[0]
        return { t: 'member', obj, path: path.slice(1) }
      }

      return { t: 'ident', name: t.value }
    }
    throw new Error(`Baris ${t.line}: token tak terduga "${t.value || t.kind}"`)
  }
}

export function parseLux(src: string): LuxAst {
  return new Parser(src).parseProgram()
}
