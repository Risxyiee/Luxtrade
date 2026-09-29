import { NextResponse } from 'next/server'

export async function GET() {
  // Static manifest content — avoids fs/promises and process.cwd() which crash on CF Workers
  const manifest = {
    id: "/?source=pwa",
    dir: "ltr",
    name: "LuxTradee - AI Trading Journal",
    short_name: "LuxTradee",
    description: "Trading journal dengan AI untuk trader Indonesia. Screenshot trade dari MT4/MT5, AI auto-extract data & deteksi pola kesalahan berulang.",
    start_url: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#050507",
    theme_color: "#050507",
    scope: "/",
    scope_extensions: [] as { origin: string }[],
    lang: "id",
    categories: ["finance", "productivity", "utilities"],
    iarc_rating_id: "e84b072d-51a0-4a3b-8c55-c1a1c1a1c1a1",
    icons: [
      { src: "/icon-72x72.png", sizes: "72x72", type: "image/png", purpose: "any" },
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-1024x1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      { src: "/screenshot-dashboard-mobile-v2.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow", label: "Dashboard mobile view with equity curve and analytics" },
      { src: "/screenshot-dashboard-v2.png", sizes: "1080x1920", type: "image/png", form_factor: "wide", label: "Dashboard desktop view with equity curve and analytics" },
      { src: "/screenshot-trades-v2.png", sizes: "1080x1920", type: "image/png", form_factor: "wide", label: "Trade log with AI analysis" },
      { src: "/screenshot-calendar-v2.png", sizes: "1080x1920", type: "image/png", form_factor: "wide", label: "Economic calendar integration" },
    ],
    shortcuts: [
      { name: "Log Trade", short_name: "Trade", url: "/dashboard?action=log-trade", icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Dashboard", short_name: "Home", url: "/dashboard", icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }] },
      { name: "AI Analysis", short_name: "AI", url: "/dashboard?action=ai-analyze", icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Journal", short_name: "Journal", url: "/dashboard?action=journal", icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }] },
    ],
    share_target: {
      action: "/dashboard?action=import-trade",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "trade_name",
        text: "trade_notes",
        url: "trade_url",
        files: [
          { name: "screenshot", accept: ["image/*", ".png", ".jpg", ".jpeg", ".webp"] },
          { name: "trade_file", accept: ["text/csv", "text/html", ".csv", ".html", ".json"] },
        ],
      },
    },
    file_handlers: [
      {
        action: "/dashboard?action=import-file",
        name: "Import Trade Data",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
        accept: {
          "text/csv": [".csv"],
          "text/html": [".html"],
          "application/json": [".json"],
          "application/vnd.ms-excel": [".xls"],
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
        },
        launch_type: "single-client",
      },
      {
        action: "/dashboard?action=view-screenshot",
        name: "View Trade Screenshot",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
        accept: {
          "image/png": [".png"],
          "image/jpeg": [".jpg", ".jpeg"],
          "image/webp": [".webp"],
        },
        launch_type: "single-client",
      },
    ],
    launch_handler: {
      client_mode: "focus-existing",
      navigate_existing_client: "always",
    },
    protocol_handlers: [
      { protocol: "web+luxtrade", url: "/dashboard?action=deep-link&uri=%s" },
      { protocol: "web+trade", url: "/dashboard?action=import-trade&uri=%s" },
    ],
    widgets: [
      {
        name: "LuxTradee Summary", short_name: "Summary", description: "Quick overview of your trading performance and today's activity",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
        action: "/dashboard?widget=summary", display: "standalone", theme_color: "#050507", background_color: "#050507",
        widget_display: "home-screen", max_display: 1, tag: "luxtradee-summary-widget", ms_ac_template: "/widget-template.json", ms_ac_data: "/api/widget-data/summary",
      },
      {
        name: "Equity Curve", short_name: "Equity", description: "Shows your equity curve and today's P&L at a glance",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
        action: "/dashboard?widget=equity", display: "standalone", theme_color: "#050507", background_color: "#050507",
        widget_display: "home-screen", max_display: 1, tag: "equity-curve-widget", ms_ac_template: "/widget-template.json", ms_ac_data: "/api/widget-data/equity",
      },
      {
        name: "Win Rate", short_name: "WinRate", description: "Shows your current win rate and recent trade stats",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
        action: "/dashboard?widget=winrate", display: "standalone", theme_color: "#050507", background_color: "#050507",
        widget_display: "home-screen", max_display: 1, tag: "win-rate-widget", ms_ac_template: "/widget-template.json", ms_ac_data: "/api/widget-data/winrate",
      },
    ],
    edge_side_panel: { preferred_width: 400 },
    note_taking: { new_note_url: "/dashboard?action=new-journal-entry" },
    related_applications: [
      { platform: "play", url: "https://play.google.com/store/apps/details?id=web.id.luxtradee.twa", id: "web.id.luxtradee.twa" },
    ],
    prefer_related_applications: false,
  }

  // ─── Scope Extensions ──────────────────────────────────────────────────────
  // Per W3C spec: each entry must be a full origin (NO wildcards).
  // These origins are considered in-scope for the PWA.
  // Navigation to these domains stays within the PWA window
  // (no browser address bar shown inside standalone mode).

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  const scopeExtensions: { origin: string }[] = [
    // Primary production domain
    { origin: 'https://luxtradee.web.id' },
    // Cloudflare Workers preview domain
    { origin: 'https://luxtradee.pages.dev' },
    // Supabase Auth & API (redirects after OAuth login)
    { origin: 'https://klxkdrfsfcoankbaoejn.supabase.co' },
    // Google OAuth redirect
    { origin: 'https://accounts.google.com' },
    // Midtrans payment gateway (redirects during checkout)
    { origin: 'https://app.sandbox.midtrans.com' },
    { origin: 'https://app.midtrans.com' },
    // Discord OAuth
    { origin: 'https://discord.com' },
  ]

  // Add Supabase URL from env var if it differs from the known one
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl)
      const envOrigin = url.origin
      if (!scopeExtensions.some(e => e.origin === envOrigin)) {
        scopeExtensions.push({ origin: envOrigin })
      }
    } catch {
      // Ignore malformed env var
    }
  }

  manifest.scope_extensions = scopeExtensions

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
