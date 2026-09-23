# 🚀 Luxtrade Testing - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies
```bash
bun install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
bun run playwright install
```

### Step 2: Start Dev Server
```bash
bun run dev
# Server will be available at http://localhost:3000
```

### Step 3: Run Tests

#### Option A: Run All Tests
```bash
bun run test              # All unit tests
bun run playwright test   # All E2E tests
```

#### Option B: Run Specific Tests
```bash
# Unit Tests
bun run test -- src/__tests__/components/TradeForm.test.tsx
bun run test -- src/__tests__/components/Sidebar.test.tsx

# E2E Tests
bun run playwright test e2e/auth.spec.ts
bun run playwright test e2e/dashboard.spec.ts
bun run playwright test e2e/trading.spec.ts
bun run playwright test e2e/accounts.spec.ts
bun run playwright test e2e/ui-accessibility.spec.ts
bun run playwright test e2e/error-handling.spec.ts
```

#### Option C: Run with Automation Script
```bash
chmod +x run-tests.sh
./run-tests.sh
```

---

## 📊 Quick Test Overview

| Test Suite | Type | Tests | Focus |
|-----------|------|-------|-------|
| TradeForm.test.tsx | Unit | 20 | Form validation, image upload, PnL calculation |
| Sidebar.test.tsx | Unit | 35 | Account deletion, confirmation modal, API calls |
| auth.spec.ts | E2E | 15 | Login, signup, form validation |
| dashboard.spec.ts | E2E | 20 | Dashboard display, navigation, account management |
| trading.spec.ts | E2E | 18 | Trade creation, image upload, form handling |
| accounts.spec.ts | E2E | 18 | Account CRUD, deletion, creation flow |
| ui-accessibility.spec.ts | E2E | 20 | Responsiveness, accessibility, dark mode, keyboard nav |
| error-handling.spec.ts | E2E | 27 | Error handling, security, validation, state management |
| **TOTAL** | - | **150+** | - |

---

## 🎯 Common Commands

### Unit Testing (Jest)
```bash
# Run all unit tests
bun run test

# Run with coverage
bun run test -- --coverage

# Watch mode (re-run on file change)
bun run test -- --watch

# Run specific test
bun run test -- TradeForm.test.tsx

# Update snapshots
bun run test -- -u
```

### E2E Testing (Playwright)
```bash
# Run all E2E tests
bun run playwright test

# Run with browser visible
bun run playwright test --headed

# Debug mode (interactive)
bun run playwright test --debug

# Run specific test
bun run playwright test e2e/auth.spec.ts

# View report
bun run playwright show-report

# Run on specific browser
bun run playwright test --project=chromium
bun run playwright test --project=firefox
bun run playwright test --project=webkit
```

---

## ✅ What's Being Tested

### 1. **Authentication** (15 tests)
- ✅ Login form validation
- ✅ Signup form validation
- ✅ Invalid credentials handling
- ✅ Email format validation
- ✅ Password confirmation match

### 2. **Trading Features** (60+ tests)
- ✅ Create new trade
- ✅ Upload trade image (with validation)
- ✅ View trade history
- ✅ Calculate PnL
- ✅ Form validation
- ✅ File size validation (max 10MB)
- ✅ Image format validation

### 3. **Account Management** (35+ tests)
- ✅ Create trading account
- ✅ Delete trading account with confirmation
- ✅ Switch between accounts
- ✅ Prevent deletion of only account
- ✅ Show trade count warning
- ✅ Account details display

### 4. **UI/UX** (20+ tests)
- ✅ Mobile responsiveness (375x667)
- ✅ Tablet responsiveness (768x1024)
- ✅ Desktop layout (1920x1080)
- ✅ Dark mode toggle
- ✅ Keyboard navigation
- �� ARIA labels and accessibility
- ✅ Loading states
- ✅ Error messages

### 5. **Error Handling** (27 tests)
- ✅ Network errors
- ✅ API timeouts
- ✅ Invalid file uploads
- ✅ Large file uploads
- ✅ Form validation errors
- ✅ Session expiry
- ✅ 404 errors
- ✅ Console error detection

### 6. **Security** (4+ tests)
- ✅ XSS prevention
- ✅ Input sanitization
- ✅ Sensitive data in URLs
- ✅ Secure headers

---

## 📈 Expected Results

### ✅ All Tests Should Pass
```
PASS src/__tests__/components/TradeForm.test.tsx
PASS src/__tests__/components/Sidebar.test.tsx
PASS e2e/auth.spec.ts
PASS e2e/dashboard.spec.ts
PASS e2e/trading.spec.ts
PASS e2e/accounts.spec.ts
PASS e2e/ui-accessibility.spec.ts
PASS e2e/error-handling.spec.ts

Test Suites: 8 passed, 8 total
Tests: 150+ passed, 150+ total
Time: ~60-120 seconds
```

### ✅ Coverage Report
```
Statements   : 80%+ covered
Branches     : 75%+ covered
Functions    : 80%+ covered
Lines        : 80%+ covered
```

---

## 🔍 Testing By Feature

### Test Trade Photo Upload
```bash
# Unit test
bun run test -- TradeForm.test.tsx

# E2E test
bun run playwright test e2e/trading.spec.ts --grep "image upload"
```

**What's tested:**
- ✅ File input rendering
- ✅ File size validation (max 10MB)
- ✅ File type validation (JPEG, PNG, WebP)
- ✅ Loading state during upload
- ✅ Image preview display
- ✅ Remove image button
- ✅ API call to `/api/trade-upload`
- ✅ Error handling for invalid files

