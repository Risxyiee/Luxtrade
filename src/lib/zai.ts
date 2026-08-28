import ZAI, { type CreateChatCompletionVisionBody } from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'
import os from 'os'

interface ZAIConfig {
  baseUrl: string
  apiKey: string
  chatId: string
  token: string
  userId: string
}

function isValidZAIConfig(config: unknown): config is ZAIConfig {
  if (typeof config !== 'object' || config === null) return false
  const c = config as Record<string, unknown>
  return (
    typeof c.baseUrl === 'string' &&
    typeof c.apiKey === 'string' &&
    typeof c.chatId === 'string' &&
    typeof c.token === 'string' &&
    typeof c.userId === 'string'
  )
}

function loadConfigFromFile(): ZAIConfig | null {
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
    '/etc/.z-ai-config'
  ]

  for (const filePath of configPaths) {
    try {
      if (fs.existsSync(filePath)) {
        const configStr = fs.readFileSync(filePath, 'utf-8')
        const config = JSON.parse(configStr)
        if (isValidZAIConfig(config)) {
          return config
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return null
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

// Map to track timeout IDs for AbortControllers
const controllerTimeouts = new Map<AbortController, NodeJS.Timeout>()

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
    // Priority: env var > file config
    cachedConfig = loadConfigFromEnv() || loadConfigFromFile()

    if (!cachedConfig) {
      throw new Error(
        'ZAI config not found. Set env vars (ZAI_BASE_URL, ZAI_API_KEY, ZAI_CHAT_ID, ZAI_TOKEN, ZAI_USER_ID) or create .z-ai-config file.'
      )
    }

    console.log('✅ [ZAI] Configuration loaded:', {
      baseUrl: cachedConfig.baseUrl,
      hasApiKey: !!cachedConfig.apiKey,
      hasChatId: !!cachedConfig.chatId
    })
  }

  // Reuse existing instance or create new one
  if (!zaiInstance) {
    // Override global fetch with extended timeout
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchWithTimeout

    // Create ZAI instance using create() method
    zaiInstance = await ZAI.create()

    // Restore original fetch after SDK initialization
    globalThis.fetch = originalFetch

    // Patch createVision method to use timeout
    const originalCreateVision = zaiInstance.chat.completions.createVision
    zaiInstance.chat.completions.createVision = async (body: CreateChatCompletionVisionBody) => {
      console.log('🤖 [ZAI] createVision called with 120s timeout')
      const startTime = Date.now()

      try {
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
