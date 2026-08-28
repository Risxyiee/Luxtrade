export interface TradeAlertPreferences {
  emailDigest: 'daily' | 'weekly' | 'off'
  tradeAlerts: {
    bigWin: boolean
    bigLoss: boolean
    streak: boolean
    dailyLimit: boolean
  }
  thresholds: {
    bigWinAmount: number
    bigLossAmount: number
    maxDailyLosses: number
  }
  inApp: boolean
}

export interface TradeAlert {
  id: string
  type: 'big_win' | 'big_loss' | 'streak' | 'daily_limit'
  title: string
  message: string
  timestamp: Date
  read: boolean
  severity: 'success' | 'warning' | 'danger'
}

const DEFAULT_PREFS: TradeAlertPreferences = {
  emailDigest: 'daily',
  tradeAlerts: {
    bigWin: true,
    bigLoss: true,
    streak: true,
    dailyLimit: true,
  },
  thresholds: {
    bigWinAmount: 100,
    bigLossAmount: -100,
    maxDailyLosses: 5,
  },
  inApp: true,
}

export function getDefaultPreferences(): TradeAlertPreferences {
  return structuredClone(DEFAULT_PREFS)
}

function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

/**
 * Generate smart trade alerts based on trade data and user preferences.
 * Respects the user's notification preferences and thresholds.
 */
export function generateTradeAlerts(
  trades: { id: string; symbol: string; profit_loss: number; close_time?: string | Date; created_at?: string }[],
  preferences?: Partial<TradeAlertPreferences>
): TradeAlert[] {
  const prefs = { ...DEFAULT_PREFS, ...preferences }
  const alerts: TradeAlert[] = []

  if (trades.length === 0) return alerts

  // 1. Big Win / Big Loss: check today's trades total P/L and individual trades
  const todayTrades = trades.filter(t => {
    const d = t.close_time || t.created_at
    return d && isToday(d)
  })

  if (todayTrades.length > 0) {
    const todayTotalPL = todayTrades.reduce((sum, t) => sum + t.profit_loss, 0)
    const bestTrade = todayTrades.reduce((best, t) => t.profit_loss > best.profit_loss ? t : best, todayTrades[0])
    const worstTrade = todayTrades.reduce((worst, t) => t.profit_loss < worst.profit_loss ? t : worst, todayTrades[0])

    // Big Win alert
    if (prefs.tradeAlerts.bigWin && (todayTotalPL >= prefs.thresholds.bigWinAmount || bestTrade.profit_loss >= prefs.thresholds.bigWinAmount)) {
      const triggerTrade = bestTrade.profit_loss >= prefs.thresholds.bigWinAmount ? bestTrade : null
      alerts.push({
        id: `alert-big-win-${Date.now()}`,
        type: 'big_win',
        title: `Big Win! +$${todayTotalPL.toFixed(0)}`,
        message: triggerTrade
          ? `${triggerTrade.symbol} closed at +$${triggerTrade.profit_loss.toFixed(2)}

Total hari ini: +$${todayTotalPL.toFixed(2)} (${todayTrades.length} trades)`
          : `Total P/L hari ini: +$${todayTotalPL.toFixed(2)} dari ${todayTrades.length} trades`,
        timestamp: new Date(),
        read: false,
        severity: 'success',
      })
    }

    // Big Loss alert
    if (prefs.tradeAlerts.bigLoss && (todayTotalPL <= prefs.thresholds.bigLossAmount || worstTrade.profit_loss <= prefs.thresholds.bigLossAmount)) {
      const triggerTrade = worstTrade.profit_loss <= prefs.thresholds.bigLossAmount ? worstTrade : null
      alerts.push({
        id: `alert-big-loss-${Date.now()}`,
        type: 'big_loss',
        title: `Big Loss: $${todayTotalPL.toFixed(0)}`,
        message: triggerTrade
          ? `${triggerTrade.symbol} closed at $${triggerTrade.profit_loss.toFixed(2)}

Total hari ini: $${todayTotalPL.toFixed(2)} (${todayTrades.length} trades)`
          : `Total P/L hari ini: $${todayTotalPL.toFixed(2)} dari ${todayTrades.length} trades. Pertimbangkan untuk berhenti trading.`,
        timestamp: new Date(),
        read: false,
        severity: 'danger',
      })
    }

    // Daily Loss Limit alert
    if (prefs.tradeAlerts.dailyLimit) {
      const todayLossCount = todayTrades.filter(t => t.profit_loss < 0).length
      if (todayLossCount >= prefs.thresholds.maxDailyLosses) {
        alerts.push({
          id: `alert-daily-limit-${Date.now()}`,
          type: 'daily_limit',
          title: `Batas Rugi Harian Tercapai`,
          message: `Kamu sudah rugi ${todayLossCount} kali hari ini (batas: ${prefs.thresholds.maxDailyLosses}). Pertimbangkan untuk berhenti trading dan kembali besok.`,
          timestamp: new Date(),
          read: false,
          severity: 'warning',
        })
      }
    }
  }

  // 2. Win/Loss streak detection (from all recent trades)
  if (prefs.tradeAlerts.streak && trades.length >= 3) {
    // Sort by most recent first
    const sorted = [...trades].sort((a, b) => {
      const da = new Date(a.close_time || a.created_at || 0).getTime()
      const db2 = new Date(b.close_time || b.created_at || 0).getTime()
      return db2 - da
    })

    // Calculate current streak from most recent trade
    let winStreak = 0
    let lossStreak = 0

    for (const trade of sorted) {
      if (trade.profit_loss >= 0 && lossStreak === 0) {
        winStreak++
      } else if (trade.profit_loss < 0 && winStreak === 0) {
        lossStreak++
      } else {
        break
      }
    }

    if (winStreak >= 3) {
      const streakPL = sorted.slice(0, winStreak).reduce((s, t) => s + t.profit_loss, 0)
      alerts.push({
        id: `alert-win-streak-${Date.now()}`,
        type: 'streak',
        title: `${winStreak}-Win Streak!`,
        message: `Kamu sedang dalam winning streak ${winStreak} trade berturut-turut! Total P/L streak: +$${streakPL.toFixed(2)}`,
        timestamp: new Date(),
        read: false,
        severity: 'success',
      })
    }

    if (lossStreak >= 3) {
      const streakPL = sorted.slice(0, lossStreak).reduce((s, t) => s + t.profit_loss, 0)
      alerts.push({
        id: `alert-loss-streak-${Date.now()}`,
        type: 'streak',
        title: `${lossStreak}-Loss Streak`,
        message: `Kamu sudah kalah ${lossStreak} trade berturut-turut (P/L: $${streakPL.toFixed(2)}). Evaluasi strategi dan pertimbangkan jeda.`,
        timestamp: new Date(),
        read: false,
        severity: 'danger',
      })
    }
  }

  return alerts
}
