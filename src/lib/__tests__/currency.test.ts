import { formatCurrency, formatPercentage } from '@/lib/utils'

describe('Currency Formatting', () => {
  describe('formatCurrency', () => {
    it('should format positive numbers correctly', () => {
      expect(formatCurrency(1500.50)).toBe('$1,500.50')
      expect(formatCurrency(10000)).toBe('$10,000.00')
    })

    it('should format negative numbers correctly', () => {
      expect(formatCurrency(-500.25)).toBe('-$500.25')
      expect(formatCurrency(-1000)).toBe('-$1,000.00')
    })

    it('should format zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00')
    })

    it('should handle large numbers', () => {
      expect(formatCurrency(1000000.99)).toBe('$1,000,000.99')
    })

    it('should handle decimal precision correctly', () => {
      expect(formatCurrency(1234.5678)).toBe('$1,234.57') // Rounds to 2 decimals
    })
  })

  describe('formatPercentage', () => {
    it('should format positive percentages correctly', () => {
      expect(formatPercentage(25.5)).toBe('+25.50%')
      expect(formatPercentage(100)).toBe('+100.00%')
    })

    it('should format negative percentages correctly', () => {
      expect(formatPercentage(-25.5)).toBe('-25.50%')
      expect(formatPercentage(-100)).toBe('-100.00%')
    })

    it('should format zero correctly', () => {
      expect(formatPercentage(0)).toBe('0.00%')
    })

    it('should handle decimal precision', () => {
      expect(formatPercentage(12.3456)).toBe('+12.35%') // Rounds to 2 decimals
    })
  })
})
