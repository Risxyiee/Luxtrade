/**
 * Webhook Helper Functions
 * Get webhook URLs for Myfxbook and FxBlue integration
 */

export function getMyfxbookWebhookURL(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://luxtrade-jade.vercel.app'
  return `${baseUrl}/api/webhook/myfxbook`
}

export function getFxBlueWebhookURL(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://luxtrade-jade.vercel.app'
  return `${baseUrl}/api/webhook/fxblue`
}

export function getWebhookInstructions(service: 'myfxbook' | 'fxblue'): {
  title: string
  steps: string[]
  webhookUrl: string
} {
  const webhookUrl = service === 'myfxbook' ? getMyfxbookWebhookURL() : getFxBlueWebhookURL()

  if (service === 'myfxbook') {
    return {
      title: 'Myfxbook Webhook Setup',
      steps: [
        '1. Login to your Myfxbook account',
        '2. Go to "Portfolio" → "Add Account"',
        '3. Enter your MT5 Account ID, Investor Password, and Broker Server',
        '4. After account is verified, go to "Account Settings"',
        '5. Find "Webhook" or "Notifications" section',
        '6. Enter this Webhook URL: ' + webhookUrl,
        '7. Select events: "New Trade", "Trade Closed", "Trade Modified"',
        '8. Save settings',
        '9. Your trades will now sync automatically to Luxtrade!'
      ],
      webhookUrl
    }
  }

  return {
    title: 'FxBlue Webhook Setup',
    steps: [
      '1. Login to your FxBlue account',
      '2. Go to "Accounts" → "Add Account"',
      '3. Enter your MT5 Account ID, Investor Password, and Broker Server',
      '4. After account is verified, go to "Account Settings"',
      '5. Find "Webhook" or "API" section',
      '6. Enter this Webhook URL: ' + webhookUrl,
      '7. Select events: "New Trade", "Trade Closed", "Trade Modified"',
      '8. Save settings',
      '9. Your trades will now sync automatically to Luxtrade!'
    ],
    webhookUrl
  }
}
