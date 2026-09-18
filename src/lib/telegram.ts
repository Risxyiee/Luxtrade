const TELEGRAM_BOT_TOKEN = '8626110392:AAFgmM4TA6UJDjc2Dgl5JvYgO-WGKDvspck'
const TELEGRAM_CHAT_ID = '1204328441'
// Admin Telegram untuk konfirmasi pembayaran
const ADMIN_TELEGRAM_USERNAME = '@Risxyiee'

export async function sendTelegramNotification(message: string) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('Telegram notification failed:', data.description)
    }
    return data
  } catch (error) {
    console.error('Telegram notification error:', error)
    return { ok: false }
  }
}

/**
 * Kirim pesan langsung ke admin via username Telegram (@Risxyiee)
 */
export async function sendToAdmin(message: string) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_TELEGRAM_USERNAME,
        text: message,
        parse_mode: 'HTML',
      }),
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('Telegram to admin failed:', data.description)
    }
    return data
  } catch (error) {
    console.error('Telegram to admin error:', error)
    return { ok: false }
  }
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
 * Notifikasi konfirmasi pembayaran PRO ke admin Telegram
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

  // Kirim ke admin via @Risxyiee
  return sendToAdmin(msg)
}
