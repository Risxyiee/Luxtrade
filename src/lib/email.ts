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
// Premium Design System - LuxTrade Brand
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
    <body style="margin: 0; padding: 0; background-color: #09050f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background: linear-gradient(170deg, #1c1028 0%, #0f0a1a 50%, #09050f 100%); border-radius: 20px; border: 1px solid rgba(251, 191, 36, 0.12); box-shadow: 0 0 60px rgba(245, 158, 11, 0.06), 0 0 120px rgba(0,0,0,0.5); overflow: hidden;">
              
              <!-- Top Accent Bar -->
              <tr>
                <td style="height: 3px; background: linear-gradient(90deg, transparent 0%, #f59e0b 30%, #fbbf24 50%, #f59e0b 70%, transparent 100%);"></td>
              </tr>

              <!-- Header -->
              <tr>
                <td style="padding: 36px 36px 8px 36px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25);">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #fbbf24; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 20px 36px 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.15) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 36px 32px 36px;">
                  <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0; font-weight: 700;">
                    Selamat Datang, ${name}! ✨
                  </h2>
                  <p style="color: rgba(255,255,255,0.65); font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                    Akun LuxTrade kamu udah jadi! Tinggal satu langkah lagi — klik tombol di bawah buat verifikasi email dan langsung mulai trading.
                  </p>
                  
                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%); border-radius: 14px; box-shadow: 0 6px 28px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255,255,255,0.15);">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          ✅ Verifikasi Email Saya
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback Link -->
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
                    Tombol nggak bisa diklik? Salin link ini ke browser kamu:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.12); border-radius: 10px; padding: 10px 14px;">
                        <p style="color: #fbbf24; font-size: 11px; word-break: break-all; margin: 0; line-height: 1.5;">
                          ${confirmationUrl}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Features Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
                    <tr>
                      <td style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.06) 0%, rgba(245, 158, 11, 0.03) 100%); border: 1px solid rgba(251, 191, 36, 0.1); border-radius: 14px; padding: 18px 20px;">
                        <p style="color: #fbbf24; font-size: 13px; font-weight: 700; margin: 0 0 12px 0;">
                          🎁 Yang kamu dapat setelah verifikasi:
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding: 3px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> Trading journal & catat semua transaksi
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> Analisa performa & AI insights
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> Akses promo upgrade PRO
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Expiry Notice -->
                  <p style="color: rgba(255,255,255,0.3); font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                    ⏰ Link ini berlaku <strong style="color: rgba(255,255,255,0.45);">24 jam</strong>. Kalau nggak merasa daftar di LuxTrade, abaikan email ini.
                  </p>
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 36px 32px 36px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin: 0;">
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

