'use client'

// ============================================
// Client-side Supabase configuration loader
// ============================================

interface SupabaseConfig {
  url: string
  anonKey: string | null
  isConfigured: boolean
}

let cachedConfig: SupabaseConfig | null = null
let fetchPromise: Promise<SupabaseConfig> | null = null

// ─── PERF: localStorage cache untuk config Supabase ─────────────────────────
// Dulu SETIAP reload fetch '/api/supabase/config' dulu (1 roundtrip network)
// sebelum client Supabase bisa dibuat → session check & dashboard selalu
// nunggu jaringan. Kini: kunjungan pertama simpan config ke localStorage;
// reload berikutnya baca instan dari cache (0ms) + revalidate diam-diam di
// background supaya tetap segar kalau key di-rotate. Offline → cache tetap
// terpakai (reload offline pun jalan).

const CONFIG_CACHE_KEY = 'luxtrade_sb_config_v2'
// FIX AUTH: cache v1 ('luxtrade_sb_config') pernah menyimpan LEGACY JWT key
// (zaman sebelum Supabase disable legacy API keys per 1 Nov 2025). Browser
// yang terlanjur ter-cache akan terus kirim key legacy → login gagal 401
// "Legacy API keys are disabled" sampai 24 jam. Naik versi cache key = semua
// cache lama otomatis yatim & diabaikan.
const CONFIG_CACHE_V1_LEGACY_KEY = 'luxtrade_sb_config'
const CONFIG_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 jam

/** Deteksi legacy JWT anon/service_role key (format eyJ... = sudah ditonogokan Supabase). */
export function isLegacySupabaseKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && key.startsWith('eyJ')
}

function readLocalConfigCache(): SupabaseConfig | null {
  if (typeof window === 'undefined') return null
  // Bersihkan cache v1 lama (bisa jadi berisi key legacy) — sekali saja.
  try { window.localStorage.removeItem(CONFIG_CACHE_V1_LEGACY_KEY) } catch {}
  try {
    const raw = window.localStorage.getItem(CONFIG_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { config?: SupabaseConfig; ts?: number }
    const cfg = parsed?.config
    if (!cfg?.url || !cfg.anonKey || !cfg.isConfigured) return null
    // FIX AUTH: cache yang berisi key legacy tidak boleh dipakai sama sekali.
    if (isLegacySupabaseKey(cfg.anonKey)) return null
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > CONFIG_CACHE_TTL) return null
    return cfg
  } catch {
    return null
  }
}

function writeLocalConfigCache(config: SupabaseConfig): void {
  if (typeof window === 'undefined') return
  // Hanya cache config yang BENAR-BENAR terkonfigurasi — jangan pernah
  // menyimpan hasil error/anonKey null (bisa bikin auth mati sampai TTL habis).
  if (!config.isConfigured || !config.anonKey) return
  // FIX AUTH: JANGAN PERNAH menyimpan legacy JWT key ke cache — ini sumber
  // login gagal 401 "Legacy API keys are disabled" selama 24 jam penuh.
  if (isLegacySupabaseKey(config.anonKey)) return
  try {
    window.localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ config, ts: Date.now() }))
  } catch {
    // storage penuh / private mode — biarkan, network path tetap jalan
  }
}

/**
 * Fetch Supabase configuration from the API endpoint.
 * This allows the config to be set at runtime in Cloudflare Pages.
 */
async function fetchSupabaseConfig(): Promise<SupabaseConfig> {
  try {
    const response = await fetch('/api/supabase/config', {
      cache: 'no-store' // Always fetch fresh config
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('[Supabase Config] API error:', errorData.error)
      return {
        url: 'https://klxkdrfsfcoankbaoejn.supabase.co',
        anonKey: null,
        isConfigured: false
      }
    }

    const data = await response.json()

    // FIX AUTH: server menembakkan key legacy (misconfig build) → tolak keras.
    // Jangan sampai key legacy masuk ke client Supabase / localStorage.
    if (isLegacySupabaseKey(data.anonKey)) {
      console.error(
        '[Supabase Config] ❌ Server mengirim LEGACY JWT key (sudah disabled Supabase). ' +
        'Login akan gagal 401. Perbaiki NEXT_PUBLIC_SUPABASE_ANON_KEY di build env ' +
        'menjadi sb_publishable_... lalu rebuild deploy.'
      )
      return {
        url: data.url || 'https://klxkdrfsfcoankbaoejn.supabase.co',
        anonKey: null,
        isConfigured: false
      }
    }

    console.log('[Supabase Config] Loaded from API:', {
      url: data.url,
      hasAnonKey: !!data.anonKey,
      isConfigured: data.isConfigured
    })

    return {
      url: data.url,
      anonKey: data.anonKey,
      isConfigured: data.isConfigured
    }
  } catch (error) {
    console.error('[Supabase Config] Failed to fetch config:', error)
    return {
      url: 'https://klxkdrfsfcoankbaoejn.supabase.co',
      anonKey: null,
      isConfigured: false
    }
  }
}

/**
 * Load Supabase configuration from multiple sources:
 * 1. Build-time env vars (process.env.NEXT_PUBLIC_*) - fallback
 * 2. API endpoint - primary source for Cloudflare Pages
 */
export async function loadSupabaseConfig(): Promise<SupabaseConfig> {
  // Return cached config if available
  if (cachedConfig && cachedConfig.isConfigured) {
    return cachedConfig
  }

  // PERF: instant path — localStorage cache (kunjungan berulang, 0 roundtrip)
  if (!cachedConfig) {
    const local = readLocalConfigCache()
    if (local) {
      cachedConfig = local
      // Revalidate diam-diam di background — kalau config di server berubah
      // (key rotate), cache lokal ikut segar untuk reload berikutnya.
      // Gagal (offline) → cache lokal tetap dipakai, tidak ada pun yang rusak.
      fetchSupabaseConfig()
        .then(fresh => {
          if (fresh.isConfigured) {
            cachedConfig = fresh
            writeLocalConfigCache(fresh)
          }
        })
        .catch(() => {})
      return local
    }
  }

  // If there's an ongoing fetch, return that promise
  if (fetchPromise) {
    return await fetchPromise
  }

  // Start fetching config from API
  fetchPromise = fetchSupabaseConfig()

  const config = await fetchPromise
  fetchPromise = null

  // Cache the config (memori + localStorage)
  cachedConfig = config
  writeLocalConfigCache(config)
  return config
}

/**
 * Get Supabase config synchronously from cache.
 * Returns null if config hasn't been loaded yet.
 */
export function getSupabaseConfigSync(): SupabaseConfig | null {
  return cachedConfig
}

/**
 * Clear cached config (useful for testing or re-initializing)
 */
export function clearSupabaseConfigCache(): void {
  cachedConfig = null
  fetchPromise = null
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(CONFIG_CACHE_KEY) } catch {}
  }
}