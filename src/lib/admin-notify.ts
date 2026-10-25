/**
 * Admin notification helper — sends backend alerts to admin via Discord webhook.
 * Previously used Telegram Bot API with ADMIN_BOT_TOKEN/ADMIN_CHAT_ID env vars
 * (returned "Unauthorized" after the bot token was revoked). Discord webhook only
 * needs ONE secret: DISCORD_WEBHOOK_URL. See ./discord.ts for setup instructions.
 */

import { sendDiscordNotification } from '@/lib/discord'

export async function sendAdminNotification(message: string) {
  return sendDiscordNotification(message)
}

/**
 * Kirim pesan langsung ke admin
 */
export async function sendToAdmin(message: string) {
  return sendDiscordNotification(message)
}

// Backward-compatible alias (renamed from sendTelegramNotification)
export const sendAdminNotificationAlias = sendAdminNotification
export const sendTelegramNotification = sendAdminNotification // @deprecated use sendAdminNotification

export async function notifyReferralSignup(referrerName: string, refereeEmail: string, referralCode: string) {
  const msg = `🎉 <b>REFERRAL BARU!</b>\n\n👤 Referrer: ${referrerName}\n📧 Downline: ${refereeEmail}\n🏷️ Kode: <code>${referralCode}</code>\n\n⏰ ${new Date().toLocaleString('id-ID')}`
  return sendAdminNotification(msg)
}

export async function notifyCommissionEarned(referrerName: string, refereeEmail: string, amount: number) {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
  const msg = `💰 <b>KOMISI AFILIASI MASUK!</b>\n\n👤 Affiliate: ${referrerName}\n📧 Dari: ${refereeEmail}\n💵 Komisi: <b>${formatted}</b>\n\n⏰ ${new Date().toLocaleString('id-ID')}`
  return sendAdminNotification(msg)
}

export async function notifyWithdrawalRequest(fullName: string, email: string, amount: number, bankName: string, bankAccount: string, bankHolder: string) {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
  const msg = `🏦 <b>REQUEST TARIK SALDO!</b>\n\n👤 Nama: ${fullName}\n📧 Email: ${email}\n💵 Jumlah: <b>${formatted}</b>\n🏦 Bank: ${bankName}\n🔢 Rekening: <code>${bankAccount}</code>\n📋 Atas Nama: ${bankHolder}\n\n⏰ ${new Date().toLocaleString('id-ID')}\n\n<i>Status: Menunggu review admin</i>`
  return sendAdminNotification(msg)
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
    `<i>Untuk aktivasi, login ke Admin Panel LuxTradee</i>`

  return sendToAdmin(msg)
}