// Reminder verification email - Premium Design (orange-gold accent)
export function getReminderVerificationEmailHtml(name: string, confirmationUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reminder Verifikasi - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #09050f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background: linear-gradient(170deg, #1c1028 0%, #0f0a1a 50%, #09050f 100%); border-radius: 20px; border: 1px solid rgba(251, 191, 36, 0.12); box-shadow: 0 0 60px rgba(245, 158, 11, 0.06), 0 0 120px rgba(0,0,0,0.5); overflow: hidden;">
              
              <!-- Top Accent Bar - Orange-Gold -->
              <tr>
                <td style="height: 3px; background: linear-gradient(90deg, transparent, #f97316 30%, #fbbf24 50%, #f97316 70%, transparent);"></td>
              </tr>

              <!-- Header -->
              <tr>
                <td style="padding: 36px 36px 8px 36px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25);">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #fbbf24; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 20px 36px 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.15) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 36px 32px 36px;">

                  <!-- Emoji Icon -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 52px; height: 52px; background: rgba(251, 191, 36, 0.1); border-radius: 50%; text-align: center; line-height: 52px;">
                        <span style="font-size: 26px;">😅</span>
                      </td>
                    </tr>
                  </table>

                  <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0; font-weight: 700; text-align: center;">
                    Eits, ${name}! 🙈
                  </h2>
                  <p style="color: rgba(255,255,255,0.65); font-size: 15px; line-height: 1.7; margin: 0 0 6px 0; text-align: center;">
                    Kayaknya kamu lupa verifikasi email nih. Akun LuxTrade kamu masih nunggu buat diaktifin!
                  </p>
                  <p style="color: rgba(255,255,255,0.55); font-size: 14px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                    Tanpa verifikasi, kamu belum bisa login dan mulai catat trading. Yuk langsung aja klik tombol di bawah:
                  </p>

                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%); border-radius: 14px; box-shadow: 0 6px 28px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255,255,255,0.15);">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          ✅ Verifikasi Email Sekarang
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback Link -->
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
                    Tombol nggak bisa diklik? Salin link ini ke browser kamu:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.12); border-radius: 14px; padding: 10px 14px;">
                        <p style="color: #fbbf24; font-size: 11px; word-break: break-all; margin: 0; line-height: 1.5; text-align: center;">
                          ${confirmationUrl}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Benefits Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
                    <tr>
                      <td style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.12); border-radius: 14px; padding: 18px 20px;">
                        <p style="color: #fbbf24; font-size: 13px; font-weight: 700; margin: 0 0 12px 0;">
                          🎁 Yang kamu dapat setelah verifikasi:
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding: 3px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> Login langsung & akses semua fitur
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> Trading journal & analisa lengkap
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> Akses promo & upgrade PRO
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> Gratis 7 hari trial PRO (kalau masih berlaku!)
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Expiry Warning -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
                    <tr>
                      <td style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.12); border-radius: 14px; padding: 14px 18px;">
                        <p style="color: rgba(255,255,255,0.55); font-size: 13px; line-height: 1.6; margin: 0;">
                          ⏰ <strong style="color: #fcd34d;">Perhatian:</strong> Link verifikasi ini cuma berlaku <strong style="color: #fcd34d;">24 jam</strong>. Kalau udah expired, kamu bisa request ulang dari halaman login.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: rgba(255,255,255,0.3); font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                    Kalau kamu nggak merasa daftar di LuxTrade, abaikan email ini ya!
                  </p>
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 36px 32px 36px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin: 0;">
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

// Reset password email - Premium Redesigned
export function getResetPasswordEmailHtml(name: string, resetUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Password - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #09050f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background: linear-gradient(170deg, #1c1028 0%, #0f0a1a 50%, #09050f 100%); border-radius: 20px; border: 1px solid rgba(251, 191, 36, 0.12); box-shadow: 0 0 60px rgba(245, 158, 11, 0.06), 0 0 120px rgba(0,0,0,0.5); overflow: hidden;">
              <tr>
                <td style="height: 3px; background: linear-gradient(90deg, transparent 0%, #ef4444 30%, #f97316 50%, #f59e0b 70%, transparent 100%);"></td>
              </tr>
              <tr>
                <td style="padding: 36px 36px 8px 36px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25);">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #fbbf24; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 36px 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.15) 50%, transparent 100%);"></div>
                </td>
              </tr>
              <tr>
                <td style="padding: 28px 36px 32px 36px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 52px; height: 52px; background: rgba(245, 158, 11, 0.1); border-radius: 50%; text-align: center; line-height: 52px;">
                        <span style="font-size: 26px;">🔐</span>
                      </td>
                    </tr>
                  </table>
                  <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0; font-weight: 700; text-align: center;">
                    Lupa Password, ${name}?
                  </h2>
                  <p style="color: rgba(255,255,255,0.65); font-size: 15px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                    Kami terima permintaan reset password buat akun kamu. Klik tombol di bawah buat bikin password baru:
                  </p>
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%); border-radius: 14px; box-shadow: 0 6px 28px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255,255,255,0.15);">
                        <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          🔑 Reset Password Saya
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
                    Tombol nggak bisa diklik? Salin link ini ke browser:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.12); border-radius: 10px; padding: 10px 14px;">
                        <p style="color: #fbbf24; font-size: 11px; word-break: break-all; margin: 0; line-height: 1.5; text-align: center;">
                          ${resetUrl}
                        </p>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 8px 0;">
                    <tr>
                      <td style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 14px; padding: 16px 18px;">
                        <p style="color: rgba(255,255,255,0.6); font-size: 13px; line-height: 1.6; margin: 0;">
                          ⚠️ <strong style="color: #fca5a5;">Jangan bagikan link ini</strong> ke siapa pun. Link cuma berlaku <strong style="color: #fca5a5;">1 jam</strong>. Kalau kamu nggak merasa minta reset password, langsung aja abaikan — password kamu tetap aman.
                        </p>
                      </td>
                    </tr>
                  </table>
                  <p style="color: rgba(255,255,255,0.3); font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                    Kalau kamu merasa ada yang mencoba akses akun, segera ganti password setelah login ya.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);"></div>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 36px 32px 36px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin: 0;">
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

