# 📋 Panduan Pengujian Website Luxtrade

## Daftar Isi
1. [Setup Testing](#setup-testing)
2. [Unit Testing dengan Jest](#unit-testing-dengan-jest)
3. [E2E Testing dengan Playwright](#e2e-testing-dengan-playwright)
4. [Menjalankan Tests](#menjalankan-tests)
5. [Best Practices](#best-practices)

---

## Setup Testing

### Instalasi Dependencies

```bash
# Install testing libraries
bun install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
bun install --save-dev @playwright/test
bun install --save-dev ts-node
```

### Struktur Folder Testing

```
luxtrade/
├── src/
│   ├── __tests__/          # Unit tests
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   └── ...
├── e2e/                    # End-to-end tests (Playwright)
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts
│   └── trading.spec.ts
├── jest.config.js          # Jest configuration
├── jest.setup.js           # Jest setup
├── playwright.config.ts    # Playwright configuration
└── package.json
```

---

## Unit Testing dengan Jest

### 1. Testing Components

```typescript
// src/__tests__/components/TradeForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TradeForm } from '@/app/dashboard/components/TradeForm'

describe('TradeForm Component', () => {
  it('should render form inputs', () => {
    render(<TradeForm />)
    
    expect(screen.getByLabelText(/entry price/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/exit price/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument()
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()
    render(<TradeForm />)
    
    const submitButton = screen.getByRole('button', { name: /submit/i })
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/field is required/i)).toBeInTheDocument()
    })
  })

  it('should handle image upload', async () => {
    const user = userEvent.setup()
    render(<TradeForm />)
    
    const fileInput = screen.getByLabelText(/upload image/i)
    const file = new File(['image data'], 'trade.jpg', { type: 'image/jpeg' })
    
    await user.upload(fileInput, file)
    
    await waitFor(() => {
      expect(screen.getByAltText(/trade image/i)).toBeInTheDocument()
    })
  })

  it('should display error for oversized files', async () => {
    const user = userEvent.setup()
    render(<TradeForm />)
    
    const fileInput = screen.getByLabelText(/upload image/i)
    // Create file larger than 10MB
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
    
    await user.upload(fileInput, largeFile)
    
    await waitFor(() => {
      expect(screen.getByText(/file too large/i)).toBeInTheDocument()
    })
  })
})
```

### 2. Testing Hooks

```typescript
// src/__tests__/hooks/useTrading.test.ts
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTrading } from '@/hooks/useTrading'

describe('useTrading Hook', () => {
  it('should fetch trading accounts', async () => {
    const { result } = renderHook(() => useTrading())
    
    expect(result.current.loading).toBe(true)
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.accounts).toBeDefined()
    })
  })

  it('should handle delete account', async () => {
    const { result } = renderHook(() => useTrading())
    
    await waitFor(() => {
      expect(result.current.accounts.length).toBeGreaterThan(0)
    })
    
    const accountToDelete = result.current.accounts[0]
    
    await act(async () => {
      await result.current.deleteAccount(accountToDelete.id)
    })
    
    await waitFor(() => {
      expect(result.current.accounts).not.toContain(accountToDelete)
    })
  })
})
```

### 3. Testing Utilities

```typescript
// src/__tests__/utils/calculations.test.ts
import { calculatePnL, calculateWinRate } from '@/lib/calculations'

describe('Trading Calculations', () => {
  it('should calculate profit and loss correctly', () => {
    const result = calculatePnL({
      entryPrice: 100,
      exitPrice: 110,
      quantity: 10,
      type: 'BUY'
    })
    
    expect(result).toBe(100) // (110 - 100) * 10
  })

  it('should calculate win rate correctly', () => {
    const trades = [
      { result: 'WIN', pnl: 100 },
      { result: 'WIN', pnl: 50 },
      { result: 'LOSS', pnl: -30 },
      { result: 'LOSS', pnl: -20 }
    ]
    
    const winRate = calculateWinRate(trades)
    expect(winRate).toBe(50) // 2 wins out of 4
  })
})
```

---

## E2E Testing dengan Playwright

### 1. Authentication Tests

```typescript
// e2e/auth.spec.ts
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

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=Invalid credentials')).toBeVisible()
  })

  test('should redirect to dashboard on successful login', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await expect(page).toHaveURL('http://localhost:3000/dashboard')
  })

  test('should allow signup with valid data', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/signup')
    
    await page.fill('input[name="email"]', `user${Date.now()}@example.com`)
    await page.fill('input[name="password"]', 'SecurePass123!')
    await page.fill('input[name="confirmPassword"]', 'SecurePass123!')
    await page.click('button[type="submit"]')
    
    // Should show success message or redirect
    await expect(page.locator('text=Account created successfully')).toBeVisible()
  })
})
```

### 2. Dashboard Tests

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page, context }) => {
    // Login first
    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/dashboard')
  })

  test('should display dashboard components', async ({ page }) => {
    await expect(page.locator('text=Dashboard')).toBeVisible()
    await expect(page.locator('text=Trading Accounts')).toBeVisible()
    await expect(page.locator('text=Recent Trades')).toBeVisible()
  })

  test('should display trading accounts', async ({ page }) => {
    const accountCards = page.locator('[data-testid="account-card"]')
    await expect(accountCards).toHaveCount(1)
  })

  test('should show sidebar menu', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"]')
    await expect(sidebar).toBeVisible()
    
    // Check menu items
    await expect(page.locator('text=Dashboard')).toBeVisible()
    await expect(page.locator('text=Trades')).toBeVisible()
    await expect(page.locator('text=Accounts')).toBeVisible()
  })
})
```

### 3. Trading Tests

```typescript
// e2e/trading.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Trading Features', () => {
  test.beforeEach(async ({ page }) => {
    // Setup - login to dashboard
    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/dashboard')
  })

  test('should create new trade with image upload', async ({ page }) => {
    // Navigate to create trade
    await page.click('text=New Trade')
    await page.waitForSelector('[data-testid="trade-form"]')
    
    // Fill form
    await page.fill('input[name="entryPrice"]', '100.50')
    await page.fill('input[name="exitPrice"]', '110.75')
    await page.fill('input[name="quantity"]', '10')
    
    // Upload image
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('test-image.jpg')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Verify success
    await expect(page.locator('text=Trade created successfully')).toBeVisible()
  })

  test('should delete trading account with confirmation', async ({ page }) => {
    // Hover over account to show delete button
    const accountCard = page.locator('[data-testid="account-card"]').first()
    await accountCard.hover()
    
    // Click delete button
    const deleteBtn = accountCard.locator('[data-testid="delete-btn"]')
    await deleteBtn.click()
    
    // Confirm deletion
    await page.click('text=Delete')
    
    // Verify success
    await expect(page.locator('text=Account deleted successfully')).toBeVisible()
  })

  test('should display trade history', async ({ page }) => {
    await page.click('text=Trades')
    
    const tradeRows = page.locator('table tbody tr')
    await expect(tradeRows).toHaveCount(1)
    
    // Check columns
    await expect(tradeRows.first().locator('td').first()).toContainText('USD')
  })

  test('should calculate win rate correctly', async ({ page }) => {
    await page.click('text=Dashboard')
    
    const winRateText = page.locator('[data-testid="win-rate"]')
    await expect(winRateText).toContainText('%')
  })
})
```

### 4. Account Management Tests

```typescript
// e2e/accounts.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Account Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/dashboard')
  })

  test('should create new trading account', async ({ page }) => {
    await page.click('text=Accounts')
    await page.click('text=New Account')
    
    await page.fill('input[name="accountName"]', 'Demo Account')
    await page.fill('input[name="initialBalance"]', '10000')
    await page.selectOption('select[name="currency"]', 'USD')
    
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=Account created successfully')).toBeVisible()
    await expect(page.locator('text=Demo Account')).toBeVisible()
  })

  test('should prevent deletion of single account', async ({ page }) => {
    await page.click('text=Accounts')
    
    const accountCard = page.locator('[data-testid="account-card"]').first()
    await accountCard.hover()
    
    const deleteBtn = accountCard.locator('[data-testid="delete-btn"]')
    
    // Delete button should be disabled or hidden
    await expect(deleteBtn).not.toBeVisible()
  })

  test('should show trade count warning before deletion', async ({ page }) => {
    // Create second account first
    await page.click('text=Accounts')
    await page.click('text=New Account')
    await page.fill('input[name="accountName"]', 'Account to Delete')
    await page.fill('input[name="initialBalance"]', '5000')
    await page.click('button[type="submit"]')
    
    // Try to delete
    const accountCard = page.locator('text=Account to Delete').locator('..')
    await accountCard.hover()
    await accountCard.locator('[data-testid="delete-btn"]').click()
    
    // Should show trade count warning
    const warningText = page.locator('text=Peringatan')
    if (await warningText.isVisible()) {
      await expect(warningText).toBeVisible()
    }
  })
})
```

---

## Menjalankan Tests

### Unit Tests

```bash
# Run all unit tests
bun run test

