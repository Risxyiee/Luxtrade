import { sendEmail } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'

interface EmailCampaign {
  id: string
  name: string
  subject: string
  template: string
  language?: 'id' | 'en'
}

interface User {
  id: string
  email: string
  full_name?: string | null
  created_at: string
  last_login_at?: string | null
  language?: string
  email_marketing_consent?: boolean
}

// Email campaign templates
const campaigns: EmailCampaign[] = [
  {
    id: 'welcome-series-1',
    name: 'Welcome Email - Getting Started',
    subject: 'Welcome to LuxTrade! Let Ace Your Prop Firm Challenge',
    template: 'welcome',
    language: 'en'
  },
  {
    id: 're-engagement-1',
    name: 'Re-engagement - First Trade',
    subject: 'Your First Trade is Waiting - Let Get Started',
    template: 'first-trade',
    language: 'en'
  },
  {
    id: 're-engagement-2',
    name: 'Re-engagement - AI Analysis',
    subject: 'Discover Your Trading Patterns with AI',
    template: 'ai-analysis',
    language: 'en'
  },
  {
    id: 're-engagement-3',
    name: 'Re-engagement - Prop Firm Guard',
    subject: 'Stop Drawdown Breaches with Real-Time Monitoring',
    template: 'prop-firm-guard',
    language: 'en'
  },
  {
    id: 'promo-upgrade',
    name: 'Promo - Upgrade to Pro',
    subject: 'Unlock Unlimited Trades & AI - Limited Time Offer',
    template: 'upgrade-promo',
    language: 'en'
  }
]

