import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  // Read the static manifest as base template
  const manifestPath = join(process.cwd(), 'public', 'manifest.webmanifest')
  const raw = await readFile(manifestPath, 'utf-8')
  const manifest = JSON.parse(raw)

  // Resolve Supabase origin — prefer hardcoded known origin, then env var, then wildcard
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const knownSupabaseOrigin = 'https://klxkdrfsfcoankbaoejn.supabase.co'

  const scopeExtensions: { origin: string }[] = [
    { origin: 'https://*.luxtradee.web.id' },
    { origin: knownSupabaseOrigin },
  ]

  // Also add env var origin if it differs from the known one
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl)
      if (url.origin !== knownSupabaseOrigin) {
        scopeExtensions.push({ origin: url.origin })
      }
    } catch {
      // Ignore malformed env var — known origin already covers it
    }
  }

  // Replace static scope_extensions with runtime-resolved ones
  manifest.scope_extensions = scopeExtensions

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
