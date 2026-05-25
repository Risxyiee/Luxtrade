import { calculateProfitLoss, calculateWinRate, calculateProfitFactor } from '@/lib/tradeCalculations'

describe('Profit/Loss Calculations', () => {
  describe('calculateProfitLoss', () => {
    it('should calculate profit for long position', () => {
      const result = calculateProfitLoss({
        type: 'BUY',
        entryPrice: 1.1000,
        exitPrice: 1.1050,
        lotSize: 0.1,
        pipValue: 10
      })
      expect(result.profit).toBe(50)
      expect(result.profitPercentage).toBe(4.55)
    })

    it('should calculate loss for long position', () => {
      const result = calculateProfitLoss({
        type: 'BUY',
        entryPrice: 1.1050,
        exitPrice: 1.1000,
        lotSize: 0.1,
        pipValue: 10
      })
      expect(result.profit).toBe(-50)
      expect(result.profitPercentage).toBe(-4.55)
    })

    it('should calculate profit for short position', () => {
      const result = calculateProfitLoss({
        type: 'SELL',
        entryPrice: 1.1050,
        exitPrice: 1.1000,
        lotSize: 0.1,
        pipValue: 10
      })
      expect(result.profit).toBe(50)
      expect(result.profitPercentage).toBe(4.55)
    })

    it('should calculate loss for short position', () => {
      const result = calculateProfitLoss({
        type: 'SELL',
        entryPrice: 1.1000,
        exitPrice: 1.1050,
        lotSize: 0.1,
        pipValue: 10
      })
      expect(result.profit).toBe(-50)
      expect(result.profitPercentage).toBe(-4.55)
    })

    it('should handle zero profit correctly', () => {
      const result = calculateProfitLoss({
        type: 'BUY',
        entryPrice: 1.1000,
        exitPrice: 1.1000,
        lotSize: 0.1,
        pipValue: 10
      })
      expect(result.profit).toBe(0)
      expect(result.profitPercentage).toBe(0)
    })
  })

  describe('calculateWinRate', () => {
    it('should calculate win rate correctly', () => {
      const trades = [
        { profit: 100 },
        { profit: -50 },
        { profit: 150 },
        { profit: -75 },
        { profit: 200 }
      ]
      expect(calculateWinRate(trades)).toBe(60) // 3 wins out of 5 = 60%
    })

    it('should handle empty array', () => {
      expect(calculateWinRate([])).toBe(0)
    })

    it('should handle all losses', () => {
      const trades = [
        { profit: -50 },
        { profit: -100 },
        { profit: -75 }
      ]
      expect(calculateWinRate(trades)).toBe(0)
    })

    it('should handle all wins', () => {
      const trades = [
        { profit: 50 },
        { profit: 100 },
        { profit: 75 }
      ]
      expect(calculateWinRate(trades)).toBe(100)
    })
  })

  describe('calculateProfitFactor', () => {
    it('should calculate profit factor correctly', () => {
      const trades = [
        { profit: 200 },
        { profit: -100 },
        { profit: 150 },
        { profit: -50 }
      ]
      expect(calculateProfitFactor(trades)).toBe(2.33) // (200+150)/(100+50) = 2.33
    })

    it('should handle empty array', () => {
      expect(calculateProfitFactor([])).toBe(0)
    })

    it('should handle all losses', () => {
      const trades = [
        { profit: -50 },
        { profit: -100 },
        { profit: -75 }
      ]
      expect(calculateProfitFactor(trades)).toBe(0)
    })

    it('should handle all wins', () => {
      const trades = [
        { profit: 50 },
        { profit: 100 },
        { profit: 75 }
      ]
      expect(calculateProfitFactor(trades)).toBe(Infinity)
    })
  })
})
