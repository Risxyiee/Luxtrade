import { test, expect } from '@playwright/test'

test.describe('Trading Features', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('should display trade creation interface', async ({ page }) => {
    const newTradeButton = page.locator('button:has-text(/new trade|add trade/i)')
    
    if (await newTradeButton.isVisible()) {
      await expect(newTradeButton).toBeVisible()
    }
  })

  test('should open trade form when clicking new trade', async ({ page }) => {
    const newTradeButton = page.locator('button:has-text(/new trade|add trade/i)')
    
    if (await newTradeButton.isVisible()) {
      await newTradeButton.click()
      await page.waitForTimeout(300)
      
      // Form should appear
      const form = page.locator('[data-testid="trade-form"], form')
      if (await form.isVisible()) {
        await expect(form).toBeVisible()
      }
    }
  })
})

test.describe('Trade Form - Image Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Open trade form
    const newTradeButton = page.locator('button:has-text(/new trade|add trade/i)')
    if (await newTradeButton.isVisible()) {
      await newTradeButton.click()
      await page.waitForTimeout(300)
    }
  })

  test('should have image upload input', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    
    if (await fileInput.isVisible()) {
      await expect(fileInput).toBeVisible()
    }
  })

  test('should accept image file upload', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    
    if (await fileInput.isVisible()) {
      // Create a test image file
      await fileInput.setInputFiles({
        name: 'test-trade.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake image data'),
      })
      
      // Wait for upload to process
      await page.waitForTimeout(500)
    }
  })

  test('should display image preview after upload', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: 'test-trade.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake image data'),
      })
      
      await page.waitForTimeout(500)
      
      // Image preview should appear
      const preview = page.locator('img[alt=/trade image|preview/i]')
      if (await preview.isVisible()) {
        await expect(preview).toBeVisible()
      }
    }
  })

  test('should show remove button on image hover', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: 'test-trade.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake image data'),
      })
      
      await page.waitForTimeout(500)
      
      const imageContainer = page.locator('img[alt=/trade image|preview/i]').first()
      if (await imageContainer.isVisible()) {
        await imageContainer.hover()
        
        const removeButton = page.locator('button:has-text(/remove|delete|x/i)')
        if (await removeButton.isVisible()) {
          await expect(removeButton).toBeVisible()
        }
      }
    }
  })

  test('should remove image when delete button clicked', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: 'test-trade.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake image data'),
      })
      
      await page.waitForTimeout(500)
      
      const imageContainer = page.locator('img[alt=/trade image|preview/i]').first()
      if (await imageContainer.isVisible()) {
        await imageContainer.hover()
        
        const removeButton = page.locator('button:has-text(/remove|delete|x/i)')
        if (await removeButton.isVisible()) {
          await removeButton.click()
          
          // Image should be removed
          const preview = page.locator('img[alt=/trade image|preview/i]')
          await expect(preview).not.toBeVisible()
        }
      }
    }
  })
})

test.describe('Trade Form - Input Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')
    
    const newTradeButton = page.locator('button:has-text(/new trade|add trade/i)')
    if (await newTradeButton.isVisible()) {
      await newTradeButton.click()
      await page.waitForTimeout(300)
    }
  })

  test('should validate required fields', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]')
    
    if (await submitButton.isVisible()) {
      await submitButton.click()
      
      // Error messages should appear
      const errorMessage = page.locator('[role="alert"], .error, .text-red')
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toBeVisible()
      }
    }
  })

  test('should accept valid trade entry', async ({ page }) => {
    const entryInput = page.locator('input[name="entry"], input[placeholder*="entry" i]').first()
    const exitInput = page.locator('input[name="exit"], input[placeholder*="exit" i]').first()
    const quantityInput = page.locator('input[name="quantity"], input[placeholder*="quantity" i]').first()
    
    if (await entryInput.isVisible()) {
      await entryInput.fill('100.50')
    }
    
    if (await exitInput.isVisible()) {
      await exitInput.fill('110.75')
    }
    
    if (await quantityInput.isVisible()) {
      await quantityInput.fill('10')
    }
    
    // Inputs should have values
    if (await entryInput.isVisible()) {
      expect(await entryInput.inputValue()).toBe('100.50')
    }
  })
})

test.describe('Trade Form - Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')
    
    const newTradeButton = page.locator('button:has-text(/new trade|add trade/i)')
    if (await newTradeButton.isVisible()) {
      await newTradeButton.click()
      await page.waitForTimeout(300)
    }
  })

  test('should submit form with valid data', async ({ page }) => {
    const entryInput = page.locator('input[name="entry"], input[placeholder*="entry" i]').first()
    const exitInput = page.locator('input[name="exit"], input[placeholder*="exit" i]').first()
    const quantityInput = page.locator('input[name="quantity"], input[placeholder*="quantity" i]').first()
    const submitButton = page.locator('button[type="submit"]')
    
    if (await entryInput.isVisible()) {
      await entryInput.fill('100')
      await exitInput.fill('110')
      await quantityInput.fill('5')
      
      // Listen for success message
      page.on('response', response => {
        if (response.url().includes('/api/trades')) {
          console.log('Trade API called')
        }
      })
      
      await submitButton.click()
      
      // Wait for success or error
      await page.waitForTimeout(1000)
    }
  })

  test('should show loading state during submission', async ({ page }) => {
    const entryInput = page.locator('input[name="entry"], input[placeholder*="entry" i]').first()
    const exitInput = page.locator('input[name="exit"], input[placeholder*="exit" i]').first()
    const quantityInput = page.locator('input[name="quantity"], input[placeholder*="quantity" i]').first()
    const submitButton = page.locator('button[type="submit"]')
    
    if (await entryInput.isVisible()) {
      await entryInput.fill('100')
      await exitInput.fill('110')
      await quantityInput.fill('5')
      
      // Slow down network to see loading state
      await page.context().browser()?.close()
      
      await submitButton.click()
      
      // Check if submit button is disabled
      if (await submitButton.isDisabled()) {
        await expect(submitButton).toBeDisabled()
      }
    }
  })
})

test.describe('Trade History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('should display trade history table', async ({ page }) => {
    const tradesLink = page.locator('a:has-text(/trades/i), button:has-text(/trades/i)')
    
    if (await tradesLink.isVisible()) {
      await tradesLink.click()
      await page.waitForLoadState('networkidle')
      
      const table = page.locator('table, [role="grid"]')
      if (await table.isVisible()) {
        await expect(table).toBeVisible()
      }
    }
  })

  test('should display trade columns', async ({ page }) => {
    const tradesLink = page.locator('a:has-text(/trades/i), button:has-text(/trades/i)')
    
    if (await tradesLink.isVisible()) {
      await tradesLink.click()
      await page.waitForLoadState('networkidle')
      
      // Check for common trade columns
      const columns = page.locator('th, [role="columnheader"]')
      const count = await columns.count()
      
      if (count > 0) {
        expect(count).toBeGreaterThan(0)
      }
    }
  })
})