// Email change confirmation - Premium Design (blue-purple-gold accent)
export function getEmailChangeHtml(name: string, confirmationUrl: string, newEmail: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Konfirmasi Ubah Email - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #09050f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background: linear-gradient(170deg, #1c1028 0%, #0f0a1a 50%, #09050f 100%); border-radius: 20px; border: 1px solid rgba(251, 191, 36, 0.12); box-shadow: 0 0 60px rgba(245, 158, 11, 0.06), 0 0 120px rgba(0,0,0,0.5); overflow: hidden;">
              
              <!-- Top Accent Bar - Blue-Purple-Gold -->
              <tr>
                <td style="height: 3px; background: linear-gradient(90deg, transparent, #3b82f6 30%, #8b5cf6 50%, #f59e0b 70%, transparent);"></td>
              </tr>

              <!-- Header -->
              <tr>
                <td style="padding: 36px 36px 8px 36px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25);">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #fbbf24; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 20px 36px 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.15) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 36px 32px 36px;">

                  <!-- Emoji Icon -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 52px; height: 52px; background: rgba(139, 92, 246, 0.1); border-radius: 50%; text-align: center; line-height: 52px;">
                        <span style="font-size: 26px;">📧</span>
                      </td>
                    </tr>
                  </table>

                  <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0; font-weight: 700; text-align: center;">
                    Ubah Email, ${name}? 🔄
                  </h2>
                  <p style="color: rgba(255,255,255,0.65); font-size: 15px; line-height: 1.7; margin: 0 0 16px 0; text-align: center;">
                    Kita nerima request buat ganti email akun kamu. Kamu mau ubah ke alamat ini:
                  </p>

                  <!-- New Email Display -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.12); border-radius: 14px; padding: 14px 18px; text-align: center;">
                        <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px;">Email Baru</p>
                        <p style="color: #fbbf24; font-size: 15px; font-weight: 700; margin: 0; word-break: break-all;">${newEmail}</p>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%); border-radius: 14px; box-shadow: 0 6px 28px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255,255,255,0.15);">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          ✅ Konfirmasi Ubah Email
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback Link -->
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
                    Tombol nggak bisa diklik? Salin link ini ke browser kamu:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.12); border-radius: 14px; padding: 10px 14px;">
                        <p style="color: #fbbf24; font-size: 11px; word-break: break-all; margin: 0; line-height: 1.5; text-align: center;">
                          ${confirmationUrl}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Security Warning -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
                    <tr>
                      <td style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 14px; padding: 14px 18px;">
                        <p style="color: rgba(255,255,255,0.55); font-size: 13px; line-height: 1.6; margin: 0;">
                          🔒 <strong style="color: #fca5a5;">Kalau ini bukan kamu</strong>, jangan klik link di atas. Langsung aja abaikan email ini — email kamu nggak akan berubah.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: rgba(255,255,255,0.3); font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                    ⏰ Link ini berlaku 24 jam aja ya.
                  </p>
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 36px 32px 36px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin: 0;">
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

