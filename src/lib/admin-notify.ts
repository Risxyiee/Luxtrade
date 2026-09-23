// Admin notification helper — sends backend alerts to admin
// Telegram credentials now read from env vars (lazy, safe for CF Workers)

function getTelegramConfig() {
  const botToken = process.env.ADMIN_BOT_TOKEN
  const chatId = process.env.ADMIN_CHAT_ID
  const username = process.env.ADMIN_USERNAME || '@Risxyiee'
  if (!botToken || !chatId) {
    console.warn('⚠️ ADMIN_BOT_TOKEN or ADMIN_CHAT_ID not set in env vars. Telegram notifications disabled.')
    return null
  }
  return { botToken, chatId, username }
}

export async function sendAdminNotification(message: string) {
  const config = getTelegramConfig()
  if (!config) return { ok: false, error: 'Telegram not configured' }

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('Admin notification failed:', data.description)
    }
    return data
  } catch (error) {
    console.error('Admin notification error:', error)
    return { ok: false }
  }
}

/**
 * Kirim pesan langsung ke admin
 */
export async function sendToAdmin(message: string) {
  const config = getTelegramConfig()
  if (!config) return { ok: false, error: 'Telegram not configured' }

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.username,
        text: message,
        parse_mode: 'HTML',
      }),
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('Admin direct message failed:', data.description)
    }
    return data
  } catch (error) {
    console.error('Admin direct message error:', error)
    return { ok: false }
  }
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
