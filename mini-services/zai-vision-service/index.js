/**
 * Mini Service: Z.ai Vision Handler
 * Runs on port 3010
 * Handles Z.ai Vision API requests
 */

import { createServer } from 'http'
import { parse } from 'url'
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

const PORT = 3010

// Shared secret for internal service auth (must match what Next.js API sends)
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'luxtrade-internal-2024'

// Global ZAI instance to avoid creating multiple times
let zaiInstance = null

async function getZAiInstance() {
  if (zaiInstance) {
    return zaiInstance
  }

  try {
    // Try to create from file-based config
    zaiInstance = await ZAI.create()
    console.log('✅ [Z.ai Service] Loaded from file config')
    return zaiInstance
  } catch (error) {
    console.log('⚠️ [Z.ai Service] File config not found, using /etc/.z-ai-config')

    // Read config from /etc/.z-ai-config
    const configContent = fs.readFileSync('/etc/.z-ai-config', 'utf-8')
    const config = JSON.parse(configContent)

    console.log('📊 [Z.ai Service] Config loaded:', {
      baseUrl: config.baseUrl,
      hasApiKey: !!config.apiKey,
      hasChatId: !!config.chatId
    })

    // Create temp config file in project root
    const projectRoot = process.cwd()
    const tempConfigPath = path.join(projectRoot, '.z-ai-config')

    fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2), 'utf-8')

    try {
      zaiInstance = await ZAI.create()
      return zaiInstance
    } finally {
      // Clean up
      if (fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath)
      }
    }
  }
}

async function handleRequest(req, res) {
  const { pathname, query } = parse(req.url, true)

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // SECURITY: Verify internal service secret (health check exempt)
  if (pathname !== '/health') {
    const authHeader = req.headers['x-internal-secret']
    if (authHeader !== INTERNAL_SECRET) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Forbidden' }))
      return
    }
  }

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'zai-vision', port: PORT }))
    return
  }

  if (pathname === '/analyze' && req.method === 'POST') {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = ''
        req.on('data', chunk => data += chunk)
        req.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error('Invalid JSON'))
          }
        })
      })

      const { base64Image, prompt, model = 'glm-4.6v' } = body

      if (!base64Image) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'base64Image is required' }))
        return
      }

      if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'prompt is required' }))
        return
      }

      console.log(`📸 [Z.ai Service] Analyzing image: ${base64Image.length} chars`)
      console.log(`📝 [Z.ai Service] Prompt: ${prompt.substring(0, 50)}...`)

      const zai = await getZAiInstance()

      const response = await zai.chat.completions.createVision({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ]
      })

      const content = response.choices?.[0]?.message?.content || ''

      console.log(`✅ [Z.ai Service] Analysis completed: ${content.length} chars`)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: true,
        text: content,
        usage: response.usage
      }))

    } catch (error) {
      console.error('❌ [Z.ai Service] Error:', error.message)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: false,
        error: error.message
      }))
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
}

const server = createServer(handleRequest)

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Z.ai Vision Service] Running on port ${PORT}`)
  console.log(`📡 [Z.ai Service] Health check: http://localhost:${PORT}/health`)
})