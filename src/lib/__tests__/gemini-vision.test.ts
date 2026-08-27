import { analyzeTradeScreenshotWithGemini, generateJournalEntryFromAnalysis, getGeminiConfig } from '../gemini-vision'
import { logger } from '../logger'

jest.mock('../logger')

describe('gemini-vision', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getGeminiConfig', () => {
    it('should return configured=false if API key not set', () => {
      delete process.env.GOOGLE_GEMINI_API_KEY
      const config = getGeminiConfig()
      expect(config.configured).toBe(false)
    })

    it('should return configured=true if API key is set', () => {
      process.env.GOOGLE_GEMINI_API_KEY = 'test-key-123'
      const config = getGeminiConfig()
      expect(config.configured).toBe(true)
      expect(config.apiKey).toBe('test-key-123')
    })
  })

  describe('analyzeTradeScreenshotWithGemini', () => {
    it('should throw error if Gemini not configured', async () => {
      delete process.env.GOOGLE_GEMINI_API_KEY
      await expect(
        analyzeTradeScreenshotWithGemini('base64data')
      ).rejects.toThrow('Google Gemini API not configured')
    })

    it('should handle API errors gracefully', async () => {
      process.env.GOOGLE_GEMINI_API_KEY = 'test-key'
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      } as any)

      await expect(
        analyzeTradeScreenshotWithGemini('base64data')
      ).rejects.toThrow('Gemini API error')
    })
  })

  describe('generateJournalEntryFromAnalysis', () => {
    it('should return default entry if no trade data', async () => {
      const result = await generateJournalEntryFromAnalysis(undefined)
      expect(result).toBe('Auto-generated journal entry from trading screenshot.')
    })

    it('should build default entry from trade data', async () => {
      const tradeData = {
        symbol: 'EUR/USD',
        type: 'BUY',
        entry_price: 1.0950,
        exit_price: 1.0965,
        lot_size: 0.5,
        profit_loss: 75,
      }

      const result = await generateJournalEntryFromAnalysis(tradeData)
      expect(result).toContain('EUR/USD')
      expect(result).toContain('BUY')
      expect(result).toContain('75')
    })
  })
})
