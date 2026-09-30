import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'

/**
 * /api/prop-firm-guard
 *
 * GET    — List user's challenges
 * POST   — Create new challenge
 * PATCH  — Update challenge (phase, alert settings, etc.)
 * DELETE — Deactivate challenge
 */

// ─── GET ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user || response) return response

  try {
    const challenges = await db.propFirmChallenge.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ challenges })
  } catch (error: any) {
    console.error('[prop-firm-guard] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── POST ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user || response) return response

  try {
    const body = await request.json()
    const {
      firmName,
      challengePhase,
      accountSize,
      maxDailyLoss,
      maxTotalDD,
      profitTarget,
      tradingAccountId,
      alertAtPercent,
    } = body

    // Validate required fields
    if (!firmName || !accountSize) {
      return NextResponse.json(
        { error: 'firmName and accountSize are required' },
        { status: 400 }
      )
    }

    // Validate firm name
    const validFirms = ['FTMO', 'MFF', 'TFT', 'FundedNext', 'SurgeTrader', 'Custom']
    if (!validFirms.includes(firmName)) {
      return NextResponse.json(
        { error: `Invalid firm name. Must be one of: ${validFirms.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate phase
    const validPhases = ['phase1', 'phase2', 'funded']
    const phase = challengePhase || 'phase1'
    if (!validPhases.includes(phase)) {
      return NextResponse.json(
        { error: `Invalid phase. Must be one of: ${validPhases.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate account size
    if (typeof accountSize !== 'number' || accountSize <= 0) {
      return NextResponse.json(
        { error: 'accountSize must be a positive number' },
        { status: 400 }
      )
    }

    // Validate DD limits
    if (typeof maxDailyLoss !== 'number' || maxDailyLoss <= 0) {
      return NextResponse.json(
        { error: 'maxDailyLoss must be a positive number' },
        { status: 400 }
      )
    }
    if (typeof maxTotalDD !== 'number' || maxTotalDD <= 0) {
      return NextResponse.json(
        { error: 'maxTotalDD must be a positive number' },
        { status: 400 }
      )
    }
    if (typeof profitTarget !== 'number' || profitTarget <= 0) {
      return NextResponse.json(
        { error: 'profitTarget must be a positive number' },
        { status: 400 }
      )
    }

    // Check max challenges per user (limit: 10)
    const existingCount = await db.propFirmChallenge.count({
      where: { userId: user.id, isActive: true },
    })
    if (existingCount >= 10) {
      return NextResponse.json(
        { error: 'Maximum 10 active challenges per user' },
        { status: 400 }
      )
    }

    const challenge = await db.propFirmChallenge.create({
      data: {
        userId: user.id,
        firmName,
        challengePhase: phase,
        accountSize,
        maxDailyLoss,
        maxTotalDD,
        profitTarget,
        tradingAccountId: tradingAccountId || null,
        alertAtPercent: alertAtPercent || 40,
        currentBalance: accountSize,
      },
    })

    return NextResponse.json({ challenge }, { status: 201 })
  } catch (error: any) {
    console.error('[prop-firm-guard] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── PATCH ─────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user || response) return response

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Challenge id is required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await db.propFirmChallenge.findUnique({
      where: { id },
    })

    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // Build safe update data
    const data: any = {}

    if (updates.challengePhase) {
      const validPhases = ['phase1', 'phase2', 'funded']
      if (!validPhases.includes(updates.challengePhase)) {
        return NextResponse.json({ error: 'Invalid phase' }, { status: 400 })
      }
      data.challengePhase = updates.challengePhase
    }

    if (updates.alertAtPercent !== undefined) {
      if (typeof updates.alertAtPercent !== 'number' || updates.alertAtPercent < 10 || updates.alertAtPercent > 90) {
        return NextResponse.json({ error: 'alertAtPercent must be between 10 and 90' }, { status: 400 })
      }
      data.alertAtPercent = updates.alertAtPercent
    }

    if (updates.maxDailyLoss !== undefined) {
      data.maxDailyLoss = updates.maxDailyLoss
    }

    if (updates.maxTotalDD !== undefined) {
      data.maxTotalDD = updates.maxTotalDD
    }

    if (updates.profitTarget !== undefined) {
      data.profitTarget = updates.profitTarget
    }

    if (updates.tradingAccountId !== undefined) {
      data.tradingAccountId = updates.tradingAccountId || null
    }

    if (updates.firmName !== undefined) {
      data.firmName = updates.firmName
    }

    if (updates.accountSize !== undefined) {
      data.accountSize = updates.accountSize
    }

    if (updates.isActive !== undefined) {
      data.isActive = updates.isActive
    }

    // Allow resetting breach
    if (updates.resetBreach === true) {
      data.isBreached = false
      data.breachReason = null
      data.breachedAt = null
    }

    const challenge = await db.propFirmChallenge.update({
      where: { id },
      data,
    })

    return NextResponse.json({ challenge })
  } catch (error: any) {
    console.error('[prop-firm-guard] PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── DELETE ────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user || response) return response

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Challenge id is required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await db.propFirmChallenge.findUnique({
      where: { id },
    })

    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // Soft delete (deactivate)
    await db.propFirmChallenge.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[prop-firm-guard] DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
