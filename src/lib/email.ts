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
      from: 'LuxTrade <noreply@luxtrade.id>',
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

// Email confirmation template
export function getConfirmationEmailHtml(name: string, confirmationUrl: string) {
  return `
    <!DOCTYPE html>
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
                  <h2 style="color: #ffffff; font-size: 22px; margin: 0 0 20px 0; font-weight: 600;">
                    Halo ${name}! 👋
                  </h2>
                  <p style="color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    Terima kasih telah mendaftar di LuxTrade. Untuk memulai perjalanan trading Anda, silakan konfirmasi alamat email Anda dengan menekan tombol di bawah ini:
                  </p>
                  
                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);">
                        <a href="${confirmationUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                          Konfirmasi Email
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                    Atau salin link berikut ke browser Anda:
                  </p>
                  <p style="color: #f59e0b; font-size: 13px; word-break: break-all; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin: 0 0 20px 0;">
                    ${confirmationUrl}
                  </p>

                  <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0;">
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
                    Jika Anda tidak merasa mendaftar di LuxTrade, mohon abaikan email ini.
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
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://luxtrade.id'}/dashboard" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
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