// Welcome email after confirmation - Premium Design (emerald-gold accent)
export function getWelcomeEmailHtml(name: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Selamat Datang - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #09050f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background: linear-gradient(170deg, #1c1028 0%, #0f0a1a 50%, #09050f 100%); border-radius: 20px; border: 1px solid rgba(251, 191, 36, 0.12); box-shadow: 0 0 60px rgba(245, 158, 11, 0.06), 0 0 120px rgba(0,0,0,0.5); overflow: hidden;">
              
              <!-- Top Accent Bar - Emerald-Gold -->
              <tr>
                <td style="height: 3px; background: linear-gradient(90deg, transparent, #10b981 30%, #34d399 50%, #fbbf24 70%, transparent);"></td>
              </tr>

              <!-- Header -->
              <tr>
                <td style="padding: 36px 36px 8px 36px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25);">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #fbbf24; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 20px 36px 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.15) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 36px 32px 36px;">

                  <!-- Success Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 52px; height: 52px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; text-align: center; line-height: 52px;">
                        <span style="font-size: 26px;">🎉</span>
                      </td>
                    </tr>
                  </table>

                  <h2 style="color: #10b981; font-size: 16px; margin: 0 0 4px 0; font-weight: 700; text-align: center;">
                    ✅ EMAIL TERKONFIRMASI!
                  </h2>
                  <h3 style="color: #ffffff; font-size: 22px; margin: 0 0 12px 0; font-weight: 800; text-align: center;">
                    Selamat Datang, ${name}!
                  </h3>
                  <p style="color: rgba(255,255,255,0.65); font-size: 15px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                    Akun LuxTrade kamu udah aktif! Sekarang kamu bisa mulai catat trading, analisa performa, dan tingkatkan skill trading kamu bareng AI insights kami. Yuk langsung mulai! 🚀
                  </p>

                  <!-- Features Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.12); border-radius: 14px; padding: 20px 22px;">
                        <p style="color: #fbbf24; font-size: 13px; font-weight: 700; margin: 0 0 14px 0;">
                          ⚡ Yang bisa kamu lakukan sekarang:
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding: 4px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> <strong style="color: rgba(255,255,255,0.85);">Analisa Performa</strong> — pantau win rate & profit factor
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> <strong style="color: rgba(255,255,255,0.85);">Trading Journal</strong> — catat setiap transaksi kamu
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> <strong style="color: rgba(255,255,255,0.85);">AI Insights</strong> — tips personal dari AI buat tingkatkan trading
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%); border-radius: 14px; box-shadow: 0 6px 28px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255,255,255,0.15);">
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
                <td style="padding: 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 36px 32px 36px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin: 0;">
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

// Promotional email wrapper - Premium Design (gold-to-red accent for urgency)
export function getPromotionalEmailHtml(name: string, subject: string, htmlBody: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject} - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #09050f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background: linear-gradient(170deg, #1c1028 0%, #0f0a1a 50%, #09050f 100%); border-radius: 20px; border: 1px solid rgba(251, 191, 36, 0.12); box-shadow: 0 0 60px rgba(245, 158, 11, 0.06), 0 0 120px rgba(0,0,0,0.5); overflow: hidden;">
              
              <!-- Top Accent Bar - Gold-to-Red -->
              <tr>
                <td style="height: 3px; background: linear-gradient(90deg, transparent, #f59e0b 30%, #fbbf24 50%, #ef4444 70%, transparent);"></td>
              </tr>

              <!-- Header -->
              <tr>
                <td style="padding: 36px 36px 8px 36px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25);">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #fbbf24; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 20px 36px 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.15) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Greeting -->
              <tr>
                <td style="padding: 28px 36px 0 36px;">
                  <p style="color: rgba(255,255,255,0.65); font-size: 15px; line-height: 1.7; margin: 0;">
                    Hai ${name}, ada info penting nih buat kamu! 👇
                  </p>
                </td>
              </tr>

              <!-- Dynamic Content Area -->
              <tr>
                <td style="padding: 16px 36px 0 36px;">
                  ${htmlBody}
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 24px 36px 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 36px 32px 36px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin: 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                  <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin: 8px 0 0 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'}/settings" style="color: rgba(251, 191, 36, 0.5); text-decoration: underline;">Unsubscribe</a> dari email promosi
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

