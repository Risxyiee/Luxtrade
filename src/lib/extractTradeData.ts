/**
 * AUTO-JOURNAL TRADING SYSTEM - INTEGRATED CORE
 * Extracts trade data from screenshots using Claude Vision API with HuggingFace fallback
 */

// ==============================================================================
// 1. TYPE DEFINITIONS
// ==============================================================================

export type TradeType = "buy" | "sell";

export interface RawTradeData {
  symbol?: string;
  type?: TradeType;
  openPrice?: number;
  closePrice?: number;
  profitLoss?: number;
  openTime?: string;
  closeTime?: string;
  stopLoss?: number;
  takeProfit?: number;
  volume?: number;
  ticketNumber?: string;
}

export interface ValidatedTradeData extends RawTradeData {
  symbol: string;
  type: TradeType;
  openPrice: number;
  closePrice: number;
  profitLoss: number;
  openTime: string;
  closeTime: string;
}

export interface ExtractionResult {
  success: boolean;
  data?: ValidatedTradeData;
  rawData?: RawTradeData;
  validFieldCount: number;
  errors: string[];
  confidence: number;
}

// ==============================================================================
// 2. EXTRACTION LOGIC (Claude Vision + HuggingFace Fallback)
// ==============================================================================

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { analyzeImageWithHuggingFace } from "./huggingface-vision";

// Claude Vision API client
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Extract trade data using Claude Vision API
 */
async function extractWithClaudeVision(imageBuffer: Buffer): Promise<RawTradeData> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Optimize image for Claude Vision (max 5MB, WebP format for better compression)
  const optimizedImage = await sharp(imageBuffer)
    .resize(1920, 1080, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();

  const base64Image = optimizedImage.toString("base64");

  const prompt = `Analyze this trading screenshot (MT5/MT4 platform) and extract ALL trade information in JSON format.

IMPORTANT RULES:
1. Return ONLY valid JSON, no markdown or other text
2. Use these exact field names: symbol, type, openPrice, closePrice, profitLoss, openTime, closeTime, stopLoss, takeProfit, volume, ticketNumber
3. Type must be either "buy" or "sell" (lowercase)
4. Prices should be numbers (not strings)
5. For currency pairs like EURUSD, use "EURUSD" format
6. Extract date/time exactly as shown
7. If a field is not visible, set it to null
8. profitLoss can be negative (loss) or positive (profit)
9. Look for the "History" tab or "Trade History" table
10. Focus on ONE complete trade entry, not summary statistics

Example output:
{
  "symbol": "EURUSD",
  "type": "buy",
  "openPrice": 1.0875,
  "closePrice": 1.0890,
  "profitLoss": 150.50,
  "openTime": "2024-01-15 10:30:00",
  "closeTime": "2024-01-15 14:45:00",
  "stopLoss": 1.0850,
  "takeProfit": 1.0920,
  "volume": 0.1,
  "ticketNumber": "12345"
}`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "false",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/webp",
                  data: base64Image,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || data.message?.content?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }

    const parsedData = JSON.parse(jsonMatch[0]);
    return parsedData as RawTradeData;
  } catch (error) {
    console.error("Claude Vision extraction error:", error);
    throw error;
  }
}

/**
 * Extract trade data using HuggingFace API (fallback)
 */
