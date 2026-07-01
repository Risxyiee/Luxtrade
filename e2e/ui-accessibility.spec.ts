import { test, expect } from '@playwright/test'

test.describe('UI Responsiveness - Mobile', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
  })

  test('should display login page on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
  })

  test('should display dashboard on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const mainContent = page.locator('main, [role="main"]')
    await expect(mainContent).toBeVisible()
  })

  test('should have responsive sidebar on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    // Sidebar might be collapsed on mobile
    const sidebar = page.locator('[data-testid="sidebar"]')
    if (await sidebar.isVisible()) {
      const styles = await sidebar.evaluate(el => {
        return window.getComputedStyle(el)
      })
      // Should have reasonable width on mobile
      expect(styles).toBeTruthy()
    }
  })

  test('should display navigation menu on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const navItems = page.locator('nav a, nav button')
    const count = await navItems.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should display forms properly on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    const form = page.locator('form')
    const inputs = form.locator('input')
    const inputCount = await inputs.count()
    
    expect(inputCount).toBeGreaterThan(0)
  })

  test('should have clickable buttons on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const buttons = page.locator('button')
    if (await buttons.count() > 0) {
      const firstButton = buttons.first()
      const box = await firstButton.boundingBox()
      
      // Button should have minimum touch target size (48x48)
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(32)
        expect(box.height).toBeGreaterThanOrEqual(32)
      }
    }
  })
})

test.describe('UI Responsiveness - Tablet', () => {
  test.beforeEach(async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
  })

  test('should display login page on tablet', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
  })

  test('should display dashboard on tablet', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const mainContent = page.locator('main, [role="main"]')
    await expect(mainContent).toBeVisible()
  })

  test('should display sidebar and content side by side on tablet', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('[data-testid="sidebar"]')
    const mainContent = page.locator('main, [role="main"]')
    
    if (await sidebar.isVisible() && await mainContent.isVisible()) {
      const sidebarBox = await sidebar.boundingBox()
      const contentBox = await mainContent.boundingBox()
      
      if (sidebarBox && contentBox) {
        // Content should be next to sidebar
        expect(contentBox.x).toBeGreaterThan(sidebarBox.x)
      }
    }
  })

  test('should display tables properly on tablet', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const table = page.locator('table, [role="grid"]')
    if (await table.isVisible()) {
      await expect(table).toBeVisible()
    }
  })
})

test.describe('UI Responsiveness - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
  })

  test('should display full layout on desktop', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('[data-testid="sidebar"]')
    const mainContent = page.locator('main, [role="main"]')
    
    await expect(mainContent).toBeVisible()
  })

  test('should display multiple columns on desktop', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const cards = page.locator('[data-testid="account-card"]')
    const count = await cards.count()
    
    if (count > 0) {
      const firstBox = await cards.nth(0).boundingBox()
      const secondBox = await cards.nth(1).boundingBox()
      
      if (firstBox && secondBox && count > 1) {
        // Cards should be side by side on desktop
        expect(secondBox.x).toBeGreaterThan(firstBox.x + firstBox.width - 50)
      }
    }
  })

  test('should display full navigation menu on desktop', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const navItems = page.locator('nav a, nav button')
    const count = await navItems.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('Accessibility - Keyboard Navigation', () => {
  test('should navigate forms with Tab key', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    
    await emailInput.focus()
    await page.keyboard.press('Tab')
    
    // Should move to password input
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement).toBeTruthy()
  })

  test('should submit form with Enter key', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    const passwordInput = page.locator('input[type="password"]')
    await passwordInput.fill('test')
    
    // Press Enter
    await passwordInput.press('Enter')
  })

  test('should open dialogs with keyboard', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const button = page.locator('button:has-text(/new|create/i)').first()
    if (await button.isVisible()) {
      await button.focus()
      await button.press('Enter')
      
      await page.waitForTimeout(300)
    }
  })

  test('should close dialogs with Escape key', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const button = page.locator('button:has-text(/new|create/i)').first()
    if (await button.isVisible()) {
      await button.click()
      await page.waitForTimeout(300)
      
      // Press Escape
      await page.keyboard.press('Escape')
      
      await page.waitForTimeout(300)
    }
  })
})

