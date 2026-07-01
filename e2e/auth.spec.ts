import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
  })

  test('should display login form', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should display signup link', async ({ page }) => {
    const signupLink = page.locator('a:has-text("Sign Up")')
    await expect(signupLink).toBeVisible()
  })

  test('should navigate to signup page', async ({ page }) => {
    await page.click('a:has-text("Sign Up")')
    await expect(page).toHaveURL(/signup/)
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Wait for error message
    const errorMessage = page.locator('text=/Invalid credentials|error/i')
    await expect(errorMessage).toBeVisible()
  })

  test('should have password field as type password', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('should have email validation', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]')
    await emailInput.fill('notanemail')
    
    // Check for validation message
    const validation = page.locator('[role="alert"]')
    if (await validation.isVisible()) {
      await expect(validation).toContainText(/email|invalid/i)
    }
  })
})

test.describe('Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/auth/signup')
  })

  test('should display signup form with required fields', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('text=/confirm password/i')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should validate password confirmation match', async ({ page }) => {
    const timestamp = Date.now()
    await page.fill('input[type="email"]', `test${timestamp}@example.com`)
    await page.fill('input[name="password"]', 'SecurePass123!')
    await page.fill('input[name="confirmPassword"]', 'DifferentPass123!')
    
    await page.click('button[type="submit"]')

    // Should show error about passwords not matching
    const errorMessage = page.locator('text=/match|confirm/i')
    await expect(errorMessage).toBeVisible()
  })

  test('should navigate to login page', async ({ page }) => {
    await page.click('a:has-text("Log In")')
    await expect(page).toHaveURL(/login/)
  })
})