// Bulk unverified reminder - Premium Design (orange-gold accent, different tone)
export function getUnverifiedBulkReminderHtml(name: string, confirmationUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Akun Belum Verifikasi - LuxTrade</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #09050f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
          <td style="padding: 32px 16px;" align="center" valign="top">

            <!-- Main Card -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background: linear-gradient(170deg, #1c1028 0%, #0f0a1a 50%, #09050f 100%); border-radius: 20px; border: 1px solid rgba(251, 191, 36, 0.12); box-shadow: 0 0 60px rgba(245, 158, 11, 0.06), 0 0 120px rgba(0,0,0,0.5); overflow: hidden;">
              
              <!-- Top Accent Bar - Orange-Gold -->
              <tr>
                <td style="height: 3px; background: linear-gradient(90deg, transparent, #f97316 30%, #fbbf24 50%, #f97316 70%, transparent);"></td>
              </tr>

              <!-- Header -->
              <tr>
                <td style="padding: 36px 36px 8px 36px; text-align: center;">
                  <!-- Logo Badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px; text-align: center; line-height: 56px; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25);">
                        <span style="font-size: 28px;">👑</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="color: #fbbf24; font-size: 26px; margin: 0 0 4px 0; font-weight: 800; letter-spacing: -0.5px;">LuxTrade</h1>
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Premium Trading Journal</p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 20px 36px 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.15) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 28px 36px 32px 36px;">

                  <!-- Emoji Icon -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="width: 52px; height: 52px; background: rgba(249, 115, 22, 0.12); border-radius: 50%; text-align: center; line-height: 52px;">
                        <span style="font-size: 26px;">⏳</span>
                      </td>
                    </tr>
                  </table>

                  <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0; font-weight: 700; text-align: center;">
                    ${name}, Akun Kamu Menunggu! 🔔
                  </h2>
                  <p style="color: rgba(255,255,255,0.65); font-size: 15px; line-height: 1.7; margin: 0 0 6px 0; text-align: center;">
                    Kami notice akun kamu masih belum terverifikasi nih. Padahal semua fitur LuxTrade udah siap dipake — tinggal klik tombol verifikasi aja!
                  </p>
                  <p style="color: rgba(255,255,255,0.55); font-size: 14px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                    Gak mau kan ketinggalan fitur keren dari LuxTrade? Buruan verifikasi sekarang:
                  </p>

                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%); border-radius: 14px; box-shadow: 0 6px 28px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255,255,255,0.15);">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                          ✅ Verifikasi Sekarang
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback Link -->
                  <p style="color: rgba(255,255,255,0.35); font-size: 12px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
                    Tombol nggak bisa diklik? Salin link ini ke browser kamu:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                    <tr>
                      <td style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.12); border-radius: 14px; padding: 10px 14px;">
                        <p style="color: #fbbf24; font-size: 11px; word-break: break-all; margin: 0; line-height: 1.5; text-align: center;">
                          ${confirmationUrl}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Info Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
                    <tr>
                      <td style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.12); border-radius: 14px; padding: 18px 20px;">
                        <p style="color: #fbbf24; font-size: 13px; font-weight: 700; margin: 0 0 12px 0;">
                          🎯 Kenapa harus verifikasi?
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding: 3px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> Langsung akses semua fitur trading journal
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> Dapatkan AI insights personal buat trading kamu
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: rgba(255,255,255,0.6); font-size: 13px;">
                              <span style="color: #fbbf24; margin-right: 6px;">▸</span> Ikutan promo & dapatkan akses PRO eksklusif
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Expiry Notice -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 16px 0;">
                    <tr>
                      <td style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.12); border-radius: 14px; padding: 14px 18px;">
                        <p style="color: rgba(255,255,255,0.55); font-size: 13px; line-height: 1.6; margin: 0;">
                          ⏰ Link verifikasi ini berlaku <strong style="color: #fcd34d;">24 jam</strong>. Kalau udah expired, kamu bisa request ulang dari halaman login.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: rgba(255,255,255,0.3); font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                    Kalau kamu nggak merasa daftar di LuxTrade, abaikan email ini ya!
                  </p>
                </td>
              </tr>

              <!-- Footer Divider -->
              <tr>
                <td style="padding: 0 36px;">
                  <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);"></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 36px 32px 36px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0 0 4px 0;">
                    © ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: rgba(255,255,255,0.2); font-size: 10px; margin: 0;">
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
