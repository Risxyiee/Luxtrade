// Setup file untuk jest
// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV = 'test';

// Global test utilities
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};
