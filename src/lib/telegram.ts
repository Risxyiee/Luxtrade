/**
 * Notification helpers — now delivered via Discord webhook (see ./discord.ts).
 *
 * History: these used to call the Telegram Bot API with a hardcoded bot token.
 * The token was revoked → every call returned "Unauthorized" (5x errors in CF
 * Workers logs). Migrated to a Discord webhook which only needs
 * DISCORD_WEBHOOK_URL. Function names kept for backward compatibility with
 * existing call sites (admin/ai-staff, cron/ai-cs-agent, cron/ai-marketing-agent).
 */

import { sendDiscordNotification } from '@/lib/discord'

/**
 * Send an admin notification (Discord webhook).
 * Kept the old name `sendTelegramNotification` so call sites don't change.
 */
export async function sendTelegramNotification(message: string) {
  return sendDiscordNotification(message)
}

/**
 * Kirim pesan langsung ke admin (Discord webhook).
 * Kept the old name `sendToAdmin` so call sites don't change.
 */
export async function sendToAdmin(message: string) {
  return sendDiscordNotification(message)
}

export async function notifyReferralSignup(referrerName: string, refereeEmail: string, referralCode: string) {
  const msg = `🎉 <b>REFERRAL BARU!</b>\n\n👤 Referrer: ${referrerName}\n📧 Downline: ${refereeEmail}\n🏷️ Kode: <code>${referralCode}</code>\n\n⏰ ${new Date().toLocaleString('id-ID')}`
  return sendTelegramNotification(msg)
}

export async function notifyCommissionEarned(referrerName: string, refereeEmail: string, amount: number) {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
  const msg = `💰 <b>KOMISI AFILIASI MASUK!</b>\n\n👤 Affiliate: ${referrerName}\n📧 Dari: ${refereeEmail}\n💵 Komisi: <b>${formatted}</b>\n\n⏰ ${new Date().toLocaleString('id-ID')}`
  return sendTelegramNotification(msg)
}

export async function notifyWithdrawalRequest(fullName: string, email: string, amount: number, bankName: string, bankAccount: string, bankHolder: string) {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
  const msg = `🏦 <b>REQUEST TARIK SALDO!</b>\n\n👤 Nama: ${fullName}\n📧 Email: ${email}\n💵 Jumlah: <b>${formatted}</b>\n🏦 Bank: ${bankName}\n🔢 Rekening: <code>${bankAccount}</code>\n📋 Atas Nama: ${bankHolder}\n\n⏰ ${new Date().toLocaleString('id-ID')}\n\n<i>Status: Menunggu review admin</i>`
  return sendTelegramNotification(msg)
}

/**
 * Notifikasi konfirmasi pembayaran PRO ke admin
 */
export async function notifyPaymentConfirmation(data: {
  email: string
  userId: string
  fullName?: string
  amount: number
  bankName: string
  accountNumber: string
  accountHolder: string
}) {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(data.amount)

  const msg = `💳 <b>KONFIRMASI PEMBAYARAN PRO</b>\n\n` +
    `👤 Nama: ${data.fullName || 'N/A'}\n` +
    `📧 Email: <code>${data.email}</code>\n` +
    `🆔 User ID: <code>${data.userId}</code>\n\n` +
    `💵 Jumlah: <b>${formatted}</b>\n` +
    `🏦 Bank: ${data.bankName}\n` +
    `🔢 Rekening: <code>${data.accountNumber}</code>\n` +
    `📋 Atas Nama: ${data.accountHolder}\n\n` +
    `⏰ ${new Date().toLocaleString('id-ID')}\n\n` +
    `<i>Untuk aktivasi, login ke Admin Panel LuxTrade</i>`

  // Kirim ke admin
  return sendToAdmin(msg)
}
