import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// ===== Konstanta push (HARDCODED — endpoint ini hanya bisa melakukan SATU hal) =====
const COMMIT_SHA = '7580fce6fbfbdeaad61a5440160170e29e62a98f'
const PARENT_SHA = 'e32934aa7e12ccc7156b73435d0be05b10558fcf'
const BRANCH = 'security/p0-hardening'
const REPO_URL = 'https://github.com/Risxyiee/Luxtrade.git'

function sanitize(text: string, token: string): string {
  return text.split(token).join('***')
}

export async function POST(request: Request) {
  // 0) Ambil token dari body — hanya di memori request ini, tidak pernah ditulis ke disk/log
  let token = ''
  try {
    const body = (await request.json()) as { token?: unknown }
    token = typeof body.token === 'string' ? body.token.trim() : ''
  } catch {
    return NextResponse.json({ ok: false, error: 'Body tidak valid.' }, { status: 400 })
  }

  if (token.length < 20) {
    return NextResponse.json(
      { ok: false, error: 'Token tidak terlihat valid (terlalu pendek).' },
      { status: 400 }
    )
  }

  try {
    // 1) Pemeriksaan tanpa auth: pastikan branch PR masih di posisi yang diharapkan
    const ls = await execFileAsync('git', ['ls-remote', REPO_URL, `refs/heads/${BRANCH}`], {
      timeout: 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    const remoteHead = ls.stdout.trim().split(/\s+/)[0] || ''

    if (remoteHead && remoteHead !== PARENT_SHA) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Branch ${BRANCH} di GitHub sudah bergerak dari ${PARENT_SHA.slice(0, 8)} ` +
            `(sekarang ${remoteHead.slice(0, 8)}). Kemungkinan perbaikan sudah masuk lewat cara lain, ` +
            'jadi TIDAK ADA yang di-push. Tidak ada yang berubah. Kabari assistant untuk verifikasi PR.',
        },
        { status: 409 }
      )
    }

    // 2) Push fast-forward murni: commit perbaikan -> branch PR. Tanpa --force, tidak menyentuh main.
    const authedUrl = `https://x-access-token:${token}@github.com/Risxyiee/Luxtrade.git`
    const { stdout, stderr } = await execFileAsync(
      'git',
      ['-c', 'credential.helper=', 'push', authedUrl, `${COMMIT_SHA}:refs/heads/${BRANCH}`],
      { timeout: 90_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }
    )

    const detail = sanitize(`${stdout}\n${stderr}`.trim(), token)
    return NextResponse.json({ ok: true, detail: detail.slice(-600) })
  } catch (error) {
    const e = error as { stderr?: string; stdout?: string; message?: string }
    const raw = `${e.stderr || ''}\n${e.stdout || ''}\n${e.message || ''}`.trim()
    return NextResponse.json(
      { ok: false, error: sanitize(raw, token).slice(-800) || 'Push gagal tanpa pesan error.' },
      { status: 400 }
    )
  }
}
