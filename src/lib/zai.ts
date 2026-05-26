import ZAI from 'z-ai-web-dev-sdk'
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
        if (config.baseUrl && config.apiKey) {
          return config as ZAIConfig
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

export async function createZAI(): Promise<ZAI> {
  if (!cachedConfig) {
    // Priority: env var > file config
    cachedConfig = loadConfigFromEnv() || loadConfigFromFile()

    if (!cachedConfig) {
      throw new Error(
        'ZAI config not found. Set env vars (ZAI_BASE_URL, ZAI_API_KEY, ZAI_CHAT_ID, ZAI_TOKEN, ZAI_USER_ID) or create .z-ai-config file.'
      )
    }
  }

  return new ZAI(cachedConfig)
}
