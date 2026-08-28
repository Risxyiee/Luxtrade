/**
 * Ollama Vision API Wrapper
 * Untuk analisis screenshot trading MT5 menggunakan Ollama LLaVA model
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llava:7b';

interface OllamaAnalysisResult {
  symbol?: string | null;
  type?: string | null;
  entry_price?: number | null;
  exit_price?: number | null;
  profit_loss?: number | null;
  lot_size?: number | null;
  timeframe?: string | null;
  strategy?: string | null;
  notes?: string | null;
}

interface OllamaOptions {
  model?: string;
  temperature?: number;
  num_predict?: number;
}

/**
 * Cek apakah Ollama server berjalan
 */
export async function checkOllamaHealth(): Promise<{ running: boolean; version?: string; error?: string }> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/version`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return { running: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { running: true, version: data.version };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      running: false,
      error: message
    };
  }
}

/**
 * Cek apakah model tersedia
 */
export async function checkModelAvailability(model: string = DEFAULT_MODEL): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.models?.some((m: { name: string }) => m.name.includes(model)) || false;
  } catch {
    return false;
  }
}

/**
 * Analisis gambar menggunakan Ollama Vision
 */
export async function analyzeImageWithOllama(
  base64Image: string,
  imageType: string,
  question: string,
  options: OllamaOptions = {}
): Promise<OllamaAnalysisResult> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    num_predict = 1000
  } = options;

  console.log('📷 [Ollama Vision] Starting image analysis...');
  console.log('📷 [Ollama Vision] Model:', model);
  console.log('📷 [Ollama Vision] Image type:', imageType);
  console.log('📷 [Ollama Vision] Question:', question.substring(0, 100));

  // Cek health Ollama
  const health = await checkOllamaHealth();
  if (!health.running) {
    throw new Error(`Ollama server is not running: ${health.error}`);
  }

  console.log('✅ [Ollama Vision] Server is running, version:', health.version);

  // Cek model availability
  const modelAvailable = await checkModelAvailability(model);
  if (!modelAvailable) {
    console.log('⚠️ [Ollama Vision] Model not available, pulling...');
    await pullModel(model);
  }

  // System prompt khusus untuk analisis trading
  const systemPrompt = `You are an expert trading assistant. Analyze the screenshot and extract trading information in JSON format.

For MT5 trading screenshots, extract:
- Symbol (e.g., EURUSD, GBPUSD, XAUUSD, BTCUSD)
- Trade Type (BUY/SELL/LONG/SHORT)
- Entry Price
- Exit Price (if trade closed)
- Profit/Loss amount
- Lot Size
- Timeframe (M1, M5, M15, H1, H4, D1)
- Strategy used (breakout, trend following, scalping, etc.)
- Trade notes/insights

IMPORTANT: Return ONLY valid JSON in this exact format:
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
}

If you cannot extract certain information, set it to null.`;

  // User prompt
  const userPrompt = question || 'Analyze this trading screenshot and extract all relevant information in JSON format.';

  try {
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
          temperature,
          num_predict
        }
      }),
      signal: AbortSignal.timeout(120000) // 2 minutes timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Ollama Vision] API error:', response.status, errorText);
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ [Ollama Vision] Analysis completed');

    // Parse response as JSON
    let result: OllamaAnalysisResult;
    try {
      result = JSON.parse(data.response);
    } catch {
      // If response is not JSON, try to extract JSON from text
      const jsonMatch = data.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: return raw response as notes
        result = {
          notes: data.response,
          symbol: null,
          type: null,
          entry_price: null,
          exit_price: null,
          profit_loss: null,
          lot_size: null,
          timeframe: null,
          strategy: null
        };
      }
    }

    console.log('📊 [Ollama Vision] Extracted data:', {
      symbol: result.symbol,
      type: result.type,
      profit_loss: result.profit_loss
    });

    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('❌ [Ollama Vision] Error:', message);
    throw error;
  }
}

/**
 * Pull model dari Ollama
 */
export async function pullModel(model: string): Promise<void> {
  console.log('📦 [Ollama Vision] Pulling model:', model);

  const response = await fetch(`${OLLAMA_HOST}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: model,
      stream: false
    }),
    signal: AbortSignal.timeout(600000) // 10 minutes timeout untuk download model
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to pull model: ${response.status} - ${errorText}`);
  }

  console.log('✅ [Ollama Vision] Model pulled successfully');
}

/**
 * Generate simple journal entry dari hasil analisis
 */
export function generateJournalEntry(result: OllamaAnalysisResult): string {
  const parts: string[] = [];

  if (result.symbol) parts.push(`**Symbol**: ${result.symbol}`);
  if (result.type) parts.push(`**Type**: ${result.type}`);
  if (result.entry_price) parts.push(`**Entry**: ${result.entry_price}`);
  if (result.exit_price) parts.push(`**Exit**: ${result.exit_price}`);
  if (result.profit_loss !== undefined) {
    const pl = result.profit_loss;
    parts.push(`**P/L**: ${pl >= 0 ? '+$' : '-$'}${Math.abs(pl).toFixed(2)}`);
  }
  if (result.lot_size) parts.push(`**Lot Size**: ${result.lot_size}`);
  if (result.timeframe) parts.push(`**Timeframe**: ${result.timeframe}`);
  if (result.strategy) parts.push(`**Strategy**: ${result.strategy}`);
  if (result.notes) parts.push(`\n**Notes**: ${result.notes}`);

  return parts.join('\n') || 'Unable to extract trading information from the screenshot.';
}