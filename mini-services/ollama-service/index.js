#!/usr/bin/env node

/**
 * Ollama Vision Service
 * Menyediakan API untuk analisis gambar menggunakan Ollama dengan LLaVA model
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const PORT = 3031;
const OLLAMA_BINARY = process.env.OLLAMA_PATH || '/home/z/ollama/ollama';
const OLLAMA_HOST = 'http://127.0.0.1:11434';

// Log utilities
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage, data ? JSON.stringify(data, null, 2) : '');
}

// Check if Ollama is running
async function checkOllamaServer() {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/version`);
    const data = await response.json();
    log('INFO', 'Ollama server is running', { version: data.version });
    return true;
  } catch (error) {
    log('WARN', 'Ollama server is not running', { error: error.message });
    return false;
  }
}

// Start Ollama server if not running
async function startOllamaServer() {
  const isRunning = await checkOllamaServer();
  if (isRunning) return;

  log('INFO', 'Starting Ollama server...');

  try {
    // Start Ollama in background
    const process = exec(`${OLLAMA_BINARY} serve`, {
      detached: true,
      stdio: 'ignore'
    });

    process.unref();

    // Wait for server to be ready
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const ready = await checkOllamaServer();
      if (ready) {
        log('INFO', 'Ollama server started successfully');
        return;
      }
      attempts++;
    }

    throw new Error('Failed to start Ollama server');
  } catch (error) {
    log('ERROR', 'Failed to start Ollama server', { error: error.message });
    throw error;
  }
}

// Pull model if not available
async function ensureModel(model = 'llava:7b') {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    const data = await response.json();

    const hasModel = data.models?.some(m => m.name.includes(model));

    if (!hasModel) {
      log('INFO', `Pulling model ${model}...`);

      const pullResponse = await fetch(`${OLLAMA_HOST}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: false })
      });

      if (!pullResponse.ok) {
        throw new Error(`Failed to pull model: ${pullResponse.statusText}`);
      }

      log('INFO', `Model ${model} pulled successfully`);
    } else {
      log('INFO', `Model ${model} is already available`);
    }

    return true;
  } catch (error) {
    log('ERROR', 'Failed to ensure model', { error: error.message });
    throw error;
  }
}

// Analyze image using Ollama Vision API
async function analyzeImage(base64Image, imageType, question, model = 'llava:7b') {
  log('INFO', 'Starting image analysis', { model, imageType, question: question.substring(0, 100) });

  try {
    // Ensure server is running
    await startOllamaServer();

    // Ensure model is available
    await ensureModel(model);

    // Prepare the prompt
    const systemPrompt = `You are an expert trading assistant. Analyze the screenshot and extract trading information in JSON format.

For MT5 trading screenshots, extract:
- Symbol (e.g., EURUSD, GBPUSD, XAUUSD)
- Trade Type (BUY/SELL)
- Entry Price
- Exit Price (if trade closed)
- Profit/Loss amount
- Lot Size
- Timeframe
- Strategy used
- Trade notes/insights

Return ONLY valid JSON in this format:
{
  "symbol": "EURUSD",
  "type": "BUY",
  "entry_price": 1.0850,
  "exit_price": 1.0870,
  "profit_loss": 20.00,
  "lot_size": 0.1,
  "timeframe": "H1",
  "strategy": "breakout",
  "notes": "Good trade followed the trend"
}`;

    const userPrompt = question || 'Analyze this trading screenshot and extract all relevant information in JSON format.';

    // Call Ollama API
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        images: [base64Image],
        stream: false,
        format: 'json',
        options: {
          temperature: 0.7,
          num_predict: 1000
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    log('INFO', 'Image analysis completed', { responseLength: data.response?.length });

    return data.response;
  } catch (error) {
    log('ERROR', 'Image analysis failed', { error: error.message });
    throw error;
  }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health check
  if (req.method === 'GET' && url.pathname === '/health') {
    try {
      const isRunning = await checkOllamaServer();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: isRunning ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'error',
        error: error.message
      }));
    }
    return;
  }

  // Analyze image endpoint
  if (req.method === 'POST' && url.pathname === '/analyze') {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
        req.on('error', reject);
      });

      const { image, imageType, question, model } = body;

      if (!image) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Image is required' }));
        return;
      }

      log('INFO', 'Received analyze request', { imageType: imageType || 'unknown' });

      const result = await analyzeImage(
        image,
        imageType || 'image/jpeg',
        question || 'Analyze this trading screenshot',
        model || 'llava:7b'
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result: result
      }));
    } catch (error) {
      log('ERROR', 'Analyze request failed', { error: error.message });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: error.message
      }));
    }
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(PORT, '0.0.0.0', async () => {
  log('INFO', `🚀 Ollama Vision Service started on port ${PORT}`);

  // Initialize Ollama server
  try {
    await startOllamaServer();
    log('INFO', '📦 Service ready to accept requests');
  } catch (error) {
    log('ERROR', 'Failed to initialize Ollama', { error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('INFO', 'SIGTERM received, shutting down...');
  server.close(() => {
    log('INFO', 'Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('INFO', 'SIGINT received, shutting down...');
  server.close(() => {
    log('INFO', 'Server closed');
    process.exit(0);
  });
});