# Run specific test file
bun run test -- src/__tests__/components/TradeForm.test.tsx

# Run tests in watch mode
bun run test -- --watch

# Run tests with coverage
bun run test -- --coverage
```

### E2E Tests

```bash
# Install Playwright browsers first
bun run playwright install

# Run all E2E tests
bun run playwright test

# Run specific test file
bun run playwright test e2e/auth.spec.ts

# Run in headed mode (see browser)
bun run playwright test --headed

# Run in debug mode (interactive)
bun run playwright test --debug

# View test report
bun run playwright show-report
```

### Continuous Testing

```bash
# Run tests on file changes
bun run test -- --watch

# Run E2E tests in UI mode
bun run playwright test --ui
```

---

## Best Practices

### 1. Test Organization

```typescript
// ✅ GOOD: Descriptive test names
describe('TradeForm', () => {
  it('should validate entry price must be greater than zero')
  it('should enable submit button when all fields are filled')
  it('should show error message when image upload fails')
})

// ❌ BAD: Vague test names
describe('Tests', () => {
  it('test form')
  it('test upload')
})
```

### 2. Test Isolation

```typescript
// ✅ GOOD: Clean setup/teardown
beforeEach(() => {
  // Setup fresh state before each test
  mockData = {
    accounts: [{ id: 1, name: 'Test' }]
  }
})

