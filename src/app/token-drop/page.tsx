'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Status = 'idle' | 'loading' | 'ok' | 'fail'

const PR_URL = 'https://github.com/Risxyiee/Luxtrade/pull/2'

export default function TokenDropPage() {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [msg, setMsg] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')
    setMsg('')
    try {
      const res = await fetch('/api/gh-token-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await res.json()) as { ok?: boolean; detail?: string; error?: string }
      if (data.ok) {
        setStatus('ok')
        setMsg(data.detail || 'Push berhasil.')
      } else {
        setStatus('fail')
        setMsg(data.error || 'Gagal tanpa pesan.')
      }
    } catch {
      setStatus('fail')
      setMsg('Tidak bisa menghubungi server. Muat ulang halaman lalu coba lagi.')
    } finally {
      setToken('')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-start sm:items-center justify-center p-4">
      <Card className="w-full max-w-xl bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <span aria-hidden>🔒</span> Kirim Token GitHub — Tanpa Chat
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Token Anda <strong className="text-zinc-200">tidak masuk chat</strong>, tidak disimpan ke
            file, dan hanya hidup sebentar di memori server selama proses push, lalu hilang.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Apa yang akan dilakukan */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm space-y-1.5">
            <p className="font-semibold text-zinc-200">Yang akan dilakukan (hanya ini):</p>
            <ul className="list-disc list-inside text-zinc-400 space-y-1">
              <li>
                Push <strong className="text-zinc-300">1 commit</strong>{' '}
                <code className="text-xs bg-zinc-900 px-1 rounded">7580fce6</code> (perbaikan
                script regresi v2) ke branch{' '}
                <code className="text-xs bg-zinc-900 px-1 rounded">security/p0-hardening</code>
              </li>
              <li>
                Tanpa <code className="text-xs">--force</code>, tanpa merge,{' '}
                <strong className="text-zinc-300">tidak menyentuh main</strong>, tidak deploy
              </li>
              <li>
                Jika branch sudah bergerak (mis. Anda sudah upload manual), push otomatis{' '}
                <strong className="text-zinc-300">dibatalkan</strong>
              </li>
            </ul>
          </div>

          {/* Cara membuat token yang aman */}
          <details className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm">
            <summary className="cursor-pointer font-semibold text-zinc-200">
              Cara membuat token yang aman (klik untuk buka)
            </summary>
            <ol className="list-decimal list-inside text-zinc-400 space-y-1.5 mt-3">
              <li>GitHub → foto profil → <strong className="text-zinc-300">Settings</strong></li>
              <li>
                Paling bawah: <strong className="text-zinc-300">Developer settings</strong>
              </li>
              <li>
                <strong className="text-zinc-300">Personal access tokens → Fine-grained tokens →
                Generate new token</strong>
              </li>
              <li>
                Expiration: <strong className="text-zinc-300">7 hari</strong>
              </li>
              <li>
                Repository access:{' '}
                <strong className="text-zinc-300">Only select repositories</strong> → pilih{' '}
                <strong className="text-zinc-300">Luxtrade</strong> saja
              </li>
              <li>
                Permissions → Repository permissions →{' '}
                <strong className="text-zinc-300">Contents: Read and write</strong> (yang lain
                biarkan <em>No access</em>)
              </li>
              <li>
                Generate → salin token (diawali{' '}
                <code className="text-xs bg-zinc-900 px-1 rounded">github_pat_…</code>) → tempel di
                bawah
              </li>
            </ol>
          </details>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
            <label htmlFor="gh-token" className="sr-only">
              Token GitHub
            </label>
            <Input
              id="gh-token"
              type="password"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Tempel token di sini (github_pat_… atau ghp_…)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
              required
              minLength={20}
            />
            <Button
              type="submit"
              disabled={status === 'loading' || token.trim().length < 20}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              {status === 'loading' ? 'Sedang push… (±beberapa detik)' : 'Kirim & Push Sekarang'}
            </Button>
          </form>

          {/* Hasil */}
          {status === 'ok' && (
            <Alert className="border-emerald-700 bg-emerald-950/60 text-emerald-200">
              <AlertDescription>
                <p className="font-semibold">✅ Push berhasil!</p>
                <pre className="mt-2 text-xs whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                  {msg}
                </pre>
                <p className="mt-2 font-semibold text-emerald-100">
                  ⚠️ Sekarang cabut token Anda:{' '}
                  <span className="font-normal">
                    GitHub → Settings → Developer settings → Fine-grained tokens → Delete
                  </span>
                </p>
                <p className="mt-2">
                  Cek hasilnya di{' '}
                  <a href={PR_URL} target="_blank" rel="noreferrer" className="underline">
                    PR #2
                  </a>{' '}
                  — harus tertulis &ldquo;2 commits&rdquo;. Lalu kabari assistant untuk verifikasi
                  akhir.
                </p>
              </AlertDescription>
            </Alert>
          )}
          {status === 'fail' && (
            <Alert className="border-rose-800 bg-rose-950/60 text-rose-200">
              <AlertDescription>
                <p className="font-semibold">❌ Push gagal — tidak ada yang berubah di GitHub.</p>
                <pre className="mt-2 text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                  {msg}
                </pre>
                <p className="mt-2 text-xs text-rose-300/90">
                  Penyebab paling umum: scope token belum <em>Contents: Read and write</em>, atau
                  token sudah kedaluwarsa. Kalau ragu, cabut token itu di GitHub dan buat baru.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Rencana B */}
          <p className="text-xs text-zinc-500">
            Alternatif tanpa token: unduh{' '}
            <a href="/regression-p0-routes-v2.mjs" className="underline hover:text-zinc-300">
              regression-p0-routes-v2.mjs
            </a>{' '}
            lalu upload manual lewat website GitHub ke branch{' '}
            <code>security/p0-hardening</code>, atau unduh{' '}
            <a href="/perbaikan-tes-pr2.patch" className="underline hover:text-zinc-300">
              perbaikan-tes-pr2.patch
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