async function extractWithHuggingFace(imageBuffer: Buffer): Promise<RawTradeData> {
  // Optimize image for HuggingFace
  const optimizedImage = await sharp(imageBuffer)
    .resize(1280, 720, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  const base64Image = optimizedImage.toString("base64");

  const prompt = `Analyze this trading screenshot (MT5/MT4 platform) and extract ALL trade information.

Extract these fields:
- symbol: Currency pair (e.g., EURUSD, GBPUSD)
- type: "buy" or "sell"
- openPrice: Opening price as number
- closePrice: Closing price as number
- profitLoss: Profit/loss as number (positive or negative)
- openTime: Opening date and time
- closeTime: Closing date and time
- stopLoss: Stop loss price if visible
- takeProfit: Take profit price if visible
- volume: Lot size if visible
- ticketNumber: Trade ticket number if visible

Return ONLY valid JSON format. If a field is not visible, use null.

Example:
{
  "symbol": "EURUSD",
  "type": "buy",
  "openPrice": 1.0875,
  "closePrice": 1.0890,
  "profitLoss": 150.50,
  "openTime": "2024-01-15 10:30:00",
  "closeTime": "2024-01-15 14:45:00",
  "stopLoss": 1.0850,
  "takeProfit": 1.0920,
  "volume": 0.1,
  "ticketNumber": "12345"
}`;

  try {
    const result = await analyzeImageWithHuggingFace(base64Image, prompt, {
      model: "Qwen/Qwen2-VL-2B-Instruct",
      timeout: 45000,
      maxRetries: 3,
    });

    // Extract JSON from response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in HuggingFace response");
    }

    const parsedData = JSON.parse(jsonMatch[0]);
    return parsedData as RawTradeData;
  } catch (error) {
    console.error("HuggingFace extraction error:", error);
    throw error;
  }
}

/**
 * Validate and normalize extracted trade data
 */
function validateTradeData(rawData: RawTradeData): {
  isValid: boolean;
  validated: ValidatedTradeData | null;
  validFieldCount: number;
  errors: string[];
  confidence: number;
} {
  const errors: string[] = [];
  let validFieldCount = 0;

  // Validate required fields
  if (!rawData.symbol || typeof rawData.symbol !== "string") {
    errors.push("Symbol is missing or invalid");
  } else {
    validFieldCount++;
  }

  if (!rawData.type || (rawData.type !== "buy" && rawData.type !== "sell")) {
    errors.push("Type is missing or invalid (must be 'buy' or 'sell')");
  } else {
    validFieldCount++;
  }

  if (rawData.openPrice === undefined || rawData.openPrice === null || isNaN(rawData.openPrice)) {
    errors.push("Open price is missing or invalid");
  } else {
    validFieldCount++;
  }

  if (rawData.closePrice === undefined || rawData.closePrice === null || isNaN(rawData.closePrice)) {
    errors.push("Close price is missing or invalid");
  } else {
    validFieldCount++;
  }

  if (rawData.profitLoss === undefined || rawData.profitLoss === null || isNaN(rawData.profitLoss)) {
    errors.push("Profit/loss is missing or invalid");
  } else {
    validFieldCount++;
  }

  if (!rawData.openTime || typeof rawData.openTime !== "string") {
    errors.push("Open time is missing or invalid");
  } else {
    validFieldCount++;
  }

  if (!rawData.closeTime || typeof rawData.closeTime !== "string") {
    errors.push("Close time is missing or invalid");
  } else {
    validFieldCount++;
  }

  // Optional fields
  if (rawData.stopLoss !== undefined && rawData.stopLoss !== null && !isNaN(rawData.stopLoss)) {
    validFieldCount++;
  }

  if (rawData.takeProfit !== undefined && rawData.takeProfit !== null && !isNaN(rawData.takeProfit)) {
    validFieldCount++;
  }

  if (rawData.volume !== undefined && rawData.volume !== null && !isNaN(rawData.volume)) {
    validFieldCount++;
  }

  if (rawData.ticketNumber && typeof rawData.ticketNumber === "string") {
    validFieldCount++;
  }

  // Calculate confidence based on valid fields
  const confidence = Math.min((validFieldCount / 8) * 100, 100);

  // Check if we have enough valid data (minimum 5 required fields)
  const isValid = validFieldCount >= 5;

  if (!isValid) {
    return {
      isValid: false,
      validated: null,
      validFieldCount,
      errors,
      confidence,
    };
  }

  // Create validated trade data
  const validated: ValidatedTradeData = {
    symbol: rawData.symbol!,
    type: rawData.type || "buy",
    openPrice: rawData.openPrice!,
    closePrice: rawData.closePrice!,
    profitLoss: rawData.profitLoss!,
    openTime: rawData.openTime!,
    closeTime: rawData.closeTime!,
    stopLoss: rawData.stopLoss,
    takeProfit: rawData.takeProfit,
    volume: rawData.volume,
    ticketNumber: rawData.ticketNumber,
  };

  return {
    isValid: true,
    validated,
    validFieldCount,
    errors,
    confidence,
  };
}

