import { rateLimitByUser, RateLimitOptions } from '../rate-limit';

jest.useFakeTimers();

describe('rate-limit', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  it('should allow requests within limit', () => {
    const options: RateLimitOptions = {
      maxRequests: 5,
      windowMs: 60000,
      message: 'Rate limit exceeded',
    };

    for (let i = 0; i < 5; i++) {
      const result = rateLimitByUser('test', 'user-123', options);
      expect(result).toBeNull();
    }
  });

  it('should reject requests beyond limit', () => {
    const options: RateLimitOptions = {
      maxRequests: 3,
      windowMs: 60000,
      message: 'Terlalu banyak permintaan',
    };

    for (let i = 0; i < 3; i++) {
      rateLimitByUser('test', 'user-123', options);
    }

    const result = rateLimitByUser('test', 'user-123', options);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
  });

  it('should reset after window expires', () => {
    const options: RateLimitOptions = {
      maxRequests: 2,
      windowMs: 60000,
      message: 'Rate limit',
    };

    rateLimitByUser('test', 'user-123', options);
    rateLimitByUser('test', 'user-123', options);

    let result = rateLimitByUser('test', 'user-123', options);
    expect(result).not.toBeNull(); // Should be rejected

    // Fast forward time past the window
    jest.advanceTimersByTime(61000);

    result = rateLimitByUser('test', 'user-123', options);
    expect(result).toBeNull(); // Should be allowed again
  });
});
