/**
 * POST /api/auto-journal/from-image
 * Auto-generate journal entry from trading screenshot menggunakan Google Gemini Vision
 * FITUR UTAMA: Extract trade data dari gambar + generate journal entry otomatis
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/error-handler'
import { db } from '@/lib/db'
import { analyzeTradeScreenshotWithGemini, generateJournalEntryFromAnalysis } from '@/lib/gemini-vision'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const startTime = performance.now()
  let userId = 'unknown'

  try {
    // ── Auth check ──────────────────────────────────────────
    const { supabase } = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id

    // ── Rate limit ──────────────────────────────────────────
    const rl = rateLimitByUser('auto-journal', user.id, {
      maxRequests: 20,
      windowMs: 60 * 60 * 1000, // 1 hour
      message: 'Terlalu banyak permintaan auto-journal. Maksimal 20 per jam.',
    })
    if (rl) return rl

    // ── PRO check ───────────────────────────────────────────
    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({
        error: 'Fitur auto-journal hanya untuk pengguna PRO. Upgrade sekarang untuk analisis trading otomatis!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true,
      }, { status: 403 })
    }

    // ── Parse form data ─────────────────────────────────────
    const formData = await request.formData()
    const image = formData.get('image') as File
    const customPrompt = (formData.get('prompt') as string) || undefined

    if (!image) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 })
    }

    if (!image.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image (JPEG, PNG, WebP, GIF)' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB for Gemini)
    if (image.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image must be smaller than 5MB' },
        { status: 400 }
      )
    }

    logger.info('Auto-journal processing started', {
      userId: user.id,
      imageSize: image.size,
      mimeType: image.type,
    })

    // ── Convert to base64 ───────────────────────────────────
    const buffer = await image.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    // ── Call Gemini Vision ──────────────────────────────────
    logger.info('Calling Gemini Vision API', { userId: user.id })

    const geminiAnalysis = await analyzeTradeScreenshotWithGemini(base64, customPrompt)

    logger.info('Gemini analysis completed', {
      userId: user.id,
      hasTradeData: !!geminiAnalysis.tradeData,
      symbol: geminiAnalysis.tradeData?.symbol,
    })

    // ── Create trade record (jika ada data) ──────────────────
    let trade = null
    if (geminiAnalysis.tradeData && geminiAnalysis.tradeData.symbol) {
      trade = await db.trade.create({
        data: {
          user_id: user.id,
          symbol: geminiAnalysis.tradeData.symbol,
          type: geminiAnalysis.tradeData.type || 'BUY',
          open_price: geminiAnalysis.tradeData.entry_price || 0,
          close_price: geminiAnalysis.tradeData.exit_price || 0,
          lot_size: geminiAnalysis.tradeData.lot_size || 0,
          profit_loss: geminiAnalysis.tradeData.profit_loss || 0,
          open_time: geminiAnalysis.tradeData.open_time ? new Date(geminiAnalysis.tradeData.open_time) : new Date(),
          close_time: geminiAnalysis.tradeData.close_time ? new Date(geminiAnalysis.tradeData.close_time) : new Date(),
          stop_loss: geminiAnalysis.tradeData.stop_loss,
          take_profit: geminiAnalysis.tradeData.take_profit,
          setup_type: geminiAnalysis.tradeData.setup_type,
          screenshot_url: `data:${image.type};base64,${base64}`, // Store screenshot as data URL
        },
      })

      logger.info('Trade record created', { userId: user.id, tradeId: trade.id })
    }

    // ── Generate journal entry ──────────────────────────────
    const journalContent = await generateJournalEntryFromAnalysis(
      geminiAnalysis.tradeData,
      customPrompt
    )

    // ── Create journal entry ────────────────────────────────
    const title = geminiAnalysis.tradeData?.symbol
      ? `Trade: ${geminiAnalysis.tradeData.symbol} ${geminiAnalysis.tradeData.type} - ${new Date().toLocaleDateString('id-ID')}`
      : `Trading Journal - ${new Date().toLocaleDateString('id-ID')}`

    const journal = await db.journalEntry.create({
      data: {
        user_id: user.id,
        title,
        content: journalContent,
        image_url: `data:${image.type};base64,${base64}`,
        linked_journal_id: trade?.id || null,
        tags: geminiAnalysis.tradeData?.setup_type ? JSON.stringify([geminiAnalysis.tradeData.setup_type]) : null,
      },
    })

    logger.info('Journal entry created', {
      userId: user.id,
      journalId: journal.id,
      tradeId: trade?.id,
      ms: Math.round(performance.now() - startTime),
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Auto-journal entry created successfully',
        data: {
          trade: trade ? {
            id: trade.id,
            symbol: trade.symbol,
            type: trade.type,
            open_price: trade.open_price,
            close_price: trade.close_price,
            profit_loss: trade.profit_loss,
          } : null,
          journal: {
            id: journal.id,
            title: journal.title,
            created_at: journal.created_at,
          },
          analysis: {
            symbol: geminiAnalysis.tradeData?.symbol,
            setup_type: geminiAnalysis.tradeData?.setup_type,
            timeframe: geminiAnalysis.tradeData?.timeframe,
            analysis_text: geminiAnalysis.text,
          },
        },
      },
      {
        status: 201,
        headers: {
          'X-Processing-Time': `${Math.round(performance.now() - startTime)}ms`,
        },
      }
    )
  } catch (error) {
    const duration = Math.round(performance.now() - startTime)
    logger.error('Auto-journal error', error, { userId, ms: duration })
    return handleApiError(error, {
      endpoint: '/api/auto-journal/from-image',
      userId,
      userMessage: 'Gagal menganalisis screenshot trading. Pastikan gambar jelas dan format terlihat.',
    })
  }
}