---

### Test Account Deletion
```bash
# Unit test
bun run test -- Sidebar.test.tsx

# E2E test
bun run playwright test e2e/accounts.spec.ts --grep "deletion"
```

**What's tested:**
- ✅ Delete button visibility on hover
- ✅ Confirmation modal display
- ✅ Account details in modal
- ✅ Warning message display
- ✅ Cancel button functionality
- ✅ Delete button functionality
- ✅ API call to `/api/trading-accounts/{id}`
- ✅ Success/error toast messages
- ✅ Prevention of single account deletion

---

### Test Responsiveness
```bash
bun run playwright test e2e/ui-accessibility.spec.ts --grep "Responsiveness"
```

**What's tested:**
- ✅ Mobile viewport (375x667)
- ✅ Tablet viewport (768x1024)
- ✅ Desktop viewport (1920x1080)
- ✅ Content visibility on all sizes
- ✅ Layout adjustments
- ✅ Touch target sizes
- ✅ Form readability

---

## 🐛 Troubleshooting

### Tests not running?
```bash
# Clear node_modules and reinstall
rm -rf node_modules
bun install

# Clear Playwright cache
bun run playwright install
```

### Port 3000 already in use?
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Playwright timeout?
```bash
# Increase timeout in playwright.config.ts
timeout: 30000 // 30 seconds

# Or per test
test.setTimeout(30000)
```

### Console errors in tests?
Check `e2e/error-handling.spec.ts` for console error detection tests.

---

## 📊 Test Execution Flow

```
1. Dev Server Starts (http://localhost:3000)
                ↓
2. Unit Tests Run (Jest)
   ├─ TradeForm.test.tsx (20 tests)
   └─ Sidebar.test.tsx (35 tests)
                ↓
3. E2E Tests Run (Playwright)
   ├─ auth.spec.ts (15 tests)
   ├─ dashboard.spec.ts (20 tests)
   ├─ trading.spec.ts (18 tests)
   ├─ accounts.spec.ts (18 tests)
   ├─ ui-accessibility.spec.ts (20 tests)
   └─ error-handling.spec.ts (27 tests)
                ↓
4. Reports Generated
   ├─ Test results
   ├─ Coverage report
   └─ Summary
```

---

## 📁 File Structure

```
luxtrade/
├── TESTING_GUIDE.md              ← Full testing documentation
├── TEST_EXECUTION_REPORT.md      ← Detailed test report
├── TEST_QUICK_START.md           ← This file
├── run-tests.sh                  ← Automated test runner
│
├── src/__tests__/
│   └── components/
│       ├── TradeForm.test.tsx    ← Form & upload tests
│       └── Sidebar.test.tsx      ← Delete functionality tests
│
├── e2e/
│   ├── auth.spec.ts             ← Login/signup tests
│   ├── dashboard.spec.ts        ← Dashboard tests
│   ├── trading.spec.ts          ← Trade creation tests
│   ├── accounts.spec.ts         ← Account management tests
│   ├── ui-accessibility.spec.ts ← UI/accessibility tests
│   └── error-handling.spec.ts   ← Error handling tests
│
├── jest.config.js               ← Jest configuration
├── jest.setup.js                ← Jest setup & mocks
└── playwright.config.ts         ← Playwright configuration
```

---

## 🎓 Learning Resources

- **Jest Documentation**: https://jestjs.io/
- **Playwright Documentation**: https://playwright.dev/
- **Testing Library**: https://testing-library.com/
- **React Testing Best Practices**: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library

---

## ✨ Test Highlights

### Most Important Tests
1. **Account Deletion** (critical feature)
   ```bash
   bun run test -- Sidebar.test.tsx
   bun run playwright test e2e/accounts.spec.ts
   ```

2. **Trade Image Upload** (critical feature)
   ```bash
   bun run test -- TradeForm.test.tsx
   bun run playwright test e2e/trading.spec.ts
   ```

3. **Error Handling** (production stability)
   ```bash
   bun run playwright test e2e/error-handling.spec.ts
   ```

4. **Accessibility** (user experience)
   ```bash
   bun run playwright test e2e/ui-accessibility.spec.ts
   ```

---

## 📞 Support

**Questions? Check these files:**
- `TESTING_GUIDE.md` - Complete testing guide
- `TEST_EXECUTION_REPORT.md` - Detailed test documentation
- Individual test files in `src/__tests__/` and `e2e/` directories

**Still need help?**
1. Check test file comments for examples
2. Review jest.setup.js for mock configurations
3. Check Playwright config for browser settings

---

## 🎯 Next Steps

1. ✅ Install dependencies: `bun install`
2. ✅ Run tests: `bun run test && bun run playwright test`
3. ✅ Check coverage: `bun run test -- --coverage`
4. ✅ View reports: `bun run playwright show-report`
5. ✅ Integrate into CI/CD (GitHub Actions, etc.)

---

## 📈 Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Unit Test Coverage | 80%+ | ✅ Implemented |
| E2E Test Coverage | 100% | ✅ Comprehensive |
| Features Tested | All | ✅ Complete |
| Error Scenarios | Critical | ✅ Covered |
| Accessibility | WCAG2.1 AA | ✅ Tested |
| Responsiveness | 3+ viewports | ✅ Tested |

---

**Last Updated**: 2026-06-29  
**Status**: ✅ Ready to Run  
**Total Tests**: 150+  

**Happy Testing! 🚀**
