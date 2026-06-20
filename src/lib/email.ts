// Lazy-load Resend to avoid build-time errors when API key is missing

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

// Get Resend client only when needed
async function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('⚠️ RESEND_API_KEY not configured - email sending disabled')
    return null
  }
  // Dynamic import to avoid build-time evaluation
  const { Resend } = await import('resend')
  return new Resend(apiKey)
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  const resend = await getResendClient()

  if (!resend) {
    console.warn('⚠️ Email not sent - RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'LuxTrade <noreply@luxtradee.web.id>',
      to,
      subject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error }
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
    console.warn('⚠️ Email not sent - RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured' }
  }

  // Jika template ID belum diset, fallback ke inline HTML
  if (!templateId || templateId.startsWith('your_')) {
    console.log('📧 No template ID set, using inline HTML fallback')
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
      console.error('Resend template error:', error)
      // Fallback ke inline HTML jika template gagal
      console.log('📧 Template send failed, falling back to inline HTML')
      return sendEmail({ to, subject, html: fallbackHtml })
    }

    console.log('✅ Email sent via Resend template:', templateId)
    return { success: true, data }
  } catch (error) {
    console.error('Email template error, falling back to inline HTML:', error)
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
<body style="margin: 0; padding: 0; background-color: #0a0612; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin: 0 auto; background: linear-gradient(135deg, #1a0f2e 0%, #0d0715 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; padding: 12px 16px;">
                    <span style="font-size: 24px;">👑</span>
                  </td>
                </tr>
              </table>
              <h1 style="color: #fbbf24; font-size: 28px; margin: 20px 0 10px 0; font-weight: 700;">LuxTrade</h1>
              <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0;">Premium Trading Journal</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="color: #ffffff; font-size: 22px; margin: 0 0 20px 0; font-weight: 600;">
                Halo{{if .Data.DisplayName}} {{.Data.DisplayName}}{{end}}! 👋
              </h2>
              <p style="color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Terima kasih telah mendaftar di LuxTrade. Untuk memulai perjalanan trading Anda, silakan konfirmasi alamat email Anda:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Konfirmasi Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.6; margin: 0 0 15px 0;">
                Atau salin link berikut ke browser Anda:
              </p>
              <p style="color: #f59e0b; font-size: 13px; word-break: break-all; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin: 0 0 20px 0;">
                {{ .ConfirmationURL }}
              </p>
              <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0;">
                ⏰ Link ini akan kadaluarsa dalam 24 jam.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid rgba(255,255,255,0.1);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; text-align: center;">
              <p style="color: rgba(255,255,255,0.4); font-size: 13px; margin: 0 0 10px 0;">
                Jika Anda tidak merasa mendaftar di LuxTrade, mohon abaikan email ini.
              </p>
              <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">
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
<body style="margin: 0; padding: 0; background-color: #0a0612; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin: 0 auto; background: linear-gradient(135deg, #1a0f2e 0%, #0d0715 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; padding: 12px 16px;">
                    <span style="font-size: 24px;">👑</span>
                  </td>
                </tr>
              </table>
              <h1 style="color: #fbbf24; font-size: 28px; margin: 20px 0 10px 0; font-weight: 700;">LuxTrade</h1>
              <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0;">Premium Trading Journal</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 40px 0 40px; text-align: center;">
              <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(245, 158, 11, 0.1); display: inline-flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">🔒</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 30px 40px;">
              <h2 style="color: #ffffff; font-size: 22px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
                Reset Password
              </h2>
              <p style="color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                Kami menerima permintaan untuk mengubah password akun LuxTrade Anda. Klik tombol di bawah untuk membuat password baru:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Ubah Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.6; margin: 0 0 15px 0; text-align: center;">
                Atau salin link berikut ke browser Anda:
              </p>
              <p style="color: #f59e0b; font-size: 13px; word-break: break-all; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin: 0 0 20px 0; text-align: center;">
                {{ .ConfirmationURL }}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0 0 0;">
                <tr>
                  <td style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 14px 16px;">
                    <p style="color: rgba(255,255,255,0.6); font-size: 13px; line-height: 1.5; margin: 0;">
                      ⚠️ <strong style="color: #fca5a5;">Jangan bagikan link ini</strong> dengan siapa pun. Link ini akan kadaluarsa dalam <strong style="color: #fca5a5;">1 jam</strong>. Jika Anda tidak meminta reset password, mohon abaikan email ini — password Anda tidak akan berubah.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid rgba(255,255,255,0.1);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; text-align: center;">
              <p style="color: rgba(255,255,255,0.4); font-size: 13px; margin: 0 0 10px 0;">
                Jika Anda tidak meminta reset password, abaikan email ini.
              </p>
              <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">
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
<body style="margin: 0; padding: 0; background-color: #0a0612; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin: 0 auto; background: linear-gradient(135deg, #1a0f2e 0%, #0d0715 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; padding: 12px 16px;">
                    <span style="font-size: 24px;">👑</span>
                  </td>
                </tr>
              </table>
              <h1 style="color: #fbbf24; font-size: 28px; margin: 20px 0 10px 0; font-weight: 700;">LuxTrade</h1>
              <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0;">Premium Trading Journal</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="color: #ffffff; font-size: 22px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
                Konfirmasi Ubah Email 📧
              </h2>
              <p style="color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.6; margin: 0 0 10px 0; text-align: center;">
                Anda ingin mengubah email ke:
              </p>
              <p style="color: #f59e0b; font-size: 16px; font-weight: 600; text-align: center; margin: 0 0 20px 0;">
                {{ .NewEmail }}
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 20px auto 30px auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Konfirmasi Ubah Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0; text-align: center;">
                ⏰ Link ini akan kadaluarsa dalam 24 jam.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid rgba(255,255,255,0.1);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; text-align: center;">
              <p style="color: rgba(255,255,255,0.4); font-size: 13px; margin: 0 0 10px 0;">
                Jika Anda tidak merasa meminta perubahan ini, mohon abaikan email ini.
              </p>
              <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">
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
    <body style="margin: 0; padding: 0; background-color: #0a0612; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin: 0 auto; background: linear-gradient(135deg, #1a0f2e 0%, #0d0715 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; padding: 12px 16px;">
                        <span style="font-size: 24px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #fbbf24; font-size: 28px; margin: 20px 0 10px 0; font-weight: 700;">LuxTrade</h1>
                  <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 30px 40px;">
                  <h2 style="color: #ffffff; font-size: 22px; margin: 0 0 10px 0; font-weight: 600;">
                    Selamat Datang, ${name}! 👋
                  </h2>
                  <p style="color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    Akun LuxTrade kamu sudah berhasil dibuat. Langkah terakhir — verifikasi email kamu supaya akun bisa langsung dipakai untuk login.
                  </p>
                  
                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                          ✅ Verifikasi Email Saya
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                    Kalau tombol di atas nggak bisa diklik, salin link ini ke browser:
                  </p>
                  <p style="color: #f59e0b; font-size: 13px; word-break: break-all; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin: 0 0 20px 0;">
                    ${confirmationUrl}
                  </p>

                  <!-- Info Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 10px 0;">
                    <tr>
                      <td style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 10px; padding: 14px 16px;">
                        <p style="color: rgba(255,255,255,0.6); font-size: 13px; line-height: 1.5; margin: 0;">
                          💡 <strong style="color: #c7d2fe;">Setelah verifikasi</strong>, kamu bisa langsung login dan mulai menggunakan semua fitur LuxTrade — termasuk trading journal, analisa, dan promo PRO.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: rgba(255,255,255,0.4); font-size: 13px; margin: 10px 0 0 0;">
                    ⏰ Link berlaku 24 jam. Kalau kamu nggak merasa daftar di LuxTrade, abaikan email ini — akun akan otomatis terhapus.
                  </p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="border-top: 1px solid rgba(255,255,255,0.1);"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 6px 0 0 0;">
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

// Reset password email template
export function getResetPasswordEmailHtml(name: string, resetUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Password - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0612; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin: 0 auto; background: linear-gradient(135deg, #1a0f2e 0%, #0d0715 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; padding: 12px 16px;">
                        <span style="font-size: 24px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #fbbf24; font-size: 28px; margin: 20px 0 10px 0; font-weight: 700;">LuxTrade</h1>
                  <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Icon -->
              <tr>
                <td style="padding: 10px 40px 0 40px; text-align: center;">
                  <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(245, 158, 11, 0.1); display: inline-flex; align-items: center; justify-content: center;">
                    <span style="font-size: 32px;">🔐</span>
                  </div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 20px 40px 30px 40px;">
                  <h2 style="color: #ffffff; font-size: 22px; margin: 0 0 10px 0; font-weight: 600; text-align: center;">
                    Lupa Password, ${name}?
                  </h2>
                  <p style="color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                    Kami terima permintaan reset password untuk akun kamu. Klik tombol di bawah untuk bikin password baru:
                  </p>
                  
                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);">
                        <a href="${resetUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                          🔑 Reset Password Saya
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.6; margin: 0 0 10px 0; text-align: center;">
                    Kalau tombol di atas nggak bisa diklik, salin link ini ke browser:
                  </p>
                  <p style="color: #f59e0b; font-size: 13px; word-break: break-all; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin: 0 0 20px 0; text-align: center;">
                    ${resetUrl}
                  </p>

                  <!-- Warning Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0 0 0;">
                    <tr>
                      <td style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 14px 16px;">
                        <p style="color: rgba(255,255,255,0.6); font-size: 13px; line-height: 1.5; margin: 0;">
                          ⚠️ <strong style="color: #fca5a5;">Jangan bagikan link ini</strong> ke siapa pun. Link ini cuma berlaku <strong style="color: #fca5a5;">1 jam</strong>. Kalau kamu nggak merasa minta reset password, langsung aja abaikan — password kamu tetap aman dan nggak akan berubah.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="border-top: 1px solid rgba(255,255,255,0.1);"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 6px 0 0 0;">
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

// Email change confirmation template
export function getEmailChangeHtml(name: string, confirmationUrl: string, newEmail: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Konfirmasi Ubah Email - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0612; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin: 0 auto; background: linear-gradient(135deg, #1a0f2e 0%, #0d0715 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; padding: 12px 16px;">
                        <span style="font-size: 24px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #fbbf24; font-size: 28px; margin: 20px 0 10px 0; font-weight: 700;">LuxTrade</h1>
                  <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 30px 40px;">
                  <h2 style="color: #ffffff; font-size: 22px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
                    Konfirmasi Ubah Email 📧
                  </h2>
                  <p style="color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.6; margin: 0 0 10px 0; text-align: center;">
                    Hai ${name}, Anda ingin mengubah email ke:
                  </p>
                  <p style="color: #f59e0b; font-size: 16px; font-weight: 600; text-align: center; margin: 0 0 20px 0;">
                    ${newEmail}
                  </p>
                  
                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 20px auto 30px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                          Konfirmasi Ubah Email
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0; text-align: center;">
                    ⏰ Link ini akan kadaluarsa dalam 24 jam.
                  </p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="border-top: 1px solid rgba(255,255,255,0.1);"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.4); font-size: 13px; margin: 0 0 10px 0;">
                    Jika Anda tidak merasa meminta perubahan ini, mohon abaikan email ini.
                  </p>
                  <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
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

// Welcome email template after confirmation
export function getWelcomeEmailHtml(name: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Selamat Datang - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0612; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin: 0 auto; background: linear-gradient(135deg, #1a0f2e 0%, #0d0715 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; padding: 12px 16px;">
                        <span style="font-size: 24px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #fbbf24; font-size: 28px; margin: 20px 0 10px 0; font-weight: 700;">LuxTrade</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 30px 40px; text-align: center;">
                  <h2 style="color: #10b981; font-size: 24px; margin: 0 0 10px 0;">✅ Email Terkonfirmasi!</h2>
                  <h3 style="color: #ffffff; font-size: 22px; margin: 0 0 20px 0; font-weight: 600;">
                    Selamat Datang, ${name}!
                  </h3>
                  <p style="color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    Akun LuxTrade Anda sudah aktif. Mulai tracking trading Anda dan tingkatkan performa bersama AI insights kami.
                  </p>
                  
                  <!-- Features -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="text-align: left; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 10px 0; color: rgba(255,255,255,0.7); font-size: 15px;">
                        📊 <strong style="color: #ffffff;">Performance Analytics</strong> - Track win rate & profit factor
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; color: rgba(255,255,255,0.7); font-size: 15px;">
                        📖 <strong style="color: #ffffff;">Trading Journal</strong> - Document every trade
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; color: rgba(255,255,255,0.7); font-size: 15px;">
                        🤖 <strong style="color: #ffffff;">AI Insights</strong> - Get personalized tips
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'}/dashboard" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                          Mulai Trading Journal →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1);">
                  <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
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
