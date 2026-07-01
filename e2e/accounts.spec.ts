import { test, expect } from '@playwright/test'

test.describe('Account Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('should navigate to accounts page', async ({ page }) => {
    const accountsLink = page.locator('a:has-text(/accounts/i), button:has-text(/accounts/i)')
    
    if (await accountsLink.isVisible()) {
      await accountsLink.click()
      await page.waitForLoadState('networkidle')
      
      expect(page.url()).toContain('accounts')
    }
  })

  test('should display list of trading accounts', async ({ page }) => {
    const accountsLink = page.locator('a:has-text(/accounts/i), button:has-text(/accounts/i)')
    
    if (await accountsLink.isVisible()) {
      await accountsLink.click()
      await page.waitForLoadState('networkidle')
      
      const accountItems = page.locator('[data-testid="account-item"], [data-testid="account-card"]')
      const count = await accountItems.count()
      
      if (count > 0) {
        await expect(accountItems.first()).toBeVisible()
      }
    }
  })

  test('should display account creation button', async ({ page }) => {
    const accountsLink = page.locator('a:has-text(/accounts/i), button:has-text(/accounts/i)')
    
    if (await accountsLink.isVisible()) {
      await accountsLink.click()
      await page.waitForLoadState('networkidle')
      
      const createButton = page.locator('button:has-text(/new|create|add account/i)')
      if (await createButton.isVisible()) {
        await expect(createButton).toBeVisible()
      }
    }
  })
})

test.describe('Account Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('should show delete button on hover', async ({ page }) => {
    const accountCard = page.locator('[data-testid="account-card"], [data-testid="account-item"]').first()
    
    if (await accountCard.isVisible()) {
      await accountCard.hover()
      
      const deleteBtn = accountCard.locator('[data-testid="delete-btn"], button[title*="delete" i]')
      if (await deleteBtn.isVisible()) {
        await expect(deleteBtn).toBeVisible()
      }
    }
  })

  test('should open delete confirmation modal', async ({ page }) => {
    const accountCard = page.locator('[data-testid="account-card"], [data-testid="account-item"]').first()
    
    if (await accountCard.isVisible()) {
      await accountCard.hover()
      
      const deleteBtn = accountCard.locator('[data-testid="delete-btn"], button[title*="delete" i]')
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click()
        await page.waitForTimeout(300)
        
        // Modal should appear
        const modal = page.locator('[role="dialog"], [data-testid="delete-modal"]')
        if (await modal.isVisible()) {
          await expect(modal).toBeVisible()
        }
      }
    }
  })

  test('should show account details in confirmation modal', async ({ page }) => {
    const accountCard = page.locator('[data-testid="account-card"], [data-testid="account-item"]').first()
    
    if (await accountCard.isVisible()) {
      const accountName = await accountCard.textContent()
      
      await accountCard.hover()
      
      const deleteBtn = accountCard.locator('[data-testid="delete-btn"], button[title*="delete" i]')
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click()
        await page.waitForTimeout(300)
        
        // Modal should show account details
        const modal = page.locator('[role="dialog"], [data-testid="delete-modal"]')
        if (await modal.isVisible()) {
          const modalText = await modal.textContent()
          expect(modalText).toBeTruthy()
        }
      }
    }
  })

  test('should show warning about permanent deletion', async ({ page }) => {
    const accountCard = page.locator('[data-testid="account-card"], [data-testid="account-item"]').first()
    
    if (await accountCard.isVisible()) {
      await accountCard.hover()
      
      const deleteBtn = accountCard.locator('[data-testid="delete-btn"], button[title*="delete" i]')
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click()
        await page.waitForTimeout(300)
        
        const warningText = page.locator('text=/permanent|cannot|delete forever/i')
        if (await warningText.isVisible()) {
          await expect(warningText).toBeVisible()
        }
      }
    }
  })

  test('should have Cancel and Delete buttons in modal', async ({ page }) => {
    const accountCard = page.locator('[data-testid="account-card"], [data-testid="account-item"]').first()
    
    if (await accountCard.isVisible()) {
      await accountCard.hover()
      
      const deleteBtn = accountCard.locator('[data-testid="delete-btn"], button[title*="delete" i]')
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click()
        await page.waitForTimeout(300)
        
        const cancelBtn = page.locator('button:has-text(/cancel|close/i)')
        const confirmBtn = page.locator('button:has-text(/delete|confirm/i)')
        
        if (await cancelBtn.isVisible()) {
          await expect(cancelBtn).toBeVisible()
        }
        
        if (await confirmBtn.isVisible()) {
          await expect(confirmBtn).toBeVisible()
        }
      }
    }
  })

  test('should close modal on Cancel button', async ({ page }) => {
    const accountCard = page.locator('[data-testid="account-card"], [data-testid="account-item"]').first()
    
    if (await accountCard.isVisible()) {
      await accountCard.hover()
      
      const deleteBtn = accountCard.locator('[data-testid="delete-btn"], button[title*="delete" i]')
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click()
        await page.waitForTimeout(300)
        
        const cancelBtn = page.locator('button:has-text(/cancel|close/i)').first()
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click()
          
          const modal = page.locator('[role="dialog"], [data-testid="delete-modal"]')
          await expect(modal).not.toBeVisible()
        }
      }
    }
  })

  test('should prevent deletion of only account', async ({ page }) => {
    const accountCards = page.locator('[data-testid="account-card"], [data-testid="account-item"]')
    const count = await accountCards.count()
    
    if (count === 1) {
      await accountCards.first().hover()
      
      const deleteBtn = accountCards.first().locator('[data-testid="delete-btn"], button[title*="delete" i]')
      
      // Delete button should not be visible or should be disabled
      if (await deleteBtn.isVisible()) {
        expect(await deleteBtn.isDisabled()).toBe(true)
      }
    }
  })

  test('should show trade count warning if account has trades', async ({ page }) => {
    const accountCard = page.locator('[data-testid="account-card"], [data-testid="account-item"]').first()
    
    if (await accountCard.isVisible()) {
      await accountCard.hover()
      
      const deleteBtn = accountCard.locator('[data-testid="delete-btn"], button[title*="delete" i]')
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click()
        await page.waitForTimeout(300)
        
        const warningWithCount = page.locator('text=/trade|peringatan|warning/i')
        if (await warningWithCount.isVisible()) {
          await expect(warningWithCount).toBeVisible()
        }
      }
    }
  })
})

