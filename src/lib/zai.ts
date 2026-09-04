import ZAI, { type CreateChatCompletionVisionBody } from 'z-ai-web-dev-sdk'

interface ZAIConfig {
  baseUrl: string
  apiKey: string
  chatId: string
  token: string
  userId: string
}

function loadConfigFromEnv(): ZAIConfig | null {
  const baseUrl = process.env.ZAI_BASE_URL
  const apiKey = process.env.ZAI_API_KEY
  const chatId = process.env.ZAI_CHAT_ID
  const token = process.env.ZAI_TOKEN
  const userId = process.env.ZAI_USER_ID

  if (baseUrl && apiKey && chatId && token && userId) {
    return { baseUrl, apiKey, chatId, token, userId }
  }

  return null
}

let cachedConfig: ZAIConfig | null = null
let zaiInstance: ZAI | null = null

// Map to track timeout IDs
const controllerTimeouts = new Map<AbortController, ReturnType<typeof setTimeout>>()

// Create AbortController with timeout
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  controllerTimeouts.set(controller, timeoutId)
  return controller
}

// Fetch with timeout
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs: number = 120000): Promise<Response> {
  const controller = createTimeoutController(timeoutMs)
  const timeoutId = controllerTimeouts.get(controller)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    })
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      controllerTimeouts.delete(controller)
    }
  }
}

export async function createZAI(): Promise<ZAI> {
  if (!cachedConfig) {
    // Edge-compatible: env-only config (no fs/path/os file reading)
    cachedConfig = loadConfigFromEnv()

    if (!cachedConfig) {
      throw new Error(
        'ZAI config not found. Set env vars: ZAI_BASE_URL, ZAI_API_KEY, ZAI_CHAT_ID, ZAI_TOKEN, ZAI_USER_ID'
      )
    }

    console.log('✅ [ZAI] Configuration loaded from env:', {
      baseUrl: cachedConfig.baseUrl,
      hasApiKey: !!cachedConfig.apiKey,
      hasChatId: !!cachedConfig.chatId
    })
  }

  // Reuse existing instance or create new one
  if (!zaiInstance) {
    // Create ZAI instance using create() method with timeout-wrapped fetch
    // Pass timeout fetch via global override during init only (restored immediately after)
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchWithTimeout as typeof globalThis.fetch
    try {
      zaiInstance = await ZAI.create()
    } finally {
      globalThis.fetch = originalFetch
    }

    // Patch createVision method to use timeout
    const originalCreateVision = zaiInstance.chat.completions.createVision
    zaiInstance.chat.completions.createVision = async (body: CreateChatCompletionVisionBody) => {
      console.log('🤖 [ZAI] createVision called with 120s timeout')
      const startTime = Date.now()

      try {
        if (!zaiInstance) {
          throw new Error('ZAI instance not initialized')
        }
        const result = await originalCreateVision.call(zaiInstance.chat.completions, body)
        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log(`✅ [ZAI] createVision completed in ${duration}s`)
        return result
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.error(`❌ [ZAI] createVision failed after ${duration}s:`, message)
        throw error
      }
    }

    console.log('✅ [ZAI] SDK instance created and createVision patched with 120s timeout')
  }

  return zaiInstance
}