function getEmailHtml(template: string, userName: string | null, data: Record<string, any> = {}): string {
  const name = userName || 'Trader'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'

  const templates: Record<string, string> = {
    welcome: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to LuxTrade</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #050507; color: white; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 40px; }
            .logo { font-size: 28px; font-weight: bold; background: linear-gradient(to right, #3b82f6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 30px; margin-bottom: 24px; }
            .card h2 { color: #3b82f6; font-size: 22px; margin: 0 0 16px 0; }
            .card p { color: #9ca3af; line-height: 1.6; margin: 0 0 16px 0; }
            .card ul { color: #9ca3af; line-height: 1.8; padding-left: 20px; margin: 0; }
            .btn { display: inline-block; background: linear-gradient(to right, #3b82f6, #06b6d4); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
            .btn:hover { opacity: 0.9; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
            .stats { display: flex; gap: 20px; margin: 20px 0; }
            .stat { flex: 1; text-align: center; background: rgba(59,130,246,0.1); padding: 16px; border-radius: 8px; }
            .stat-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
            .stat-label { font-size: 12px; color: #9ca3af; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">✨ LuxTrade</div>
            </div>
            <div class="card">
              <h2>Hi ${name}! 👋</h2>
              <p>Welcome to LuxTrade - your AI-powered trading journal designed specifically for prop firm traders.</p>
              <p>We're here to help you stop drawdown breaches and pass your FTMO, TFT, or MFF challenges consistently.</p>
              <div class="stats">
                <div class="stat">
                  <div class="stat-value">10</div>
                  <div class="stat-label">Free Trades/Month</div>
                </div>
                <div class="stat">
                  <div class="stat-value">10</div>
                  <div class="stat-label">Free AI Queries</div>
                </div>
                <div class="stat">
                  <div class="stat-value">5</div>
                  <div class="stat-label">Prop Firms Supported</div>
                </div>
              </div>
              <a href="${baseUrl}/dashboard" class="btn">Start Logging Trades →</a>
            </div>
            <div class="card">
              <h2>What You Can Do Right Now:</h2>
              <ul>
                <li>📊 Upload your MT5 trade history to auto-import trades</li>
                <li>🎯 Set up your prop firm challenge parameters (FTMO, TFT, MFF)</li>
                <li>🤖 Get AI insights on your trading patterns</li>
                <li>📈 Track drawdown in real-time to avoid breaches</li>
              </ul>
            </div>
            <div class="footer">
              <p>Questions? Join our Discord community: <a href="https://discord.gg/JwMxsmMqG" style="color: #3b82f6;">discord.gg/JwMxsmMqG</a></p>
              <p style="margin-top: 10px;">© 2025 LuxTrade. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    'first-trade': `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your First Trade</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #050507; color: white; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 40px; }
            .logo { font-size: 28px; font-weight: bold; background: linear-gradient(to right, #3b82f6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 30px; margin-bottom: 24px; }
            .card h2 { color: #3b82f6; font-size: 22px; margin: 0 0 16px 0; }
            .card p { color: #9ca3af; line-height: 1.6; margin: 0 0 16px 0; }
            .card ul { color: #9ca3af; line-height: 1.8; padding-left: 20px; margin: 0; }
            .btn { display: inline-block; background: linear-gradient(to right, #3b82f6, #06b6d4); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
            .feature { display: flex; gap: 12px; margin-bottom: 16px; align-items: start; }
            .feature-icon { font-size: 24px; }
            .feature-text { flex: 1; }
            .feature-text h4 { margin: 0 0 4px 0; color: white; }
            .feature-text p { margin: 0; color: #9ca3af; font-size: 14px; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">✨ LuxTrade</div>
            </div>
            <div class="card">
              <h2>Hi ${name}! 🚀</h2>
              <p>We noticed you haven't logged your first trade yet. Let's get started!</p>
              <p>Every successful prop firm trader knows: <strong>what gets measured, gets managed.</strong></p>
            </div>
            <div class="card">
              <h2>Why Log Your Trades?</h2>
              <div class="feature">
                <div class="feature-icon">📊</div>
                <div class="feature-text">
                  <h4>Track Your Edge</h4>
                  <p>See which setups actually work for you</p>
                </div>
              </div>
              <div class="feature">
                <div class="feature-icon">🎯</div>
                <div class="feature-text">
                  <h4>Avoid Breaches</h4>
                  <p>Monitor drawdown in real-time</p>
                </div>
              </div>
              <div class="feature">
                <div class="feature-icon">🤖</div>
                <div class="feature-text">
                  <h4>AI Insights</h4>
                  <p>Get personalized improvement suggestions</p>
                </div>
              </div>
              <a href="${baseUrl}/dashboard" class="btn">Log Your First Trade →</a>
            </div>
            <div class="card">
              <p style="color: #9ca3af; font-size: 14px;">💡 <strong>Pro tip:</strong> Even if you're trading demo accounts, logging trades now will build valuable data for when you start your prop firm challenge.</p>
            </div>
            <div class="footer">
              <p>Questions? Join our Discord community: <a href="https://discord.gg/JwMxsmMqG" style="color: #3b82f6;">discord.gg/JwMxsmMqG</a></p>
              <p style="margin-top: 10px;">© 2025 LuxTrade. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    'ai-analysis': `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>AI Analysis Insights</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #050507; color: white; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 40px; }
            .logo { font-size: 28px; font-weight: bold; background: linear-gradient(to right, #3b82f6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 30px; margin-bottom: 24px; }
            .card h2 { color: #3b82f6; font-size: 22px; margin: 0 0 16px 0; }
            .card p { color: #9ca3af; line-height: 1.6; margin: 0 0 16px 0; }
            .insight-box { background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.2); border-radius: 12px; padding: 20px; margin: 16px 0; }
            .insight-box h4 { color: #a855f7; margin: 0 0 8px 0; }
            .btn { display: inline-block; background: linear-gradient(to right, #3b82f6, #06b6d4); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">✨ LuxTrade</div>
            </div>
            <div class="card">
              <h2>Hi ${name}! 🤖</h2>
              <p>Have you tried our AI-powered analysis yet?</p>
              <p>Our AI reviews your trades and identifies patterns that might be holding you back from passing your prop firm challenge.</p>
            </div>
            <div class="card">
              <h2>What AI Analysis Reveals:</h2>
              <div class="insight-box">
                <h4>🔴 Revenge Trading Patterns</h4>
                <p style="color: #9ca3af; font-size: 14px; margin: 0;">After losses, do you immediately re-enter? This is the #1 cause of drawdown breaches.</p>
              </div>
              <div class="insight-box">
                <h4>🟡 Emotional Triggers</h4>
                <p style="color: #9ca3af; font-size: 14px; margin: 0;">Learn which emotions correlate with your worst trades.</p>
              </div>
              <div class="insight-box">
                <h4>🟢 Your Winning Edge</h4>
                <p style="color: #9ca3af; font-size: 14px; margin: 0;">Discover which setups and timeframes work best for you.</p>
              </div>
              <a href="${baseUrl}/dashboard" class="btn">Try AI Analysis →</a>
            </div>
            <div class="footer">
              <p>Questions? Join our Discord community: <a href="https://discord.gg/JwMxsmMqG" style="color: #3b82f6;">discord.gg/JwMxsmMqG</a></p>
              <p style="margin-top: 10px;">© 2025 LuxTrade. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    'prop-firm-guard': `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Prop Firm Guard</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #050507; color: white; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 40px; }
            .logo { font-size: 28px; font-weight: bold; background: linear-gradient(to right, #3b82f6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 30px; margin-bottom: 24px; }
            .card h2 { color: #3b82f6; font-size: 22px; margin: 0 0 16px 0; }
            .card p { color: #9ca3af; line-height: 1.6; margin: 0 0 16px 0; }
            .alert { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; padding: 20px; margin: 16px 0; }
            .alert h4 { color: #ef4444; margin: 0 0 8px 0; }
            .alert p { color: #9ca3af; font-size: 14px; margin: 0; }
            .btn { display: inline-block; background: linear-gradient(to right, #3b82f6, #06b6d4); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
            .features { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
            .feature { background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; text-align: center; }
            .feature-icon { font-size: 28px; margin-bottom: 8px; }
            .feature-title { font-size: 14px; font-weight: 600; color: white; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">✨ LuxTrade</div>
            </div>
            <div class="card">
              <h2>Hi ${name}! 🛡️</h2>
              <p>Don't let a drawdown breach destroy your prop firm challenge progress.</p>
            </div>
            <div class="card">
              <h2>The #1 Reason Traders Fail Prop Firm Challenges:</h2>
              <div class="alert">
                <h4>⚠️ Drawdown Breach</h4>
                <p>Most traders fail not because they can't trade, but because they breach the 5% daily or 10% max drawdown limits.</p>
              </div>
              <p style="color: #9ca3af;">LuxTrade monitors your drawdown in real-time and sends alerts before you're in danger zone.</p>
            </div>
            <div class="card">
              <h2>Prop Firms Supported:</h2>
              <div class="features">
                <div class="feature">
                  <div class="feature-icon">🎯</div>
                  <div class="feature-title">FTMO</div>
                </div>
                <div class="feature">
                  <div class="feature-icon">⚡</div>
                  <div class="feature-title">TFT</div>
                </div>
                <div class="feature">
                  <div class="feature-icon">💎</div>
                  <div class="feature-title">MFF</div>
                </div>
                <div class="feature">
                  <div class="feature-icon">🚀</div>
                  <div class="feature-title">FundedNext</div>
                </div>
              </div>
              <a href="${baseUrl}/dashboard" class="btn">Set Up Drawdown Guard →</a>
            </div>
            <div class="footer">
              <p>Questions? Join our Discord community: <a href="https://discord.gg/JwMxsmMqG" style="color: #3b82f6;">discord.gg/JwMxsmMqG</a></p>
              <p style="margin-top: 10px;">© 2025 LuxTrade. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    'upgrade-promo': `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Upgrade to Pro</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #050507; color: white; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 40px; }
            .logo { font-size: 28px; font-weight: bold; background: linear-gradient(to right, #3b82f6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 30px; margin-bottom: 24px; }
            .card h2 { color: #3b82f6; font-size: 22px; margin: 0 0 16px 0; }
            .card p { color: #9ca3af; line-height: 1.6; margin: 0 0 16px 0; }
            .promo { background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(6,182,212,0.2)); border: 2px solid #3b82f6; border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center; }
            .promo h3 { color: #fff; font-size: 28px; margin: 0 0 8px 0; }
            .promo p { color: #9ca3af; margin: 0 0 16px 0; }
            .feature-list { list-style: none; padding: 0; margin: 0; }
            .feature-list li { padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 12px; }
            .feature-list li:last-child { border-bottom: none; }
            .feature-list li::before { content: "✓"; color: #22c55e; font-weight: bold; font-size: 18px; }
            .btn { display: inline-block; background: linear-gradient(to right, #3b82f6, #06b6d4); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
            .btn:hover { opacity: 0.9; }
            .compare { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
            .compare-box { padding: 16px; border-radius: 8px; }
            .compare-free { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
            .compare-pro { background: rgba(59,130,246,0.1); border: 1px solid #3b82f6; }
            .compare-title { font-weight: 600; margin-bottom: 12px; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">✨ LuxTrade</div>
            </div>
            <div class="card">
              <h2>Hi ${name}! 🚀</h2>
              <p>Ready to supercharge your prop firm trading journey?</p>
            </div>
            <div class="promo">
              <h3>Upgrade to Pro</h3>
              <p>Unlock unlimited features and accelerate your path to funding</p>
            </div>
            <div class="card">
              <div class="compare">
                <div class="compare-box compare-free">
                  <div class="compare-title">Free</div>
                  <ul style="list-style: none; padding: 0; margin: 0; color: #9ca3af; font-size: 14px;">
                    <li style="padding: 8px 0;">10 trades/month</li>
                    <li style="padding: 8px 0;">10 AI queries</li>
                    <li style="padding: 8px 0;">Basic features</li>
                  </ul>
                </div>
                <div class="compare-box compare-pro">
                  <div class="compare-title">Pro</div>
                  <ul style="list-style: none; padding: 0; margin: 0; color: #9ca3af; font-size: 14px;">
                    <li style="padding: 8px 0;">✓ Unlimited trades</li>
                    <li style="padding: 8px 0;">✓ Unlimited AI</li>
                    <li style="padding: 8px 0;">✓ Priority support</li>
                  </ul>
                </div>
              </div>
              <h2>Pro Features:</h2>
              <ul class="feature-list">
                <li>Unlimited trade logging</li>
                <li>Unlimited AI analysis</li>
                <li>Prop firm challenge templates (FTMO, TFT, MFF)</li>
                <li>Real-time drawdown alerts</li>
                <li>Advanced analytics & reports</li>
                <li>Export to Excel/PDF</li>
              </ul>
              <a href="${baseUrl}/#pricing" class="btn">Upgrade Now →</a>
            </div>
            <div class="footer">
              <p>Questions? Join our Discord community: <a href="https://discord.gg/JwMxsmMqG" style="color: #3b82f6;">discord.gg/JwMxsmMqG</a></p>
              <p style="margin-top: 10px;">© 2025 LuxTrade. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  return templates[template] || templates['welcome']
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const campaignId = searchParams.get('campaign')
    const testEmail = searchParams.get('test')

    const supabase = createClient()

    if (action === 'list') {
      return Response.json({
        campaigns,
        message: 'Available email campaigns'
      })
    }

    if (action === 'send' && campaignId) {
      const campaign = campaigns.find(c => c.id === campaignId)
      if (!campaign) {
        return Response.json({ error: 'Campaign not found' }, { status: 404 })
      }

      // Fetch users who have consented to email marketing
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, full_name, created_at, last_login_at, language')
        .eq('email_marketing_consent', true)

      if (usersError) {
        console.error('Error fetching users:', usersError)
        return Response.json({ error: 'Failed to fetch users' }, { status: 500 })
      }

      const results = []
      const batchSize = 10

      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize)
        const emailPromises = batch.map(async (user: User) => {
          const html = getEmailHtml(campaign.template, user.full_name)
          const result = await sendEmail({
            to: user.email,
            subject: campaign.subject,
            html
          })
          return {
            userId: user.id,
            email: user.email,
            success: result.success,
            error: result.error
          }
        })

        const batchResults = await Promise.all(emailPromises)
        results.push(...batchResults)

        // Wait 1 second between batches to respect rate limits
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length

      return Response.json({
        campaign: campaign.name,
        totalUsers: users.length,
        sent: successful,
        failed,
        results
      })
    }

    if (action === 'test' && campaignId && testEmail) {
      const campaign = campaigns.find(c => c.id === campaignId)
      if (!campaign) {
        return Response.json({ error: 'Campaign not found' }, { status: 404 })
      }

      const html = getEmailHtml(campaign.template, testEmail.split('@')[0])
      const result = await sendEmail({
        to: testEmail,
        subject: `[TEST] ${campaign.subject}`,
        html
      })

      return Response.json({
        campaign: campaign.name,
        to: testEmail,
        success: result.success,
        error: result.error
      })
    }

    return Response.json({
      error: 'Invalid action. Use: list, send?campaign=id, or test?campaign=id&test=email@example.com'
    }, { status: 400 })

  } catch (error) {
    console.error('Email campaign error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}