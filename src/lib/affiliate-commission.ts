/**
 * 💰 UNIFIKASI KOMISI AKTIVASI AFFILIATE — penutup temuan audit E2E
 * "komisi aktivasi dobel jalur + affiliate_referrals tak pernah diisi".
 *
 * DULU (split-brain):
 *   - /api/admin/activate          → komisi hanya ke profiles.affiliate_balance
 *                                    (tabel affiliates TIDAK disentuh — saldo
 *                                    withdraw tidak ikut naik!)
 *   - /api/admin/subscriptions/[id]/activate → komisi ke affiliates.current_balance
 *                                    + profiles.affiliate_balance
 *   - Tidak ada satupun yang menulis affiliate_referrals → daftar referral
 *     di halaman affiliate SELALU kosong.
 *   - Tidak ada dedupe: kalau kedua route dipanggil untuk aktivasi yang sama
 *     (dua tombol dashboard), referrer dibayar 2x.
 *
 * KINI (satu sumber kebenaran, dipakai kedua route):
 *   1. Cari referrer via affiliates.referral_code (fallback: profiles.my_referral_code).
 *   2. LEDGER: insert affiliate_referrals dengan activation_key dedupe
 *      (userId:planType:tanggal-aktivasi). Baris kedua dgn key sama = diblokir
 *      unique index (migrasi 022) → komisi tidak bisa dobel, bahkan saat race.
 *   3. Saldo: affiliates.current_balance/total_earned (sumber withdraw)
 *      + profiles.affiliate_balance/referral_count (sumber dashboard) — DUA-DUANYA.
 *
 * FAIL-OPEN (pola rollback-safe): ledger gagal (tabel/kolom belum ada) →
 *   saldo tetap diupdate seperti perilaku lama; hanya dedupe yang hilang.
 */

import { sendAdminNotification } from '@/lib/admin-notify'

export interface CommissionInput {
  /** User yang membeli/naik PRO (penerima referral). */
  userId: string
  /** Kode plan, mis. PRO_30_DAYS / PRO_LIFETIME / LIFETIME_ULTRA. */
  planType: string
  /** Nama tampilan plan untuk notifikasi, mis. "PRO 30 Hari". */
  planName: string
  /** Harga plan (Rp) sebelum komisi. */
  price: number
  /** Rate komisi, mis. 0.2 (recurring) / 0.15 (lifetime). */
  commissionRate: number
  /** ISO tanggal berakhirnya langganan hasil aktivasi ini (bagian kunci dedupe). */
  subscriptionUntil: string
}

export interface CommissionResult {
  /** true = komisi BENERAN dikredit saat panggilan ini. */
  paid: boolean
  /** 'already_recorded' = aktivasi ini sudah tercatat (dedupe) → dilewati. */
  skipped?: 'already_recorded' | 'no_referrer'
  amount?: number
  /** Ledger affiliate_referrals berhasil ditulis. */
  ledger?: boolean
  /** Referrer ditemukan & disentuh. */
  referrerFound?: boolean
  detail?: string
}

type AdminClient = {
  from: (table: string) => any
}

/** Kunci dedupe per aktivasi: user + plan + tanggal aktivasi (dari subscription_until). */
export function activationKeyOf(input: Pick<CommissionInput, 'userId' | 'planType' | 'subscriptionUntil'>): string {
  return `${input.userId}:${input.planType}:${String(input.subscriptionUntil).slice(0, 10)}`
}

/** PostgREST/supabase-js: apakah error = pelanggaran unique (duplikat)? */
function isDuplicateError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '23505' || /duplicate key|unique constraint/i.test(err.message || '')
}

/** Apakah error = tabel/kolom belum ada (migrasi belum jalan)? */
function isSchemaError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  const c = err.code || ''
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(c) ||
    /does not exist|could not find the table|column.*found/i.test(err.message || '')
}

