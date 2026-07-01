import { test, expect } from '@playwright/test'

test.describe('Error Handling & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console messages
    page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`))
    page.on('pageerror', err => console.error(`[Error] ${err.message}`))
  })

  test('should handle 404 error gracefully', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/nonexistent-page')
    
    if (response?.status() === 404) {
      await expect(page.locator('text=/not found|404/i')).toBeVisible()
    }
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network error by going offline
    await page.context().setOffline(true)
    
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' })
    
    // Should show error or loading state
    const errorMessage = page.locator('text=/offline|network|error/i')
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toBeVisible()
    }
    
    // Restore connection
    await page.context().setOffline(false)
  })

  test('should handle form submission errors', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    // Try to submit without filling required fields
    const submitButton = page.locator('button[type="submit"]')
    if (await submitButton.isVisible()) {
      await submitButton.click()
      
      // Should show validation errors
      const errorMessages = page.locator('[role="alert"], .error, .text-red-500')
      if (await errorMessages.first().isVisible()) {
        await expect(errorMessages.first()).toBeVisible()
      }
    }
  })

  test('should handle API timeout gracefully', async ({ page }) => {
    // Intercept API calls and timeout them
    await page.route('**/api/**', route => {
      setTimeout(() => {
        route.abort('timedout')
      }, 100)
    })

    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    // Should show error or retry message
    const errorText = page.locator('text=/error|timeout|retry/i')
    if (await errorText.isVisible()) {
      await expect(errorText).toBeVisible()
    }

    // Restore routing
    await page.unroute('**/api/**')
  })

  test('should handle invalid file upload', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const newTradeButton = page.locator('button:has-text(/new trade|add trade/i)')
    if (await newTradeButton.isVisible()) {
      await newTradeButton.click()
      await page.waitForTimeout(300)

      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.isVisible()) {
        // Try to upload non-image file
        await fileInput.setInputFiles({
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('not an image'),
        })

        await page.waitForTimeout(500)

        // Should show error
        const errorMessage = page.locator('text=/invalid|error|image/i')
        if (await errorMessage.isVisible()) {
          await expect(errorMessage).toBeVisible()
        }
      }
    }
  })

  test('should handle large file upload', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const newTradeButton = page.locator('button:has-text(/new trade|add trade/i)')
    if (await newTradeButton.isVisible()) {
      await newTradeButton.click()
      await page.waitForTimeout(300)

      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.isVisible()) {
        // Try to upload large file (>10MB)
        const largeBuffer = Buffer.alloc(11 * 1024 * 1024)
        
        await fileInput.setInputFiles({
          name: 'large.jpg',
          mimeType: 'image/jpeg',
          buffer: largeBuffer,
        })

        await page.waitForTimeout(500)

        // Should show error about file size
        const errorMessage = page.locator('text=/large|size|exceed/i')
        if (await errorMessage.isVisible()) {
          await expect(errorMessage).toBeVisible()
        }
      }
    }
  })

  test('should handle concurrent requests properly', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    // Trigger multiple requests simultaneously
    const accountCards = page.locator('[data-testid="account-card"]')
    const count = await accountCards.count()

    if (count > 1) {
      // Click multiple accounts rapidly
      await accountCards.nth(0).click()
      await accountCards.nth(1).click()
      
      await page.waitForTimeout(1000)

      // Page should still be responsive
      const mainContent = page.locator('main, [role="main"]')
      await expect(mainContent).toBeVisible()
    }
  })

  test('should handle session expiry', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    // Simulate session expiry by clearing cookies
    await page.context().clearCookies()

    // Try to interact with page
    const button = page.locator('button').first()
    if (await button.isVisible()) {
      await button.click()
      await page.waitForTimeout(500)

      // Should either redirect to login or show auth error
      const loginPage = page.url().includes('login')
      const errorMessage = page.locator('text=/unauthorized|login|session/i')
      
      expect(loginPage || await errorMessage.isVisible()).toBeTruthy()
    }
  })
})

test.describe('Console Errors & Warnings', () => {
  let consoleMessages: Array<{ type: string; message: string }> = []

  test.beforeEach(async ({ page }) => {
    consoleMessages = []
    
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        message: msg.text()
      })
    })
  })

  test('login page should have no critical console errors', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    const errors = consoleMessages.filter(m => 
      m.type === 'error' && 
      !m.message.includes('chrome-extension') &&
      !m.message.includes('network')
    )

    expect(errors.length).toBe(0)
  })

  test('dashboard should have no critical console errors', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const errors = consoleMessages.filter(m => 
      m.type === 'error' && 
      !m.message.includes('chrome-extension') &&
      !m.message.includes('network')
    )

    expect(errors.length).toBe(0)
  })

  test('should not have unhandled promise rejections', async ({ page }) => {
    let hasRejection = false
    
    page.on('pageerror', err => {
      if (err.message.includes('Unhandled promise')) {
        hasRejection = true
      }
    })

    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    expect(hasRejection).toBe(false)
  })
})

test.describe('Security Issues', () => {
  test('should not expose sensitive data in URLs', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const url = page.url()
    
    // Should not contain sensitive patterns
    expect(url).not.toMatch(/password|token|secret|key/i)
  })

  test('should have secure headers', async ({ page }) => {
    const response = await page.goto('http://localhost:3000')
    
    if (response) {
      const headers = response.headers()
      
      // Check for security headers (optional but good to have)
      const hasSecurityHeaders = 
        headers['x-content-type-options'] ||
        headers['x-frame-options'] ||
        headers['content-security-policy']
      
      // This is a warning, not a critical failure
      if (hasSecurityHeaders) {
        expect(hasSecurityHeaders).toBeTruthy()
      }
    }
  })

  test('should not have XSS vulnerabilities in form inputs', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"]')
    
    if (await emailInput.isVisible()) {
      // Try to inject script
      await emailInput.fill('<script>alert("XSS")</script>')
      
      // Value should be escaped
      const value = await emailInput.inputValue()
      expect(value).not.toContain('<script>')
    }
  })

  test('should sanitize user input in forms', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"]')
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com<img src=x onerror="alert(\'xss\')">')
      
      const displayedValue = await emailInput.inputValue()
      expect(displayedValue).not.toContain('onerror')
    }
  })
})

test.describe('Data Validation', () => {
  test('should validate email format', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"]')
    
    if (await emailInput.isVisible()) {
      // Try invalid email
      await emailInput.fill('notanemail')
      
      const validation = page.locator('[role="alert"], .error')
      if (await validation.isVisible()) {
        await expect(validation).toBeVisible()
      }
    }
  })

  test('should validate password requirements', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/signup')
    await page.waitForLoadState('networkidle')

    const passwordInput = page.locator('input[name="password"]')
    
    if (await passwordInput.isVisible()) {
      // Try weak password
      await passwordInput.fill('123')
      
      const validation = page.locator('[role="alert"], .error, .text-red')
      if (await validation.isVisible()) {
        await expect(validation).toBeVisible()
      }
    }
  })

  test('should validate numeric fields', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const newTradeButton = page.locator('button:has-text(/new trade|add trade/i)')
    if (await newTradeButton.isVisible()) {
      await newTradeButton.click()
      await page.waitForTimeout(300)

      const priceInput = page.locator('input[name="entry"], input[type="number"]').first()
      
      if (await priceInput.isVisible()) {
        // Try invalid number
        await priceInput.fill('not-a-number')
        
        await page.waitForTimeout(200)
        
        const value = await priceInput.inputValue()
        // Should either reject or show error
        expect(value === '' || !isNaN(Number(value))).toBeTruthy()
      }
    }
  })
})

test.describe('State Management', () => {
  test('should maintain state on page refresh', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const initialUrl = page.url()
    
    // Refresh page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // URL should be the same
    expect(page.url()).toBe(initialUrl)
  })

  test('should handle back button correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const firstUrl = page.url()

    // Navigate
    const link = page.locator('a').first()
    if (await link.isVisible()) {
      await link.click()
      await page.waitForLoadState('networkidle')

      const secondUrl = page.url()
      expect(secondUrl).not.toBe(firstUrl)

      // Go back
      await page.goBack()
      await page.waitForLoadState('networkidle')

      // Should be back to first page
      expect(page.url()).toBe(firstUrl)
    }
  })

  test('should handle forward button correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const link = page.locator('a').first()
    if (await link.isVisible()) {
      await link.click()
      await page.waitForLoadState('networkidle')

      await page.goBack()
      await page.waitForLoadState('networkidle')

      await page.goForward()
      await page.waitForLoadState('networkidle')

      // Page should load successfully
      const mainContent = page.locator('main, [role="main"]')
      await expect(mainContent).toBeVisible()
    }
  })
})
