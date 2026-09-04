/**
 * AUTO-JOURNAL TRADING SYSTEM - INTEGRATED CORE
 * Extracts trade data from screenshots using AI Vision
 * Provider chain: Gemini 2.5 Flash → OpenRouter Free Vision
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
// 2. EXTRACTION LOGIC (AIML GLM-4V-OCR)
// ==============================================================================

import { createClient } from "@supabase/supabase-js";
import { analyzeImageWithAiml, TRADE_EXTRACTION_PROMPT } from "./aiml-vision";

/**
 * Extract trade data using AI Vision (Gemini 2.5 Flash → OpenRouter fallback)
 * Edge-safe: accepts Uint8Array (no Buffer/sharp).
 */
async function extractWithVision(imageBytes: Uint8Array): Promise<RawTradeData> {
  const result = await analyzeImageWithAiml(imageBytes, TRADE_EXTRACTION_PROMPT)

  const jsonMatch = result.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in vision response')
  }

  return JSON.parse(jsonMatch[0]) as RawTradeData
}

/**
 * Validate and normalize extracted trade data
 * Updated: More lenient validation for chart/summary screenshots
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

  // For profit/loss: more lenient, calculate if not provided
  if (rawData.profitLoss === undefined || rawData.profitLoss === null || isNaN(rawData.profitLoss)) {
    // Try to calculate P/L from prices
    if (rawData.openPrice && rawData.closePrice && rawData.volume) {
      const calculatedPL = (rawData.closePrice - rawData.openPrice) * (rawData.volume * 100000 || 1);
      rawData.profitLoss = calculatedPL;
      validFieldCount++;
      console.log(`📊 Calculated P/L: ${calculatedPL}`);
    } else {
      errors.push("Profit/loss is missing or invalid");
    }
  } else {
    validFieldCount++;
  }

  // For times: more lenient, use current time if not provided
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

  // UPDATED: Minimum required fields reduced from 5 to 3
  // Minimum: Symbol + Type + Price (enough to log a trade)
  const isValid = validFieldCount >= 3;

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
 * Uses AI Vision (Gemini 2.5 Flash, fallback to OpenRouter)
 * Edge-safe: accepts Uint8Array.
 */
export async function extractTradeData(imageBytes: Uint8Array): Promise<ExtractionResult> {
  const errors: string[] = [];
  let rawData: RawTradeData | undefined;

  // Primary: AI Vision (Gemini 2.5 Flash, fallback to OpenRouter)
  try {
    console.log('🤖 Extracting trade data with AI Vision...')
    rawData = await extractWithVision(imageBytes)
    console.log('✅ Vision extraction successful')
    console.log('📦 Raw data:', JSON.stringify(rawData, null, 2))
  } catch (error: any) {
    console.error('❌ Vision extraction failed:', error.message)
    errors.push(`Vision error: ${error.message}`)

    return {
      success: false,
      rawData,
      validFieldCount: 0,
      errors,
      confidence: 0,
    }
  }

  // Validate extracted data
  const validation = validateTradeData(rawData!)

  if (!validation.isValid) {
    return {
      success: false,
      rawData,
      validFieldCount: validation.validFieldCount,
      errors: [...errors, ...validation.errors],
      confidence: validation.confidence,
    }
  }

  console.log(`✅ Trade data extraction complete`)
  console.log(`   Confidence: ${validation.confidence.toFixed(1)}%`)
  console.log(`   Valid fields: ${validation.validFieldCount}/11`)

  return {
    success: true,
    data: validation.validated!,
    rawData,
    validFieldCount: validation.validFieldCount,
    errors: validation.errors,
    confidence: validation.confidence,
  }
}

// ==============================================================================
// 3. SUPABASE DATABASE OPERATIONS
// ==============================================================================

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    console.warn('[ExtractTradeData] NEXT_PUBLIC_SUPABASE_URL not defined. Will be available at runtime.')
    return createClient('https://klxkdrfsfcoankbaoejn.supabase.co', 'placeholder-key-for-build')
  }

  if (!key) {
    console.warn('[ExtractTradeData] SUPABASE_SERVICE_ROLE_KEY not defined. Will be available at runtime.')
    return createClient(url, 'placeholder-key-for-build')
  }

  return createClient(url, key)
}

let _supabaseClient: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (!_supabaseClient) {
    _supabaseClient = getSupabaseClient()
  }
  return _supabaseClient
}

/**
 * Save trade data to database
 */
export async function saveTrade(entry: any) {
  const supabase = getSupabase()
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
      lot_size: entry.volume,
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
 * Upload screenshot to Supabase Storage.
 * Edge-safe: accepts Uint8Array (no Buffer/sharp).
 */
export async function uploadScreenshot(
  imageBytes: Uint8Array,
  userId: string
): Promise<string> {
  const supabase = getSupabase()
  const path = `${userId}/${Date.now()}.jpg`;

  try {
    const { error: uploadError } = await supabase.storage
      .from("trade-screenshots")
      .upload(path, imageBytes, {
        upsert: true,
        contentType: "image/jpeg",
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