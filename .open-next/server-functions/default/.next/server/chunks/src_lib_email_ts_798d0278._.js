module.exports=[92749,e=>{"use strict";async function t(){let t=process.env.RESEND_API_KEY;if(!t)return null;let{Resend:a}=await e.A(36043);return new a(t)}async function a({to:e,subject:a,html:i,replyTo:r}){let n=await t();if(!n)return{success:!1,error:"Email service not configured"};try{let t={from:"LuxTrade <noreply@luxtradee.web.id>",to:e,subject:a,html:i};r&&(t.replyTo=r);let{data:l,error:o}=await n.emails.send(t);if(o)return{success:!1,error:o};return{success:!0,data:l}}catch(e){return{success:!1,error:e}}}async function i({to:e,subject:i,templateId:r,templateParams:n,fallbackHtml:l}){let o=await t();if(!o)return{success:!1,error:"Email service not configured"};if(!r||r.startsWith("your_"))return a({to:e,subject:i,html:l});try{let{data:t,error:d}=await o.emails.send({from:"LuxTrade <noreply@luxtradee.web.id>",to:e,subject:i,templateId:r,templateParams:n});if(d)return a({to:e,subject:i,html:l});return{success:!0,data:t}}catch(t){return a({to:e,subject:i,html:l})}}function r(e,t){return`
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
                    Selamat Datang, ${e}! ✨
                  </h2>
                  <p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                    Akun LuxTrade kamu udah jadi! Tinggal satu langkah lagi — klik tombol di bawah buat verifikasi email dan langsung mulai trading.
                  </p>
                  
                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                        <a href="${t}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
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
                          <a href="${t}" style="color: #b45309; text-decoration: underline;">${t}</a>
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
                    \xa9 ${new Date().getFullYear()} LuxTrade. All rights reserved.
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
  `}function n(e,t){return`
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
                    Lupa Password, ${e}?
                  </h2>
                  <p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
                    Kami terima permintaan reset password buat akun kamu. Klik tombol di bawah buat bikin password baru:
                  </p>
                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px;">
                        <a href="${t}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
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
                          <a href="${t}" style="color: #b45309; text-decoration: underline;">${t}</a>
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
                    \xa9 ${new Date().getFullYear()} LuxTrade. All rights reserved.
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
  `}function l(e,t,a){return`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${t} - LuxTrade</title>
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
                    Hai ${e}, ada info penting nih buat kamu! 👇
                  </p>
                </td>
              </tr>

              <!-- Dynamic Content Area -->
              <tr>
                <td style="padding: 16px 40px 0 40px;">
                  ${a}
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
                    \xa9 ${new Date().getFullYear()} LuxTrade. All rights reserved.
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 0;">
                    Email ini dikirim dari noreply@luxtradee.web.id
                  </p>
                  <p style="color: #8b8da0; font-size: 10px; margin: 8px 0 0 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||"https://luxtradee.web.id"}/settings" style="color: #b45309; text-decoration: underline;">Unsubscribe</a> dari email promosi
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `}function o(e,t,a){return`
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
                    ${e}, Ada Promo Spesial Buat Kamu! 🎉
                  </h2>
                  <p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 6px 0; text-align: center;">
                    Akun kamu belum terverifikasi, tapi tenang — kami punya hadiah spesial! Verifikasi sekarang dan gunakan kode promo eksklusif untuk akses PRO.
                  </p>

                  <!-- Promo Code Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; text-align: center; border: 2px dashed #f59e0b;">
                        <p style="color: #b45309; font-size: 12px; font-weight: 700; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Kode Promo Kamu</p>
                        <p style="color: #1a1a2e; font-size: 28px; font-weight: 800; margin: 0 0 4px 0; letter-spacing: 3px; font-family: 'Courier New', monospace;">${a}</p>
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
                        <a href="${t}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
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
                          <a href="${t}" style="color: #b45309; text-decoration: underline;">${t}</a>
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
                              <span style="color: #16a34a; margin-right: 6px;">✓</span> Gunakan kode promo <strong>${a}</strong> untuk diskon PRO
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
                    \xa9 ${new Date().getFullYear()} LuxTrade. All rights reserved.
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
  `}function d(e,t){return`
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
                    ${e}, Akun Kamu Menunggu! 🔔
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
                        <a href="${t}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
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
                          <a href="${t}" style="color: #b45309; text-decoration: underline;">${t}</a>
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
                    \xa9 ${new Date().getFullYear()} LuxTrade. All rights reserved.
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
  `}process.env.NEXT_PUBLIC_SITE_URL,e.s(["getConfirmationEmailHtml",()=>r,"getPromotionalEmailHtml",()=>l,"getResetPasswordEmailHtml",()=>n,"getUnverifiedBulkReminderHtml",()=>d,"getVerificationPromoEmailHtml",()=>o,"sendEmail",()=>a,"sendEmailFromTemplate",()=>i])}];

//# sourceMappingURL=src_lib_email_ts_798d0278._.js.map