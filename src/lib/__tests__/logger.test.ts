import { logger } from '../logger';

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should log info messages', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    logger.info('Test message', { key: 'value' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should log errors with formatted stack trace', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const error = new Error('Test error');
    logger.error('An error occurred', error);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should include context in logs', () => {
    logger.setContext({ userId: 'user-123', endpoint: '/api/test' });
    const spy = jest.spyOn(console, 'log').mockImplementation();
    logger.info('Context test');
    const output = spy.mock.calls[0][0];
    expect(output).toContain('user-123');
    expect(output).toContain('/api/test');
    spy.mockRestore();
  });

  it('should measure execution time with timed()', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    await logger.timed('test-operation', async () => {
      await new Promise(r => setTimeout(r, 10));
      return 'result';
    });
    const output = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(output).toContain('ms');
    spy.mockRestore();
  });

  it('should not include stack traces in production', () => {
    process.env.NODE_ENV = 'production';
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const error = new Error('Production error');
    logger.error('Error in production', error);
    const output = spy.mock.calls[0][0];
    expect(output).not.toContain('at ');
    spy.mockRestore();
  });
});
