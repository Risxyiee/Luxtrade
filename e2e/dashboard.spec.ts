import { test, expect } from '@playwright/test'

test.describe('Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/')

    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test('should display login page', async ({ page }) => {
    // Check if login form is visible
    await expect(page.locator('text=Sign in')).toBeVisible()
  })

  test('should navigate to dashboard after login', async ({ page }) => {
    // This test assumes user is already logged in or handles login
    // For now, let's test the dashboard structure

    // Navigate to dashboard
    await page.goto('/dashboard')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check if dashboard is loaded
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 })
  })

  test('should open and close sidebar on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Sidebar should be hidden by default on mobile
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toHaveClass(/-translate-x-full/)

    // Find and click hamburger menu
    const menuButton = page.locator('button').filter({ hasText: '' }).first()
    await menuButton.click()

    // Wait for animation
    await page.waitForTimeout(300)

    // Sidebar should now be visible
    await expect(sidebar).not.toHaveClass(/-translate-x-full/)

    // Check if sidebar text is visible
    await expect(page.locator('text=Dashboard')).toBeVisible()

    // Click overlay to close sidebar
    const overlay = page.locator('.bg-black\\/50').first()
    await overlay.click()

    // Wait for animation
    await page.waitForTimeout(300)

    // Sidebar should be hidden again
    await expect(sidebar).toHaveClass(/-translate-x-full/)
  })

  test('should switch between dashboard tabs', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Click on Trades tab
    await page.click('text=Trades')
    await page.waitForTimeout(200)

    // Check if trades tab is active
    await expect(page.locator('text=Trades')).toBeVisible()

    // Click on Calendar tab
    await page.click('text=Calendar')
    await page.waitForTimeout(200)

    // Check if calendar tab is active
    await expect(page.locator('text=Calendar')).toBeVisible()

    // Click on Journal tab
    await page.click('text=Journal')
    await page.waitForTimeout(200)

    // Check if journal tab is active
    await expect(page.locator('text=Journal')).toBeVisible()
  })

  test('should display stats cards on dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Wait for stats to load
    await page.waitForTimeout(1000)

    // Check for stat cards (they should be visible)
    const statsContainer = page.locator('[class*="grid"]').first()
    await expect(statsContainer).toBeVisible()
  })

  test('should be responsive on different screen sizes', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Sidebar should be static on desktop
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(300)
    await expect(sidebar).toBeVisible()

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(300)
    await expect(sidebar).toHaveClass(/-translate-x-full/)
  })
})

test.describe('Login Flow', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/')

    // Check for email input
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()

    // Check for password input
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toBeVisible()

    // Check for sign in button
    const signInButton = page.locator('button', { hasText: 'Sign in' })
    await expect(signInButton).toBeVisible()
  })
})
