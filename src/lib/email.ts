// Lazy-load Resend to avoid build-time errors when API key is missing

export interface EmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
}

// Get Resend client only when needed
async function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return null
  }
  // Dynamic import to avoid build-time evaluation
  const { Resend } = await import('resend')
  return new Resend(apiKey)
}

export async function sendEmail({ to, subject, html, replyTo }: EmailOptions) {
  const resend = await getResendClient()

  if (!resend) {
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const payload: Record<string, unknown> = {
      from: 'LuxTrade <noreply@luxtradee.web.id>',
      to,
      subject,
      html,
    }
    if (replyTo) {
      payload.replyTo = replyTo
    }
    const { data, error } = await resend.emails.send(payload as any)

    if (error) {
      // Silently return failure — no error logs to avoid Vercel log spam
      return { success: false, error }
    }

    return { success: true, data }
  } catch (_error) {
    return { success: false, error: _error }
  }
}

/**
 * Kirim email menggunakan Resend Template dari Dashboard.
 * Template variables: {{ name }}, {{ confirmationUrl }}, {{ resetUrl }}
 *
 * CARA SETUP:
 * 1. Buka Resend Dashboard → Emails → Create Template
 * 2. Paste HTML dari file resend-templates/confirm-signup.html atau reset-password.html
 * 3. Copy Template ID (format: tpl_xxxxxxxx)
 * 4. Set env var: RESEND_TEMPLATE_CONFIRM=tpl_xxxxxxxx dan RESEND_TEMPLATE_RESET=tpl_xxxxxxxx
 */
export async function sendEmailFromTemplate({
  to,
  subject,
  templateId,
  templateParams,
  fallbackHtml,
}: {
  to: string
  subject: string
  templateId: string
  templateParams: Record<string, string>
  fallbackHtml: string
}) {
  const resend = await getResendClient()

  if (!resend) {
    return { success: false, error: 'Email service not configured' }
  }

  // Jika template ID belum diset, fallback ke inline HTML
  if (!templateId || templateId.startsWith('your_')) {
    return sendEmail({ to, subject, html: fallbackHtml })
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'LuxTrade <noreply@luxtradee.web.id>',
      to,
      subject,
      templateId,
      templateParams,
    })

    if (error) {
      // Fallback ke inline HTML jika template gagal
      return sendEmail({ to, subject, html: fallbackHtml })
    }

    return { success: true, data }
  } catch (_error) {
    return sendEmail({ to, subject, html: fallbackHtml })
  }
}

// ============================================
// SUPABASE EMAIL TEMPLATES
// Copy-paste these directly into:
// Supabase Dashboard → Authentication → Email Templates
// ============================================

// VARIABLES YANG TERSEDIA DI SUPABASE TEMPLATE:
// {{ .ConfirmationURL }} - Link konfirmasi/reset
// {{ .Token }} - Token raw
// {{ .SiteURL }} - Site URL dari config
// {{ .Email }} - Email user
// {{ .NewEmail }} - Email baru (hanya di change email)
// {{ .RedirectTo }} - Redirect URL
// {{ .Data.DisplayName }} - Nama user dari metadata

/**
 * === SUPABASE: Confirm Signup Template ===
 * Paste ke: Authentication → Email Templates → Confirm signup
 */
export const SUPABASE_CONFIRM_SIGNUP = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Konfirmasi Email - LuxTrade</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; padding: 12px 16px;">
                    <span style="font-size: 24px;">👑</span>
                  </td>
                </tr>
              </table>
              <h1 style="color: #1a1a2e; font-size: 28px; margin: 20px 0 10px 0; font-weight: 700;">LuxTrade</h1>
              <p style="color: #8b8da0; font-size: 14px; margin: 0;">Premium Trading Journal</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="color: #1a1a2e; font-size: 22px; margin: 0 0 20px 0; font-weight: 600;">
                Halo{{if .Data.DisplayName}} {{.Data.DisplayName}}{{end}}! 👋
              </h2>
              <p style="color: #555770; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Terima kasih telah mendaftar di LuxTrade. Untuk memulai perjalanan trading Anda, silakan konfirmasi alamat email Anda:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Konfirmasi Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #8b8da0; font-size: 14px; line-height: 1.6; margin: 0 0 15px 0;">
                Atau salin link berikut ke browser Anda:
              </p>
              <p style="color: #b45309; font-size: 13px; word-break: break-all; background-color: #fef3c7; padding: 12px; border-radius: 8px; margin: 0 0 20px 0;">
                {{ .ConfirmationURL }}
              </p>
              <p style="color: #8b8da0; font-size: 14px; margin: 0;">
                ⏰ Link ini akan kadaluarsa dalam 24 jam.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #e5e7eb;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; text-align: center;">
              <p style="color: #8b8da0; font-size: 13px; margin: 0 0 10px 0;">
                Jika Anda tidak merasa mendaftar di LuxTrade, mohon abaikan email ini.
              </p>
              <p style="color: #8b8da0; font-size: 12px; margin: 0;">
                &copy; 2025 LuxTrade. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

