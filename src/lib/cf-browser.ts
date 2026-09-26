/**
 * Browser Rendering Utility — PDF generation, server-side screenshots
 *
 * Uses Cloudflare Browser Rendering (Puppeteer-compatible) for:
 * - Generating PDF reports (equity curve, trade summary)
 * - Taking screenshots of trade cards for sharing
 * - Server-side rendering of charts for OG images
 */

import { getCloudflareEnv, type CloudflareBindings } from './cloudflare-bindings'

/**
 * Check if Browser Rendering binding is available.
 */
export function isBrowserAvailable(request: Request): boolean {
  const env = getCloudflareEnv(request)
  return !!env?.ai_run
}

/**
 * Generate a PDF from a URL using Browser Rendering.
 * Returns the PDF as an ArrayBuffer.
 */
export async function generatePDF(
  request: Request,
  url: string,
  options: {
    format?: 'A4' | 'Letter'
    landscape?: boolean
    printBackground?: boolean
    margin?: { top?: string; bottom?: string; left?: string; right?: string }
  } = {}
): Promise<ArrayBuffer | null> {
  const env = getCloudflareEnv(request)
  if (!env?.ai_run) return null

  try {
    const browser = await env.ai_run
    const page = await browser.newPage()

    await page.goto(url, { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format: options.format ?? 'A4',
      landscape: options.landscape ?? false,
      printBackground: options.printBackground ?? true,
      margin: options.margin ?? {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm',
      },
    })

    await browser.close()
    return pdf
  } catch (error) {
    console.error('[CF Browser] PDF generation error:', error)
    return null
  }
}

/**
 * Take a screenshot of a URL using Browser Rendering.
 * Returns the screenshot as an ArrayBuffer (PNG by default).
 */
export async function takeScreenshot(
  request: Request,
  url: string,
  options: {
    width?: number
    height?: number
    fullPage?: boolean
    type?: 'png' | 'jpeg'
  } = {}
): Promise<ArrayBuffer | null> {
  const env = getCloudflareEnv(request)
  if (!env?.ai_run) return null

  try {
    const browser = await env.ai_run
    const page = await browser.newPage()

    await page.setViewportSize({
      width: options.width ?? 1200,
      height: options.height ?? 630,
    })

    await page.goto(url, { waitUntil: 'networkidle0' })

    const screenshot = await page.screenshot({
      fullPage: options.fullPage ?? false,
      type: options.type ?? 'png',
    })

    await browser.close()
    return screenshot
  } catch (error) {
    console.error('[CF Browser] Screenshot error:', error)
    return null
  }
}
