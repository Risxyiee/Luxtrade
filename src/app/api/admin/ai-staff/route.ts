import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getCronAdmin, isMissingTableError } from '@/lib/cron-supabase'
import { sendEmail, getPromotionalEmailHtml } from '@/lib/email'
import { sendTelegramNotification } from '@/lib/telegram'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * API Approval untuk AI Staff (Human-in-the-Loop)
 * Dipakai oleh dashboard admin /admin/ai-staff.
 *
 * GET  → daftar task status 'pending' (semua agent)
 * POST → { taskId, action: 'approve' | 'reject', edited?: { subject, body } }
 *        - approve + agent CS        → kirim email asli via Resend ke user
 *        - approve + agent MARKETING → tandai selesai (konten siap dipakai)
 *        - reject                    → tandai rejected (keluar dari antrean)
 *
 * Auth: requireAdmin (session Supabase + ADMIN_EMAILS / profiles.role)
 */

export const dynamic = 'force-dynamic'

interface PendingTask {
  id: string
  agent_type: 'CS' | 'MARKETING'
  target_user_id: string | null
  context_data: {
    email?: string
    fullName?: string
    totalTrades?: number
    joinedAt?: string
    audienceSnapshot?: Record<string, unknown>
    generatedForDate?: string
  }
  generated_content: {
    subject?: string
    body?: string
    analysis?: string
    ideas?: Array<{ hook: string; script: string; caption: string; cta: string }>
    provider?: string
    model?: string
    generatedAt?: string
  }
  status: string
  created_at: string
}

/** Plain text body dari AI → HTML paragraf rapi untuk email. */
function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(par => `<p style="margin: 0 0 14px;">${par.replace(/\n/g, '<br />')}</p>`)
    .join('')
}

async function listPending(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('ai_pending_tasks')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({
        success: false,
        error: 'Tabel ai_pending_tasks belum ada — jalankan supabase-migrations/011_create_ai_pending_tasks.sql',
        tasks: [],
        counts: { cs: 0, marketing: 0 },
      }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const tasks = (data || []) as unknown as PendingTask[]
  return NextResponse.json({
    success: true,
    tasks,
    counts: {
      cs: tasks.filter(t => t.agent_type === 'CS').length,
      marketing: tasks.filter(t => t.agent_type === 'MARKETING').length,
    },
  })
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authError

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 })
  }
  return listPending(admin)
}

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireAdmin(request)
  if (authError) return authError

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { taskId, action, edited } = body as {
      taskId?: string
      action?: 'approve' | 'reject'
      edited?: { subject?: string; body?: string }
    }

    if (!taskId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'taskId dan action (approve/reject) wajib diisi' }, { status: 400 })
    }

    // Ambil task — harus masih pending (idempotensi: tidak bisa diproses 2x)
    const { data: taskData, error: fetchErr } = await admin
      .from('ai_pending_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (fetchErr || !taskData) {
      return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 })
    }

    const task = taskData as unknown as PendingTask
    if (task.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Task sudah diproses sebelumnya (status: ${task.status})` },
        { status: 409 }
      )
    }

    // ─── REJECT ────────────────────────────────────────────────────────────
    if (action === 'reject') {
      const { error: updErr } = await admin
        .from('ai_pending_tasks')
        .update({ status: 'rejected', updated_at: new Date().toISOString(), executed_at: new Date().toISOString(), executed_result: { rejectedBy: user?.email || 'admin' } })
        .eq('id', taskId)

      if (updErr) {
        return NextResponse.json({ success: false, error: 'Gagal reject: ' + updErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, message: 'Draf ditolak & dikeluarkan dari antrean' })
    }

    // ─── APPROVE ───────────────────────────────────────────────────────────
    if (task.agent_type === 'CS') {
      // Kirim email asli via Resend dengan konten yang mungkin sudah diedit admin
      const to = task.context_data?.email
      if (!to) {
        return NextResponse.json({ success: false, error: 'Email user tidak ditemukan di context_data' }, { status: 400 })
      }

      const subject = (edited?.subject || task.generated_content?.subject || 'Coba journaling di Luxtradee').trim()
      const bodyText = (edited?.body || task.generated_content?.body || '').trim()
      if (!bodyText) {
        return NextResponse.json({ success: false, error: 'Body email kosong — tidak ada yang bisa dikirim' }, { status: 400 })
      }

      const recipientName = (task.context_data?.fullName || to.split('@')[0] || 'Trader').split(' ')[0]
      const html = getPromotionalEmailHtml(recipientName, subject, plainTextToHtml(bodyText))

      const result = await sendEmail({
        to,
        subject,
        html,
        replyTo: 'luxtradee@gmail.com',
      })

      if (!result.success) {
        // Email gagal → task TETAP pending supaya admin bisa retry
        return NextResponse.json(
          { success: false, error: 'Gagal kirim email: ' + (result.error || 'unknown') + ' (task tetap pending, silakan retry)' },
          { status: 500 }
        )
      }

      const { error: updErr } = await admin
        .from('ai_pending_tasks')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString(),
          executed_at: new Date().toISOString(),
          // Simpan konten final yang benar-benar terkirim (jika admin mengedit)
          generated_content: { ...task.generated_content, subject, body: bodyText, finalSent: true },
          executed_result: { sentTo: to, subject, sentBy: user?.email || 'admin', resentEmailId: (result as { id?: string }).id || null },
        })
        .eq('id', taskId)

      if (updErr) {
        console.error('[admin/ai-staff] Email TERKIRIM tapi gagal update status:', updErr.message)
        return NextResponse.json({ success: true, message: 'Email terkirim, tapi gagal update status task: ' + updErr.message, emailSent: true, statusUpdateFailed: true })
      }

      await sendTelegramNotification(
        `✅ <b>AI CS Agent</b>\n\n📧 Email follow-up DIKIRIM ke <code>${to}</code>\nSubjek: "${subject}"\nDisetujui oleh: ${user?.email || 'admin'}`
      )

      return NextResponse.json({ success: true, message: `Email terkirim ke ${to}`, emailSent: true })
    }

    // MARKETING: tandai selesai (konten siap diproduksi admin)
    const { error: updErrMkt } = await admin
      .from('ai_pending_tasks')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        executed_result: { note: 'Konten disetujui & siap diproduksi', approvedBy: user?.email || 'admin' },
      })
      .eq('id', taskId)

    if (updErrMkt) {
      return NextResponse.json({ success: false, error: 'Gagal approve: ' + updErrMkt.message }, { status: 500 })
    }

    await sendTelegramNotification(`✅ <b>AI Marketing Agent</b>\n\n🎬 Konten TikTok DISETUJUI oleh ${user?.email || 'admin'} — siap diproduksi`)

    return NextResponse.json({ success: true, message: 'Konten disetujui — siap diproduksi!' })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[admin/ai-staff] Error:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