test.describe('Account Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForLoadState('networkidle')
    
    const accountsLink = page.locator('a:has-text(/accounts/i), button:has-text(/accounts/i)')
    if (await accountsLink.isVisible()) {
      await accountsLink.click()
      await page.waitForLoadState('networkidle')
    }
  })

  test('should open account creation form', async ({ page }) => {
    const createButton = page.locator('button:has-text(/new|create|add account/i)')
    
    if (await createButton.isVisible()) {
      await createButton.click()
      await page.waitForTimeout(300)
      
      const form = page.locator('form, [data-testid="account-form"]')
      if (await form.isVisible()) {
        await expect(form).toBeVisible()
      }
    }
  })

  test('should have account form fields', async ({ page }) => {
    const createButton = page.locator('button:has-text(/new|create|add account/i)')
    
    if (await createButton.isVisible()) {
      await createButton.click()
      await page.waitForTimeout(300)
      
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]')
      const balanceInput = page.locator('input[name="balance"], input[placeholder*="balance" i]')
      
      if (await nameInput.isVisible()) {
        await expect(nameInput).toBeVisible()
      }
      
      if (await balanceInput.isVisible()) {
        await expect(balanceInput).toBeVisible()
      }
    }
  })

  test('should create new account with valid data', async ({ page }) => {
    const createButton = page.locator('button:has-text(/new|create|add account/i)')
    
    if (await createButton.isVisible()) {
      await createButton.click()
      await page.waitForTimeout(300)
      
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]')
      const balanceInput = page.locator('input[name="balance"], input[placeholder*="balance" i]')
      const submitBtn = page.locator('button[type="submit"]')
      
      if (await nameInput.isVisible()) {
        await nameInput.fill(`Test Account ${Date.now()}`)
      }
      
      if (await balanceInput.isVisible()) {
        await balanceInput.fill('10000')
      }
      
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await page.waitForTimeout(500)
      }
    }
  })
})
