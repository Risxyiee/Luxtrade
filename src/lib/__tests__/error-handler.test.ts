import { handleApiError, validateEnvVars, assertEnvVar } from '../error-handler';
import { logger } from '../logger';

jest.mock('../logger');

describe('error-handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleApiError', () => {
    it('should return generic message in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Sensitive database error');
      const response = handleApiError(error);
      const body = JSON.parse(response.body as any);
      expect(body.error).toBe('Terjadi kesalahan pada server');
    });

    it('should log error details', () => {
      const error = new Error('Test error');
      handleApiError(error, { endpoint: '/api/test', userId: 'user-123' });
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('API error'),
        error,
        expect.objectContaining({ userId: 'user-123', endpoint: '/api/test' })
      );
    });

    it('should handle specific error codes', () => {
      const error = { code: 'UNAUTHORIZED' };
      const response = handleApiError(error);
      expect(response.status).toBe(401);
    });
  });

  describe('validateEnvVars', () => {
    it('should return valid=true when all vars present', () => {
      process.env.TEST_VAR_1 = 'value1';
      process.env.TEST_VAR_2 = 'value2';
      const result = validateEnvVars('TEST_VAR_1', 'TEST_VAR_2');
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return missing vars', () => {
      delete process.env.MISSING_VAR;
      const result = validateEnvVars('MISSING_VAR');
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('MISSING_VAR');
    });
  });

  describe('assertEnvVar', () => {
    it('should throw error if var missing', () => {
      delete process.env.MISSING_ASSERT_VAR;
      expect(() => {
        assertEnvVar('MISSING_ASSERT_VAR');
      }).toThrow('Missing required environment variable');
    });

    it('should return value if present', () => {
      process.env.PRESENT_VAR = 'test-value';
      expect(assertEnvVar('PRESENT_VAR')).toBe('test-value');
    });
  });
});