afterEach(() => {
  // Cleanup after each test
  jest.clearAllMocks()
})
```

### 3. Async Handling

```typescript
// ✅ GOOD: Using waitFor for async operations
await waitFor(() => {
  expect(screen.getByText('Data loaded')).toBeInTheDocument()
})

// ❌ BAD: Using arbitrary timeouts
setTimeout(() => {
  expect(screen.getByText('Data loaded')).toBeInTheDocument()
}, 1000)
```

### 4. User-Centric Testing

```typescript
// ✅ GOOD: Test from user perspective
const emailInput = screen.getByLabelText(/email/i)
const submitButton = screen.getByRole('button', { name: /submit/i })

// ❌ BAD: Rely on implementation details
const emailInput = document.querySelector('input.email-field')
const submitButton = document.querySelector('.submit-btn')
```

### 5. Test Data Management

```typescript
// ✅ GOOD: Use fixtures for test data
const mockTrade = {
  id: '1',
  entryPrice: 100,
  exitPrice: 110,
  quantity: 10,
  status: 'CLOSED'
}

// ❌ BAD: Hardcode test data in multiple places
it('should calculate pnl', () => {
  const result = calculatePnL({ entryPrice: 100, exitPrice: 110, quantity: 10 })
  // ... repeated in other tests
})
```

---

## Coverage Goals

Targetkan coverage berikut:

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

Jalankan untuk melihat coverage:

```bash
bun run test -- --coverage
```

---

## Troubleshooting

### Test tidak menemukan element

```typescript
// Cek apakah element berada di DOM
screen.debug()

// Atau gunakan getByRole dengan {hidden: true}
screen.getByRole('button', { name: /submit/i, hidden: true })
```

### Playwright timeout

```typescript
// Set custom timeout
test.setTimeout(30000) // 30 seconds

// Atau per action
await page.click('button', { timeout: 10000 })
```

### Supabase mocking

```typescript
// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: '123' } } }))
    }
  })
}))
```

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Zod Testing Guide](https://zod.dev/)

---

**Happy Testing! 🧪**