/**
 * === SUPABASE: Reset Password Template ===
 * Paste ke: Authentication → Email Templates → Reset password
 */
export const SUPABASE_RESET_PASSWORD = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - LuxTrade</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; padding: 12px 16px;">
                    <span style="font-size: 24px;">👑</span>
                  </td>
                </tr>
              </table>
              <h1 style="color: #1a1a2e; font-size: 28px; margin: 20px 0 10px 0; font-weight: 700;">LuxTrade</h1>
              <p style="color: #8b8da0; font-size: 14px; margin: 0;">Premium Trading Journal</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 40px 0 40px; text-align: center;">
              <div style="width: 64px; height: 64px; border-radius: 50%; background-color: #fef3c7; display: inline-flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">🔒</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 30px 40px;">
              <h2 style="color: #1a1a2e; font-size: 22px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
                Reset Password
              </h2>
              <p style="color: #555770; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                Kami menerima permintaan untuk mengubah password akun LuxTrade Anda. Klik tombol di bawah untuk membuat password baru:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Ubah Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #8b8da0; font-size: 14px; line-height: 1.6; margin: 0 0 15px 0; text-align: center;">
                Atau salin link berikut ke browser Anda:
              </p>
              <p style="color: #b45309; font-size: 13px; word-break: break-all; background-color: #fef3c7; padding: 12px; border-radius: 8px; margin: 0 0 20px 0; text-align: center;">
                {{ .ConfirmationURL }}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0 0 0;">
                <tr>
                  <td style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 16px;">
                    <p style="color: #555770; font-size: 13px; line-height: 1.5; margin: 0;">
                      ⚠️ <strong style="color: #dc2626;">Jangan bagikan link ini</strong> dengan siapa pun. Link ini akan kadaluarsa dalam <strong style="color: #dc2626;">1 jam</strong>. Jika Anda tidak meminta reset password, mohon abaikan email ini — password Anda tidak akan berubah.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #e5e7eb;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; text-align: center;">
              <p style="color: #8b8da0; font-size: 13px; margin: 0 0 10px 0;">
                Jika Anda tidak meminta reset password, abaikan email ini.
              </p>
              <p style="color: #8b8da0; font-size: 12px; margin: 0;">
                &copy; 2025 LuxTrade. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

/**
 * === SUPABASE: Change Email Template ===
 * Paste ke: Authentication → Email Templates → Change email address
 */
export const SUPABASE_CHANGE_EMAIL = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Konfirmasi Ubah Email - LuxTrade</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; padding: 12px 16px;">
                    <span style="font-size: 24px;">👑</span>
                  </td>
                </tr>
              </table>
              <h1 style="color: #1a1a2e; font-size: 28px; margin: 20px 0 10px 0; font-weight: 700;">LuxTrade</h1>
              <p style="color: #8b8da0; font-size: 14px; margin: 0;">Premium Trading Journal</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="color: #1a1a2e; font-size: 22px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
                Konfirmasi Ubah Email 📧
              </h2>
              <p style="color: #555770; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0; text-align: center;">
                Anda ingin mengubah email ke:
              </p>
              <p style="color: #b45309; font-size: 16px; font-weight: 600; text-align: center; margin: 0 0 20px 0;">
                {{ .NewEmail }}
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 20px auto 30px auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Konfirmasi Ubah Email
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
                <tr>
                  <td style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 16px;">
                    <p style="color: #555770; font-size: 13px; line-height: 1.5; margin: 0;">
                      🔒 <strong style="color: #dc2626;">Kalau ini bukan Anda</strong>, jangan klik link di atas. Langsung aja abaikan email ini — email Anda tidak akan berubah.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="color: #8b8da0; font-size: 14px; margin: 0; text-align: center;">
                ⏰ Link ini akan kadaluarsa dalam 24 jam.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #e5e7eb;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; text-align: center;">
              <p style="color: #8b8da0; font-size: 13px; margin: 0 0 10px 0;">
                Jika Anda tidak merasa meminta perubahan ini, mohon abaikan email ini.
              </p>
              <p style="color: #8b8da0; font-size: 12px; margin: 0;">
                &copy; 2025 LuxTrade. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

// ============================================
// PROGRAMMATIC TEMPLATES (untuk sendEmail via Resend langsung)
// Clean Professional Light Design - LuxTrade Brand
// ============================================