export async function applyActivationCommission(
  admin: AdminClient,
  input: CommissionInput,
): Promise<CommissionResult> {
  const amount = Math.round((input.price || 0) * (input.commissionRate || 0))
  const base: CommissionResult = { paid: false, amount }

  try {
    // ── 1. Kode referral pembeli ──
    const { data: buyer } = await admin.from('profiles')
      .select('referred_by_code, full_name, email')
      .eq('id', input.userId)
      .single()
    const code = String(buyer?.referred_by_code || '').trim()
    if (!code) return { ...base, skipped: 'no_referrer', detail: 'pembeli tanpa referred_by_code' }

    // ── 2. Referrer via tabel affiliates (sumber withdraw) ──
    const { data: affiliate } = await admin.from('affiliates')
      .select('id, user_id, referral_code, current_balance, total_earned')
      .eq('referral_code', code)
      .maybeSingle()

    if (affiliate?.id) {
      const key = activationKeyOf(input)

      // ── 3. LEDGER + dedupe ──
      // Cek dulu (hemat): kalau sudah ada → aktivasi ini sudah dibayar.
      try {
        const { data: existing } = await admin.from('affiliate_referrals')
          .select('id')
          .eq('activation_key', key)
          .limit(1)
        if (existing && existing.length > 0) {
          return { ...base, skipped: 'already_recorded', referrerFound: true, detail: 'aktivasi sudah tercatat di ledger — komisi dilewati' }
        }
      } catch (lookupErr: any) {
        // Kolom activation_key belum ada (migrasi 022 belum jalan) → lanjut, fail-open.
        if (!isSchemaError(lookupErr)) console.warn('[affiliate-commission] ledger lookup warn:', lookupErr?.message)
      }

      let ledgerOk = false
      try {
        const ins = await admin.from('affiliate_referrals')
          .insert({
            affiliate_id: affiliate.id,
            referred_user_id: input.userId,
            subscription_type: input.planType,
            commission_amount: amount,
            status: 'approved',
            activation_key: key,
          })
        if (ins.error) {
          if (isDuplicateError(ins.error)) {
            // Race dengan jalur lain → komisi sudah dibayar, stop di sini.
            return { ...base, skipped: 'already_recorded', referrerFound: true, detail: 'ledger race — komisi dilewati (unique index)' }
          }
          if (isSchemaError(ins.error)) {
            // Tabel/kolom belum siap → coba tanpa activation_key (ledger polos).
            try {
              const ins2 = await admin.from('affiliate_referrals')
                .insert({
                  affiliate_id: affiliate.id,
                  referred_user_id: input.userId,
                  subscription_type: input.planType,
                  commission_amount: amount,
                  status: 'approved',
                })
              ledgerOk = !ins2.error
            } catch { ledgerOk = false }
          } else {
            console.warn('[affiliate-commission] ledger insert warn:', ins.error.message)
          }
        } else {
          ledgerOk = true
        }
      } catch (ledgerErr: any) {
        console.warn('[affiliate-commission] ledger insert error (fail-open):', ledgerErr?.message)
      }

      // ── 4. Saldo affiliates (sumber withdraw) ──
      const newBalance = (affiliate.current_balance || 0) + amount
      const newTotalEarned = (affiliate.total_earned || 0) + amount
      const { error: affErr } = await admin.from('affiliates')
        .update({ current_balance: newBalance, total_earned: newTotalEarned })
        .eq('id', affiliate.id)
      if (affErr) {
        console.error('[affiliate-commission] affiliates balance update FAILED:', affErr.message)
        return { ...base, referrerFound: true, ledger: ledgerOk, detail: `gagal update saldo affiliates: ${affErr.message}` }
      }

      // ── 5. Saldo dashboard referrer (profiles) ──
      let profileOk = true
      if (affiliate.user_id) {
        const { data: refProfile } = await admin.from('profiles')
          .select('affiliate_balance, referral_count')
          .eq('id', affiliate.user_id)
          .single()
        if (refProfile) {
          const { error: profErr } = await admin.from('profiles')
            .update({
              affiliate_balance: (refProfile.affiliate_balance || 0) + amount,
              referral_count: (refProfile.referral_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', affiliate.user_id)
          profileOk = !profErr
          if (profErr) console.warn('[affiliate-commission] profiles balance update warn:', profErr.message)
        }
      }

      // ── 6. Notifikasi admin (best-effort) ──
      try {
        await sendAdminNotification(
          `💰 <b>KOMISI AKTIVASI</b>\n\n🎯 Referral: ${buyer?.full_name || buyer?.email || input.userId}\n💎 Plan: ${input.planName}\n💰 Komisi: Rp${amount.toLocaleString('id-ID')}\n📊 Saldo affiliate: Rp${newBalance.toLocaleString('id-ID')}${ledgerOk ? '\n📒 Ledger: tercatat' : '\n📒 Ledger: GAGAL (cek log)'}`
        )
      } catch { /* non-blocking */ }

      return {
        paid: true,
        amount,
        ledger: ledgerOk,
        referrerFound: true,
        detail: `komisi Rp${amount.toLocaleString('id-ID')} → affiliate ${affiliate.referral_code}${profileOk ? '' : ' (update profiles gagal)'}`,
      }
    }

    // ── FALLBACK (perilaku lama jalur /api/admin/activate): referrer belum
    //    punya baris affiliates → update profiles saja. Tidak ada ledger
    //    (affiliate_id wajib) → dedupe tidak tersedia untuk kasus ini.
    const { data: refProfile } = await admin.from('profiles')
      .select('id, affiliate_balance, referral_count')
      .eq('my_referral_code', code)
      .maybeSingle()

    if (!refProfile?.id) {
      return { ...base, skipped: 'no_referrer', detail: `tidak ada affiliate/profile dgn kode "${code}"` }
    }

    const newBal = (refProfile.affiliate_balance || 0) + amount
    const { error: upErr } = await admin.from('profiles')
      .update({
        affiliate_balance: newBal,
        referral_count: (refProfile.referral_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', refProfile.id)
    if (upErr) {
      return { ...base, referrerFound: true, detail: `gagal update saldo profiles: ${upErr.message}` }
    }

    try {
      await sendAdminNotification(
        `💰 <b>KOMISI AKTIVASI (fallback profiles)</b>\n\n🎯 Referral: ${buyer?.full_name || buyer?.email || input.userId}\n💎 Plan: ${input.planName}\n💰 Komisi: Rp${amount.toLocaleString('id-ID')}\n📊 Saldo: Rp${newBal.toLocaleString('id-ID')}\n⚠️ Referrer belum punya baris affiliates — buatkan agar saldo withdraw ikut terisi.`
      )
    } catch { /* non-blocking */ }

    return { paid: true, amount, ledger: false, referrerFound: true, detail: 'fallback profiles (referrer tanpa baris affiliates)' }
  } catch (err: any) {
    console.error('[affiliate-commission] unexpected error (fail-open, tanpa komisi):', err?.message || err)
    return { ...base, detail: `error: ${String(err?.message || err).slice(0, 140)}` }
  }
}
