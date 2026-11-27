/**
 * ============================================================
 * POST /api/pine-lab/notify-test — TOMBOL UJI NOTIFIKASI
 * ============================================================
 * Permintaan Bos: "tambah tombol notif untuk dipinelab biar saya
 * bisa cek berfungsi ga" — kirim 3 notifikasi TES (ENTRY LONG,
 * SL HIT, TP HIT) ke HP Bos memakai jalur push YANG SAMA PERSIS
 * dengan cron jam-an (pushToUser → notification_log + web push),
 * jadi kalau tombol ini menyala di HP, sinyal beneran juga akan.
 *
 * - Auth & flag: wajib lewat requirePineLab (401/403).
 * - dedupe: false → tombol bisa ditekan berulang tanpa ditelan
 *   dedupe in-memory 90 detik (cron tidak terpengaruh — dedupe
 *   cron tetap di DB pine_events_sent).
 * - Tag berbeda per jenis tes → ketiganya tampil terpisah di
 *   notification tray, tidak saling menimpa.
 * - Urutan dikirim ENTRY → TP HIT → SL HIT dengan jeda kecil,
 *   meniru alur trade nyata, tapi hasil dilaporkan per item.
 * - Hasil per notifikasi: sent / no-subs / error → UI menampilkan
 *   persis mana yang berhasil, plus jumlah device terdaftar.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePineLab } from '@/lib/pine-lab/access'
import { pushToUser } from '@/lib/push-notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface TestItem {
  kind: 'ENTRY' | 'TP' | 'SL'
  title: string
  body: string
  sent: number
  skipped?: 'dedupe' | 'no-subs'
  error?: string
}

export async function POST(request: NextRequest) {
  const gate = await requirePineLab(request)
  if (gate instanceof NextResponse) return gate
  const { user, admin } = gate

  try {
    // Contoh angka realistis XAUUSD H1 — meniru bentuk pesan cron
    // (`[SYM H1] TITLE: message`) persis seperti push sinyal asli.
    const tests: { kind: TestItem['kind']; title: string; body: string; tag: string }[] = [
      {
        kind: 'ENTRY',
        title: 'Lux Lab · Tes Notifikasi',
        body: '[XAUUSD H1] ENTRY LONG: Buy Limit @ 2.650.00 — sinyal tes, bukan sinyal trading.',
        tag: 'pine-lab-test-entry',
      },
      {
        kind: 'TP',
        title: 'Lux Lab · Tes Notifikasi',
        body: '[XAUUSD H1] TP HIT: LONG entry @ 2.650.00 → take profit @ 2.690.00 ✅',
        tag: 'pine-lab-test-tp',
      },
      {
        kind: 'SL',
        title: 'Lux Lab · Tes Notifikasi',
        body: '[XAUUSD H1] SL HIT: LONG entry @ 2.650.00 → stop loss @ 2.620.00',
        tag: 'pine-lab-test-sl',
      },
    ]

    const items: TestItem[] = []

    for (const t of tests) {
      const res = await pushToUser(
        admin,
        user.id,
        {
          title: t.title,
          body: t.body,
          tag: t.tag,
          url: '/pine-lab',
          type: 'pine-lab',
          urgency: 'high', // tes harus menyala SEGERA di layar (bukan ditunda device idle)
        },
        { dedupe: false } // tombol tes boleh ditekan berulang — cron tidak lewat jalur ini
      )
      items.push({
        kind: t.kind,
        title: t.title,
        body: t.body,
        sent: res.sent,
        skipped: res.skipped,
        error: res.error,
      })
      // jeda kecil antar push agar urutan tray rapi (meniru alur trade)
      if (t.kind !== 'SL') await new Promise((r) => setTimeout(r, 250))
    }

    const sentTotal = items.reduce((a, b) => a + b.sent, 0)
    const noSubs = items.every((i) => i.skipped === 'no-subs')
    const maxSent = Math.max(...items.map((i) => i.sent))

    return NextResponse.json({
      ok: sentTotal > 0,
      sentTotal,
      maxSent,
      items,
      noSubs,
      // Pesan siap-tampil untuk UI
      message: noSubs
        ? 'Belum ada HP yang terdaftar untuk push notification. Aktifkan dulu di Dashboard → ikon lonceng (Notifikasi) → izinkan notifikasi, lalu coba tes lagi.'
        : `3 notifikasi tes terkirim ke ${maxSent} device. Cek notification tray HP kamu sekarang.`,
    })
  } catch (e) {
    console.error('[pine-lab/notify-test]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal mengirim notifikasi tes.' },
      { status: 500 }
    )
  }
}