export function getConfirmationEmailHtml(name: string, confirmationUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifikasi Akun LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #1a1a2e; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: #8b8da0; font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 40px 32px 40px;">
                  <h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 8px 0; font-weight: 700;">
                    Selamat Datang, ${name}! ✨
                  </h2>
                  <p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                    Akun LuxTrade kamu udah jadi! Tinggal satu langkah lagi — klik tombol di bawah buat verifikasi email dan langsung mulai trading.
                  </p>
                  
                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          ✅ Verifikasi Email Saya
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback Link -->
                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
                    Tombol nggak bisa diklik? Salin link ini ke browser kamu:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 10px; padding: 10px 14px;">
                        <p style="color: #b45309; font-size: 11px; word-break: break-all; margin: 0; line-height: 1.5; text-align: center;">
                          <a href="${confirmationUrl}" style="color: #b45309; text-decoration: underline;">${confirmationUrl}</a>
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Features Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 12px; padding: 18px 20px;">
                        <p style="color: #b45309; font-size: 13px; font-weight: 700; margin: 0 0 12px 0;">
                          🎁 Yang kamu dapat setelah verifikasi:
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #f59e0b; margin-right: 6px;">▸</span> Trading journal & catat semua transaksi
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #f59e0b; margin-right: 6px;">▸</span> Analisa performa & AI insights
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #f59e0b; margin-right: 6px;">▸</span> Akses promo upgrade PRO
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Expiry Notice -->
                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                    ⏰ Link ini berlaku <strong style="color: #555770;">24 jam</strong>. Kalau nggak merasa daftar di LuxTrade, abaikan email ini.
                  </p>
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px 32px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// Reminder verification email - Clean Light Design (amber accent)
export function getReminderVerificationEmailHtml(name: string, confirmationUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reminder Verifikasi - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #1a1a2e; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: #8b8da0; font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 40px 32px 40px;">

                  <!-- Emoji Icon -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 52px; height: 52px; background-color: #fef3c7; border-radius: 50%; text-align: center; line-height: 52px;">
                        <span style="font-size: 26px;">😅</span>
                      </td>
                    </tr>
                  </table>

                  <h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 8px 0; font-weight: 700; text-align: center;">
                    Eits, ${name}! 🙈
                  </h2>
                  <p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 6px 0; text-align: center;">
                    Kayaknya kamu lupa verifikasi email nih. Akun LuxTrade kamu masih nunggu buat diaktifin!
                  </p>
                  <p style="color: #555770; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                    Tanpa verifikasi, kamu belum bisa login dan mulai catat trading. Yuk langsung aja klik tombol di bawah:
                  </p>

                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          ✅ Verifikasi Email Sekarang
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback Link -->
                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
                    Tombol nggak bisa diklik? Salin link ini ke browser kamu:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 10px; padding: 10px 14px;">
                        <p style="color: #b45309; font-size: 11px; word-break: break-all; margin: 0; line-height: 1.5; text-align: center;">
                          <a href="${confirmationUrl}" style="color: #b45309; text-decoration: underline;">${confirmationUrl}</a>
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Benefits Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 12px; padding: 18px 20px;">
                        <p style="color: #b45309; font-size: 13px; font-weight: 700; margin: 0 0 12px 0;">
                          🎁 Yang kamu dapat setelah verifikasi:
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #f59e0b; margin-right: 6px;">▸</span> Login langsung & akses semua fitur
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #f59e0b; margin-right: 6px;">▸</span> Trading journal & analisa lengkap
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #f59e0b; margin-right: 6px;">▸</span> Akses promo & upgrade PRO
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #f59e0b; margin-right: 6px;">▸</span> Gratis 7 hari trial PRO (kalau masih berlaku!)
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Expiry Warning -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 12px; padding: 14px 18px;">
                        <p style="color: #555770; font-size: 13px; line-height: 1.6; margin: 0;">
                          ⏰ <strong style="color: #b45309;">Perhatian:</strong> Link verifikasi ini cuma berlaku <strong style="color: #b45309;">24 jam</strong>. Kalau udah expired, kamu bisa request ulang dari halaman login.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                    Kalau kamu nggak merasa daftar di LuxTrade, abaikan email ini ya!
                  </p>
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px 32px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// Reset password email - Clean Light Design (red/amber warning accent)
export function getResetPasswordEmailHtml(name: string, resetUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Password - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #1a1a2e; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: #8b8da0; font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>
              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>
              <tr>
                <td style="padding: 28px 40px 32px 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 52px; height: 52px; background-color: #fef3c7; border-radius: 50%; text-align: center; line-height: 52px;">
                        <span style="font-size: 26px;">🔐</span>
                      </td>
                    </tr>
                  </table>
                  <h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 8px 0; font-weight: 700; text-align: center;">
                    Lupa Password, ${name}?
                  </h2>
                  <p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                    Kami terima permintaan reset password buat akun kamu. Klik tombol di bawah buat bikin password baru:
                  </p>
                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                        <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          🔑 Reset Password Saya
                        </a>
                      </td>
                    </tr>
                  </table>
                  <!-- Fallback Link -->
                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
                    Tombol nggak bisa diklik? Salin link ini ke browser:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 10px; padding: 10px 14px;">
                        <p style="color: #b45309; font-size: 11px; word-break: break-all; margin: 0; line-height: 1.5; text-align: center;">
                          <a href="${resetUrl}" style="color: #b45309; text-decoration: underline;">${resetUrl}</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                  <!-- Security Warning Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 8px 0;">
                    <tr>
                      <td style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px 18px;">
                        <p style="color: #555770; font-size: 13px; line-height: 1.6; margin: 0;">
                          ⚠️ <strong style="color: #dc2626;">Jangan bagikan link ini</strong> ke siapa pun. Link cuma berlaku <strong style="color: #dc2626;">1 jam</strong>. Kalau kamu nggak merasa minta reset password, langsung aja abaikan — password kamu tetap aman.
                        </p>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                    Kalau kamu merasa ada yang mencoba akses akun, segera ganti password setelah login ya.
                  </p>
                </td>
              </tr>
              <!-- Footer Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 40px 32px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// Email change confirmation - Clean Light Design (blue-cyan accent)
export function getEmailChangeHtml(name: string, confirmationUrl: string, newEmail: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Konfirmasi Ubah Email - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #1a1a2e; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: #8b8da0; font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 40px 32px 40px;">

                  <!-- Emoji Icon -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 52px; height: 52px; background-color: #eff6ff; border-radius: 50%; text-align: center; line-height: 52px;">
                        <span style="font-size: 26px;">📧</span>
                      </td>
                    </tr>
                  </table>

                  <h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 8px 0; font-weight: 700; text-align: center;">
                    Ubah Email, ${name}? 🔄
                  </h2>
                  <p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0; text-align: center;">
                    Kita nerima request buat ganti email akun kamu. Kamu mau ubah ke alamat ini:
                  </p>

                  <!-- New Email Display -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background-color: #eff6ff; border-radius: 12px; padding: 14px 18px; text-align: center;">
                        <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px;">Email Baru</p>
                        <p style="color: #b45309; font-size: 15px; font-weight: 700; margin: 0; word-break: break-all;">${newEmail}</p>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          ✅ Konfirmasi Ubah Email
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback Link -->
                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
                    Tombol nggak bisa diklik? Salin link ini ke browser kamu:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background-color: #eff6ff; border-radius: 10px; padding: 10px 14px;">
                        <p style="color: #b45309; font-size: 11px; word-break: break-all; margin: 0; line-height: 1.5; text-align: center;">
                          <a href="${confirmationUrl}" style="color: #b45309; text-decoration: underline;">${confirmationUrl}</a>
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Security Warning -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
                    <tr>
                      <td style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px 18px;">
                        <p style="color: #555770; font-size: 13px; line-height: 1.6; margin: 0;">
                          🔒 <strong style="color: #dc2626;">Kalau ini bukan kamu</strong>, jangan klik link di atas. Langsung aja abaikan email ini — email kamu nggak akan berubah.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                    ⏰ Link ini berlaku 24 jam aja ya.
                  </p>
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px 32px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// Welcome email after confirmation - Clean Light Design (green success accent)
export function getWelcomeEmailHtml(name: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Selamat Datang - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #1a1a2e; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: #8b8da0; font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 40px 32px 40px;">

                  <!-- Success Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 52px; height: 52px; background-color: #ecfdf5; border-radius: 50%; text-align: center; line-height: 52px;">
                        <span style="font-size: 26px;">🎉</span>
                      </td>
                    </tr>
                  </table>

                  <h2 style="color: #059669; font-size: 16px; margin: 0 0 4px 0; font-weight: 700; text-align: center;">
                    ✅ EMAIL TERKONFIRMASI!
                  </h2>
                  <h3 style="color: #1a1a2e; font-size: 22px; margin: 0 0 12px 0; font-weight: 800; text-align: center;">
                    Selamat Datang, ${name}!
                  </h3>
                  <p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                    Akun LuxTrade kamu udah aktif! Sekarang kamu bisa mulai catat trading, analisa performa, dan tingkatkan skill trading kamu bareng AI insights kami. Yuk langsung mulai! 🚀
                  </p>

                  <!-- Features Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background-color: #ecfdf5; border-radius: 12px; padding: 20px 22px;">
                        <p style="color: #059669; font-size: 13px; font-weight: 700; margin: 0 0 14px 0;">
                          ⚡ Yang bisa kamu lakukan sekarang:
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding: 4px 0; color: #555770; font-size: 13px;">
                              <span style="color: #059669; margin-right: 6px;">▸</span> <strong style="color: #1a1a2e;">Analisa Performa</strong> — pantau win rate & profit factor
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; color: #555770; font-size: 13px;">
                              <span style="color: #059669; margin-right: 6px;">▸</span> <strong style="color: #1a1a2e;">Trading Journal</strong> — catat setiap transaksi kamu
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; color: #555770; font-size: 13px;">
                              <span style="color: #059669; margin-right: 6px;">▸</span> <strong style="color: #1a1a2e;">AI Insights</strong> — tips personal dari AI buat tingkatkan trading
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'}/dashboard" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          🚀 Mulai Trading Journal →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px 32px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// Promotional email wrapper - Clean Light Design (gold accent)
export function getPromotionalEmailHtml(name: string, subject: string, htmlBody: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject} - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #1a1a2e; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: #8b8da0; font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Greeting -->
              <tr>
                <td style="padding: 28px 40px 0 40px;">
                  <p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0;">
                    Hai ${name}, ada info penting nih buat kamu! 👇
                  </p>
                </td>
              </tr>

              <!-- Dynamic Content Area -->
              <tr>
                <td style="padding: 16px 40px 0 40px;">
                  ${htmlBody}
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 24px 40px 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 40px 32px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 8px 0 0 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'}/settings" style="color: #b45309; text-decoration: underline;">Unsubscribe</a> dari email promosi
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// Bulk unverified reminder - Clean Light Design (orange urgency accent)
export function getVerificationPromoEmailHtml(name: string, confirmationUrl: string, promoCode: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifikasi & Dapatkan Promo - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #1a1a2e; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: #8b8da0; font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 40px 32px 40px;">

                  <!-- Promo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 52px; height: 52px; background-color: #dcfce7; border-radius: 50%; text-align: center; line-height: 52px;">
                        <span style="font-size: 26px;">🎁</span>
                      </td>
                    </tr>
                  </table>

                  <h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 8px 0; font-weight: 700; text-align: center;">
                    ${name}, Ada Promo Spesial Buat Kamu! 🎉
                  </h2>
                  <p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 6px 0; text-align: center;">
                    Akun kamu belum terverifikasi, tapi tenang — kami punya hadiah spesial! Verifikasi sekarang dan gunakan kode promo eksklusif untuk akses PRO.
                  </p>

                  <!-- Promo Code Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; text-align: center; border: 2px dashed #f59e0b;">
                        <p style="color: #b45309; font-size: 12px; font-weight: 700; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Kode Promo Kamu</p>
                        <p style="color: #1a1a2e; font-size: 28px; font-weight: 800; margin: 0 0 4px 0; letter-spacing: 3px; font-family: 'Courier New', monospace;">${promoCode}</p>
                        <p style="color: #92400e; font-size: 12px; margin: 0;">Gunakan setelah verifikasi akun</p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #555770; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                    Langkah 1: Verifikasi email kamu dulu 👇
                  </p>

                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          ✅ Verifikasi Sekarang
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback Link -->
                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
                    Tombol nggak bisa diklik? Salin link ini ke browser kamu:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 10px; padding: 10px 14px;">
                        <p style="color: #b45309; font-size: 11px; word-break: break-all; margin: 0; line-height: 1.5; text-align: center;">
                          <a href="${confirmationUrl}" style="color: #b45309; text-decoration: underline;">${confirmationUrl}</a>
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Info Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
                    <tr>
                      <td style="background-color: #dcfce7; border-radius: 12px; padding: 18px 20px;">
                        <p style="color: #166534; font-size: 13px; font-weight: 700; margin: 0 0 12px 0;">
                          🎯 Dapetin setelah verifikasi:
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #16a34a; margin-right: 6px;">✓</span> Akses semua fitur trading journal
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #16a34a; margin-right: 6px;">✓</span> AI insights personal buat trading kamu
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #16a34a; margin-right: 6px;">✓</span> Gunakan kode promo <strong>${promoCode}</strong> untuk diskon PRO
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Expiry Notice -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 12px; padding: 14px 18px;">
                        <p style="color: #555770; font-size: 13px; line-height: 1.6; margin: 0;">
                          ⏰ Link verifikasi ini berlaku <strong style="color: #b45309;">24 jam</strong>. Kalau udah expired, kamu bisa request ulang dari halaman login.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                    Kalau kamu nggak merasa daftar di LuxTrade, abaikan email ini ya!
                  </p>
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px 32px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export function getUnverifiedBulkReminderHtml(name: string, confirmationUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Akun Belum Verifikasi - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #1a1a2e; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: #8b8da0; font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 40px 32px 40px;">

                  <!-- Emoji Icon -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 52px; height: 52px; background-color: #fef3c7; border-radius: 50%; text-align: center; line-height: 52px;">
                        <span style="font-size: 26px;">⏳</span>
                      </td>
                    </tr>
                  </table>

                  <h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 8px 0; font-weight: 700; text-align: center;">
                    ${name}, Akun Kamu Menunggu! 🔔
                  </h2>
                  <p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 6px 0; text-align: center;">
                    Kami notice akun kamu masih belum terverifikasi nih. Padahal semua fitur LuxTrade udah siap dipake — tinggal klik tombol verifikasi aja!
                  </p>
                  <p style="color: #555770; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                    Gak mau kan ketinggalan fitur keren dari LuxTrade? Buruan verifikasi sekarang:
                  </p>

                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          ✅ Verifikasi Sekarang
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback Link -->
                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
                    Tombol nggak bisa diklik? Salin link ini ke browser kamu:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 10px; padding: 10px 14px;">
                        <p style="color: #b45309; font-size: 11px; word-break: break-all; margin: 0; line-height: 1.5; text-align: center;">
                          <a href="${confirmationUrl}" style="color: #b45309; text-decoration: underline;">${confirmationUrl}</a>
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Info Box - Why Verify? -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 12px; padding: 18px 20px;">
                        <p style="color: #b45309; font-size: 13px; font-weight: 700; margin: 0 0 12px 0;">
                          🎯 Kenapa harus verifikasi?
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #f59e0b; margin-right: 6px;">▸</span> Langsung akses semua fitur trading journal
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #f59e0b; margin-right: 6px;">▸</span> Dapatkan AI insights personal buat trading kamu
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #555770; font-size: 13px;">
                              <span style="color: #f59e0b; margin-right: 6px;">▸</span> Ikutan promo & dapatkan akses PRO eksklusif
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Expiry Notice -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
                    <tr>
                      <td style="background-color: #fef3c7; border-radius: 12px; padding: 14px 18px;">
                        <p style="color: #555770; font-size: 13px; line-height: 1.6; margin: 0;">
                          ⏰ Link verifikasi ini berlaku <strong style="color: #b45309;">24 jam</strong>. Kalau udah expired, kamu bisa request ulang dari halaman login.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #8b8da0; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                    Kalau kamu nggak merasa daftar di LuxTrade, abaikan email ini ya!
                  </p>
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px 32px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}
// ============================================
// RE-ENGAGEMENT EMAILS
// Sent to users who signed up but never came back
// ============================================

const REENGAGE_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

/**
 * Re-engagement email for users with 0 trades
 * "Upload 1 trade screenshot -> get 1 day PRO free"
 */
export function getReEngagementNoTradeHtml(name: string, ctaUrl: string, unsubUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Yuk Coba LuxTrade! 👑</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #1a1a2e;">Halo, ${name}!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 40px 32px 40px;">
                  <p style="color: #4a4a68; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                    Kemarin kamu baru sempat lihat sekilas <strong>LuxTrade</strong>. Yuk lanjutkan — kamu cuma perlu upload <strong>1 screenshot trade</strong>, dan otomatis dapat <strong>1 hari akses PRO gratis</strong>!
                  </p>
                  <p style="color: #4a4a68; font-size: 15px; line-height: 1.6; margin: 0 0 28px 0;">
                    Di PRO kamu bisa:<br>
                    ✅ Lihat statistik trading detail<br>
                    ✅ Track journal &amp; streak harian<br>
                    ✅ Akses fitur analisis lanjutan
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 40px; border-radius: 10px;">
                          Buka LuxTrade
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #8b8da0; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
                    Cukup 1 trade → langsung dapat 1 hari PRO. Gampang!
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 40px 16px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    &copy; ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0 0 8px 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                  <a href="${unsubUrl}" style="color: #8b8da0; font-size: 10px; text-decoration: underline;">Unsubscribe dari email ini</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
 * Re-engagement email for users with >=1 trade but never came back
 */
export function getReEngagementHasTradeHtml(name: string, tradeCount: number, ctaUrl: string, unsubUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lanjutkan Trading Journal-mu! 📊</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">📊</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #1a1a2e;">Trade pertamamu udah tersimpan! 🎉</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 40px 32px 40px;">
                  <p style="color: #4a4a68; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                    Halo <strong>${name}</strong>! Kamu udah upload <strong>${tradeCount} trade</strong> di LuxTrade. Itu langkah pertama yang keren!
                  </p>
                  <p style="color: #4a4a68; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                    Yuk lanjutin kebiasaan ini — tambah trade hari ini dan lihat progressmu:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
                    <tr>
                      <td style="background-color: #f0fdf4; border-radius: 10px; padding: 16px 20px;">
                        <p style="color: #065f46; font-size: 14px; line-height: 1.5; margin: 0;">
                          📈 Tracking journal harian membantu review performa<br>
                          🔥 Streak counter buat konsistensi<br>
                          🏆 Achievement badge saat milestone tercapai
                        </p>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 40px; border-radius: 10px;">
                          Buka Trading Journal
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 40px 16px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    &copy; ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0 0 8px 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                  <a href="${unsubUrl}" style="color: #8b8da0; font-size: 10px; text-decoration: underline;">Unsubscribe dari email ini</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}


/**
 * Weekly Summary email — sent every Monday to users with trades
 * Contains: trade count, PnL, win rate, best/worst trade, streak, top symbols
 */
export function getWeeklySummaryHtml(params: {
  name: string
  weekLabel: string
  tradeCount: number
  pnl: number
  winRate: number
  winCount: number
  lossCount: number
  bestTrade: number
  worstTrade: number
  streak: number
  topSymbols: { symbol: string; count: number }[]
  ctaUrl: string
  unsubUrl: string
}): string {
  const {
    name,
    weekLabel,
    tradeCount,
    pnl,
    winRate,
    winCount,
    lossCount,
    bestTrade,
    worstTrade,
    streak,
    topSymbols,
    ctaUrl,
    unsubUrl,
  } = params

  const pnlColor = pnl >= 0 ? "#059669" : "#dc2626"
  const pnlSign = pnl >= 0 ? "+" : ""
  const pnlFormatted = `${pnlSign}${pnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const barWidth = Math.max(Math.min(winRate, 100), 0)
  const barColor = winRate >= 60 ? "#059669" : winRate >= 40 ? "#f59e0b" : "#dc2626"

  const symbolRows = topSymbols.slice(0, 5).map((s, i) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #1a1a2e; font-size: 14px; font-weight: 600;">
        ${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
      </td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #1a1a2e; font-size: 14px; text-align: left; padding-left: 12px;">${s.symbol}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 14px; text-align: right;">${s.count} trade${s.count > 1 ? "s" : ""}</td>
    </tr>
  `).join("")

  const streakMsg = streak >= 7
    ? `🔥 Streak ${streak} hari! Luar biasa konsistensinya!`
    : streak >= 3
      ? `🔥 Streak ${streak} hari! Terus konsisten!`
      : streak > 0
        ? `Streak ${streak} hari — lanjutkan!`
        : ""

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Weekly Report — LuxTrade 📊</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">📊</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #1a1a2e;">Weekly Report</h1>
                  <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">${weekLabel}</p>
                </td>
              </tr>

              <!-- Greeting -->
              <tr>
                <td style="padding: 8px 40px 24px 40px;">
                  <p style="color: #4a4a68; font-size: 15px; line-height: 1.6; margin: 0;">
                    Halo <strong>${name}</strong>! Ini ringkasan trading-mu minggu lalu:
                  </p>
                  ${streakMsg ? `<p style="color: #f59e0b; font-size: 14px; font-weight: 600; margin: 8px 0 0 0;">${streakMsg}</p>` : ""}
                </td>
              </tr>

              <!-- Main Stats Grid -->
              <tr>
                <td style="padding: 0 40px 24px 40px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 10px; overflow: hidden;">
                    <tr>
                      <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb; width: 50%;">
                        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Total Trades</p>
                        <p style="margin: 4px 0 0 0; color: #1a1a2e; font-size: 24px; font-weight: 700;">${tradeCount}</p>
                      </td>
                      <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb; width: 50%;">
                        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Total PnL</p>
                        <p style="margin: 4px 0 0 0; color: ${pnlColor}; font-size: 24px; font-weight: 700;">${pnlFormatted}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 16px 20px; width: 50%;">
                        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Win Rate</p>
                        <p style="margin: 4px 0 0 0; color: ${barColor}; font-size: 24px; font-weight: 700;">${winRate}%</p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 6px; background-color: #e5e7eb; border-radius: 4px; height: 6px;">
                          <tr>
                            <td style="width: ${barWidth}%; background-color: ${barColor}; border-radius: 4px; height: 6px;"></td>
                          </tr>
                        </table>
                        <p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 11px;">${winCount}W / ${lossCount}L</p>
                      </td>
                      <td style="padding: 16px 20px; width: 50%;">
                        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Streak</p>
                        <p style="margin: 4px 0 0 0; color: #1a1a2e; font-size: 24px; font-weight: 700;">${streak} <span style="font-size: 14px; color: #6b7280;">hari</span></p>
                        <p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 11px;">${streak >= 3 ? "Konsisten!" : streak > 0 ? "Lanjutkan!" : "Mulai streak baru"}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Best / Worst Trade -->
              <tr>
                <td style="padding: 0 40px 24px 40px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="width: 50%; padding-right: 6px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-radius: 10px; border: 1px solid #d1fae5;">
                          <tr>
                            <td style="padding: 16px 20px;">
                              <p style="margin: 0; color: #065f46; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Trade Terbaik ✨</p>
                              <p style="margin: 6px 0 0 0; color: #059669; font-size: 20px; font-weight: 700;">+${bestTrade.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="width: 50%; padding-left: 6px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef2f2; border-radius: 10px; border: 1px solid #fee2e2;">
                          <tr>
                            <td style="padding: 16px 20px;">
                              <p style="margin: 0; color: #991b1b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Trade Terburuk</p>
                              <p style="margin: 6px 0 0 0; color: #dc2626; font-size: 20px; font-weight: 700;">${worstTrade < 0 ? worstTrade.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              ${topSymbols.length > 0 ? `
              <!-- Top Symbols -->
              <tr>
                <td style="padding: 0 40px 24px 40px;">
                  <p style="margin: 0 0 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">Pair Paling Banyak Ditrade</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 10px; padding: 4px 20px;">
                    ${symbolRows}
                  </table>
                </td>
              </tr>
              ` : ""}

              <!-- CTA Button -->
              <tr>
                <td style="padding: 0 40px 32px 40px;" align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 40px; border-radius: 10px;">
                          Lihat Detail di Dashboard →
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #8b8da0; font-size: 12px; text-align: center; margin: 12px 0 0 0;">
                    Upload trade baru dan lihat progress-mu terus!
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 40px 16px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    &copy; ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0 0 8px 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                  <a href="${unsubUrl}" style="color: #8b8da0; font-size: 10px; text-decoration: underline;">Unsubscribe dari weekly report</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
 * Daily Reminder email — sent every morning to active users
 * Encourages daily trade logging habit with motivational message
 */
export function getDailyReminderHtml(params: {
  name: string
  streak: number
  bestStreak: number
  tradesThisWeek: number
  pnlThisWeek: number
  dayName: string
  ctaUrl: string
  unsubUrl: string
}): string {
  const {
    name,
    streak,
    bestStreak,
    tradesThisWeek,
    pnlThisWeek,
    dayName,
    ctaUrl,
    unsubUrl,
  } = params

  const pnlColor = pnlThisWeek >= 0 ? "#059669" : "#dc2626"
  const pnlSign = pnlThisWeek >= 0 ? "+" : ""
  const pnlFormatted = `${pnlSign}${pnlThisWeek.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Motivational messages based on streak
  let motivation: string
  let motivationEmoji: string
  if (streak === 0) {
    motivation = "Mulai streak baru hari ini! Upload 1 trade dulu."
    motivationEmoji = "💪"
  } else if (streak === 1) {
    motivation = "Streak 1 hari! Lanjutkan besok biar ga putus."
    motivationEmoji = "🔥"
  } else if (streak < 7) {
    motivation = `Streak ${streak} hari! ${7 - streak} hari lagi menuju milestone 1 minggu!`
    motivationEmoji = "🔥"
  } else if (streak < 14) {
    motivation = `Streak ${streak} hari! Kamu udah konsisten lebih dari seminggu!`
    motivationEmoji = "⚡"
  } else if (streak < 30) {
    motivation = `Streak ${streak} hari! Kamu trader yang disiplin. Amazing!`
    motivationEmoji = "🏆"
  } else {
    motivation = `Streak ${streak} HARI! LEGENDARY. Kamu top 1% trader!`
    motivationEmoji = "👑"
  }

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Daily Reminder — LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px; text-align: center; line-height: 56px;">
                        <span style="font-size: 28px;">${motivationEmoji}</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #1a1a2e;">Selamat ${dayName}, ${name}!</h1>
                </td>
              </tr>

              <!-- Motivation -->
              <tr>
                <td style="padding: 8px 40px 24px 40px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; border-radius: 10px; border: 1px solid #ffedd5; padding: 16px 20px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <p style="color: #9a3412; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">${motivation}</p>
                        ${bestStreak > streak ? `<p style="color: #c2410c; font-size: 13px; margin: 0;">Best streak: ${bestStreak} hari</p>` : ""}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Quick Stats -->
              <tr>
                <td style="padding: 0 40px 24px 40px;">
                  <p style="margin: 0 0 12px 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">Progress minggu ini</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 10px; overflow: hidden;">
                    <tr>
                      <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb; width: 50%;">
                        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Trades</p>
                        <p style="margin: 4px 0 0 0; color: #1a1a2e; font-size: 24px; font-weight: 700;">${tradesThisWeek}</p>
                      </td>
                      <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb; width: 50%;">
                        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">PnL</p>
                        <p style="margin: 4px 0 0 0; color: ${pnlColor}; font-size: 24px; font-weight: 700;">${pnlFormatted}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 16px 20px; width: 50%;">
                        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Streak</p>
                        <p style="margin: 4px 0 0 0; color: #f97316; font-size: 24px; font-weight: 700;">${streak} <span style="font-size: 14px; color: #6b7280;">hari</span></p>
                      </td>
                      <td style="padding: 16px 20px; width: 50%;">
                        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Best Streak</p>
                        <p style="margin: 4px 0 0 0; color: #1a1a2e; font-size: 24px; font-weight: 700;">${bestStreak} <span style="font-size: 14px; color: #6b7280;">hari</span></p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA -->
              <tr>
                <td style="padding: 0 40px 32px 40px;" align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 40px; border-radius: 10px;">
                          Log Trade Sekarang →
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #8b8da0; font-size: 12px; text-align: center; margin: 12px 0 0 0;">
                    Cuma butuh 30 detik untuk upload 1 trade!
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #e5e7eb;"></div>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 40px 16px 40px; text-align: center;">
                  <p style="color: #8b8da0; font-size: 11px; margin: 0 0 4px 0;">
                    &copy; ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0 0 8px 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                  <a href="${unsubUrl}" style="color: #8b8da0; font-size: 10px; text-decoration: underline;">Unsubscribe dari daily reminder</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}