/**
 * Main function to extract trade data from screenshot
 * Uses HuggingFace Vision API (FREE) with retry logic
 */
export async function extractTradeData(imageBuffer: Buffer): Promise<ExtractionResult> {
  const errors: string[] = [];
  let rawData: RawTradeData | undefined;

  // Use HuggingFace Vision API (FREE)
  try {
    console.log("🤖 Attempting extraction with HuggingFace Vision API (FREE)...");
    rawData = await extractWithHuggingFace(imageBuffer);
    console.log("✅ HuggingFace extraction successful");
  } catch (error: any) {
    console.error("❌ HuggingFace extraction failed:", error.message);
    errors.push(`HuggingFace error: ${error.message}`);

    return {
      success: false,
      rawData,
      validFieldCount: 0,
      errors,
      confidence: 0,
    };
  }

  // Validate extracted data
  const validation = validateTradeData(rawData!);

  if (!validation.isValid) {
    return {
      success: false,
      rawData,
      validFieldCount: validation.validFieldCount,
      errors: [...errors, ...validation.errors],
      confidence: validation.confidence,
    };
  }

  console.log(`✅ Trade data extraction complete (HuggingFace)`);
  console.log(`   Confidence: ${validation.confidence.toFixed(1)}%`);
  console.log(`   Valid fields: ${validation.validFieldCount}/11`);

  return {
    success: true,
    data: validation.validated!,
    rawData,
    validFieldCount: validation.validFieldCount,
    errors: validation.errors,
    confidence: validation.confidence,
  };
}

// ==============================================================================
// 3. SUPABASE DATABASE OPERATIONS
// ==============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Save trade data to database
 */
export async function saveTrade(entry: any) {
  const { data, error } = await supabase
    .from("trades")
    .insert({
      user_id: entry.userId,
      symbol: entry.symbol,
      type: entry.type,
      open_price: entry.openPrice,
      close_price: entry.closePrice,
      profit_loss: entry.profitLoss,
      open_time: entry.openTime,
      close_time: entry.closeTime,
      stop_loss: entry.stopLoss,
      take_profit: entry.takeProfit,
      volume: entry.volume,
      ticket_number: entry.ticketNumber,
      screenshot_url: entry.screenshotUrl,
      notes: entry.notes,
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving trade:", error);
    throw new Error(error.message);
  }

  console.log("✅ Trade saved successfully:", data.id);
  return data;
}

/**
 * Upload screenshot to Supabase Storage
 */
export async function uploadScreenshot(
  imageBuffer: Buffer,
  userId: string
): Promise<string> {
  // Optimize image before upload
  const optimizedImage = await sharp(imageBuffer)
    .resize(1920, 1080, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();

  const path = `${userId}/${Date.now()}.webp`;

  try {
    const { error: uploadError } = await supabase.storage
      .from("trade-screenshots")
      .upload(path, optimizedImage, {
        upsert: true,
        contentType: "image/webp",
      });

    if (uploadError) {
      console.error("Error uploading screenshot:", uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL (if bucket is public) or signed URL (if private)
    const { data } = supabase.storage
      .from("trade-screenshots")
      .getPublicUrl(path);

    console.log("✅ Screenshot uploaded:", path);
    return data.publicUrl;
  } catch (error: any) {
    console.error("Screenshot upload error:", error);
    throw error;
  }
}