/**
 * ============================================================
 * LUX ENGINE — tokenizer.ts
 * ============================================================
 * Lexer subset Lux Script. Baris signifikan (statement dipisah
 * newline) — sama seperti Pine. Komentar `//` sampai akhir baris.
 * Indentasi: dipakai untuk blok if/for/while/switch (4 spasi = 1
 * level; tab = 4).
 *
 * LINE CONTINUATION (fix umum script TradingView): selama ada
 * kurung `( [ ` yang belum ditutup, baris dianggap kelanjutan
 * statement yang sama — newline & indentasi TIDAK di-emit. Ini
 * menangani call multi-baris ala formatter TradingView:
 *   plot(
 *       emaFast,
 *       title='X')
 * ============================================================
 */

export type TokKind =
  | 'num'
  | 'str'
  | 'ident'
  | 'op'
  | 'newline'
  | 'indent'
  | 'dedent'
  | 'eof'

export interface Token {
  kind: TokKind
  value: string
  /** Baris 1-based (diag error). */
  line: number
  /** Nomor call-site untuk built-in series (state per call-site). */
  seq: number
}

const OPERATORS = [
  // 2-char dulu (urutan penting: '=>' HARUS sebelum '=', ':=' sebelum '=', dst.)
  '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', ':=', '=>', '||', '&&',
  '+', '-', '*', '/', '%', '<', '>', '=', '?', ':', '|', '&',
  '(', ')', '[', ']', ',',
]

const IDENT_START = /[A-Za-z_]/
const IDENT_PART = /[A-Za-z0-9_.]/

export function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  const lines = src.replace(/\r\n?/g, '\n').split('\n')

  /** Stack indentasi (kolom 0-based). Level 0 selalu ada. */
  const indents: number[] = [0]
  let seq = 0

  /** Kedalaman kurung antar-baris (line continuation Pine/TradingView). */
  let parenDepth = 0

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li]
    const line = raw.replace(/\t/g, '    ')

    // Baris kosong / komentar murni → lewati (tidak memengaruhi indentasi)
    if (!line.trim() || line.trim().startsWith('//')) continue

    // Hitung indentasi — DI-SKIP saat sedang lanjutan call multi-baris
    let col = 0
    while (col < line.length && line[col] === ' ') col++
    const content = line.slice(col)
    if (content.startsWith('//') && parenDepth === 0) continue
    if (content.startsWith('//')) continue // komentar dalam continuation juga diabaikan

    if (parenDepth === 0) {
      if (col > indents[indents.length - 1]) {
        indents.push(col)
        tokens.push({ kind: 'indent', value: '', line: li + 1, seq: seq++ })
      } else {
        while (col < indents[indents.length - 1]) {
          indents.pop()
          tokens.push({ kind: 'dedent', value: '', line: li + 1, seq: seq++ })
        }
        if (col !== indents[indents.length - 1]) {
          throw new Error(`Baris ${li + 1}: indentasi tidak konsisten`)
        }
      }
    }

    // Tokenize isi baris
    let i = 0
    while (i < content.length) {
      const ch = content[i]

      if (ch === ' ') { i++; continue }

      // Komentar sampai akhir baris
      if (ch === '/' && content[i + 1] === '/') break

      if (ch >= '0' && ch <= '9') {
        let j = i
        while (j < content.length && /[0-9.eE]/.test(content[j])) {
          // hindari menelan `.` dari akses member (1.x jarang; aman utk angka desimal)
          if (content[j] === '.' && !/[0-9]/.test(content[j + 1] ?? '')) break
          j++
        }
        tokens.push({ kind: 'num', value: content.slice(i, j), line: li + 1, seq: seq++ })
        i = j
        continue
      }

      if (ch === '"' || ch === "'") {
        let j = i + 1
        let out = ''
        while (j < content.length && content[j] !== ch) {
          if (content[j] === '\\' && j + 1 < content.length) {
            out += content[j + 1]
            j += 2
            continue
          }
          out += content[j]
          j++
        }
        if (j >= content.length) throw new Error(`Baris ${li + 1}: string tidak ditutup`)
        tokens.push({ kind: 'str', value: out, line: li + 1, seq: seq++ })
        i = j + 1
        continue
      }

      if (IDENT_START.test(ch)) {
        let j = i
        while (j < content.length && IDENT_PART.test(content[j])) j++
        tokens.push({ kind: 'ident', value: content.slice(i, j), line: li + 1, seq: seq++ })
        i = j
        continue
      }

      const op = OPERATORS.find((o) => content.startsWith(o, i))
      if (op) {
        // Lacak kedalaman kurung untuk line continuation
        if (op === '(' || op === '[') parenDepth++
        if (op === ')' || op === ']') parenDepth = Math.max(0, parenDepth - 1)
        // Toleransi gaya trader dari bahasa lain: `||` → or, `&&` → and.
        // Pine memakai kata `or`/`and` — dinormalisasi DI SINI supaya parser
        // sederhana dan error tidak jadi "token tak terduga '|'".
        const norm = op === '||' || op === '|' ? 'or' : op === '&&' || op === '&' ? 'and' : op
        tokens.push({ kind: 'op', value: norm, line: li + 1, seq: seq++ })
        i += op.length
        continue
      }

      throw new Error(`Baris ${li + 1}: karakter tak dikenal "${ch}" — kalau ini di dalam komentar, pastikan baris diawali //`)
    }

    // Lanjutan baris: kurung masih terbuka → JANGAN kirim newline
    if (parenDepth > 0) continue
    tokens.push({ kind: 'newline', value: '', line: li + 1, seq: seq++ })
  }

  // Tutup indentasi tersisa
  while (indents.length > 1) {
    indents.pop()
    tokens.push({ kind: 'dedent', value: '', line: lines.length, seq: seq++ })
  }

  tokens.push({ kind: 'eof', value: '', line: lines.length, seq: seq++ })
  return tokens
}