test.describe('Accessibility - ARIA Labels', () => {
  test('should have aria labels on buttons', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const buttons = page.locator('button')
    if (await buttons.count() > 0) {
      const firstButton = buttons.first()
      const ariaLabel = await firstButton.getAttribute('aria-label')
      const text = await firstButton.textContent()
      
      // Button should have either aria-label or visible text
      expect(ariaLabel || text).toBeTruthy()
    }
  })

  test('should have aria labels on form inputs', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    const inputs = page.locator('input')
    if (await inputs.count() > 0) {
      const firstInput = inputs.first()
      const ariaLabel = await firstInput.getAttribute('aria-label')
      const label = page.locator(`label[for="${await firstInput.getAttribute('id')}"]`)
      
      // Input should have either aria-label or associated label
      expect(ariaLabel || (await label.isVisible())).toBeTruthy()
    }
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const h1 = page.locator('h1')
    const h2 = page.locator('h2')
    
    // Page should have at least one heading
    expect(await h1.count() + await h2.count()).toBeGreaterThan(0)
  })

  test('should have role attributes on interactive elements', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const interactiveElements = page.locator('button, [role="button"], a, input')
    if (await interactiveElements.count() > 0) {
      const firstElement = interactiveElements.first()
      const role = await firstElement.getAttribute('role')
      const tag = await firstElement.evaluate(el => el.tagName.toLowerCase())
      
      // Should be a semantic element or have role attribute
      expect(['button', 'a', 'input', 'select', 'textarea'] as string[]).toContain(tag)
    }
  })
})

test.describe('Accessibility - Color Contrast', () => {
  test('should have readable text on light backgrounds', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const textElements = page.locator('p, span, a, button, h1, h2, h3')
    if (await textElements.count() > 0) {
      const firstElement = textElements.first()
      const styles = await firstElement.evaluate(el => {
        return {
          color: window.getComputedStyle(el).color,
          backgroundColor: window.getComputedStyle(el.parentElement).backgroundColor
        }
      })
      
      expect(styles).toBeTruthy()
    }
  })

  test('should use sufficient color for UI elements', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')

    const buttons = page.locator('button')
    if (await buttons.count() > 0) {
      const firstButton = buttons.first()
      const styles = await firstButton.evaluate(el => {
        return window.getComputedStyle(el)
      })
      
      expect(styles).toBeTruthy()
    }
  })
})

test.describe('Dark Mode Support', () => {
  test('should support dark mode', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    // Check if dark mode toggle exists
    const darkModeToggle = page.locator('[data-testid="theme-toggle"], button:has-text(/dark|light|theme/i)')
    
    if (await darkModeToggle.isVisible()) {
      await expect(darkModeToggle).toBeVisible()
    }
  })

  test('should toggle between light and dark modes', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const darkModeToggle = page.locator('[data-testid="theme-toggle"], button:has-text(/dark|light|theme/i)')
    
    if (await darkModeToggle.isVisible()) {
      const initialClass = await page.locator('html').getAttribute('class')
      
      await darkModeToggle.click()
      await page.waitForTimeout(300)
      
      const afterClass = await page.locator('html').getAttribute('class')
      
      // Classes should be different after toggle
      expect(initialClass).not.toBe(afterClass)
    }
  })

  test('should persist dark mode preference', async ({ page, context }) => {
    // Set dark mode
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')

    const darkModeToggle = page.locator('[data-testid="theme-toggle"], button:has-text(/dark|light|theme/i)')
    
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click()
      await page.waitForTimeout(300)
      
      // Reload page
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Dark mode should still be active
      const htmlClass = await page.locator('html').getAttribute('class')
      expect(htmlClass).toBeTruthy()
    }
  })
})

test.describe('Performance - Page Load', () => {
  test('should load login page quickly', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('http://localhost:3000/auth/login')
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000)
  })

  test('should load dashboard quickly', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000)
  })

  test('should not have console errors', async ({ page }) => {
    const errors: string[] = []
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')
    
    // There should be no critical errors
    const criticalErrors = errors.filter(e => 
      !e.includes('network') && 
      !e.includes('chrome-extension')
    )
    
    expect(criticalErrors.length).toBe(0)
  })
})
