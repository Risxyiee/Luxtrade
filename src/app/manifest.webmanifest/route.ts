import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  // Read the static manifest as base template
  const manifestPath = join(process.cwd(), 'public', 'manifest.webmanifest')
  const raw = await readFile(manifestPath, 'utf-8')
  const manifest = JSON.parse(raw)

  // Resolve Supabase origin from environment variable
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  const scopeExtensions: { origin: string }[] = [
    { origin: 'https://*.luxtradee.web.id' },
  ]

  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl)
      // Exact Supabase project origin (e.g. https://abcdefghij.supabase.co)
      scopeExtensions.push({ origin: url.origin })
    } catch {
      // Fallback to wildcard if env var is malformed
      scopeExtensions.push({ origin: 'https://*.supabase.co' })
    }
  } else {
    // No env var — wildcard covers any Supabase project
    scopeExtensions.push({ origin: 'https://*.supabase.co' })
  }

  manifest.scope_extensions = scopeExtensions

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
