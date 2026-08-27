import { isUserPro, countUserJournalsThisMonth } from '../pro-check';
import { getSupabaseAdmin } from '../supabase-admin-alt';

jest.mock('../supabase-admin-alt');

describe('pro-check', () => {
  const mockSupabaseAdmin = {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabaseAdmin);
  });

  describe('isUserPro', () => {
    it('should return false if supabase admin is not available', async () => {
      (getSupabaseAdmin as jest.Mock).mockReturnValue(null);
      const result = await isUserPro('user-123');
      expect(result).toBe(false);
    });

    it('should return false if no profile found', async () => {
      const result = await isUserPro('user-123');
      expect(result).toBe(false);
    });

    it('should return false if user is not PRO', async () => {
      mockSupabaseAdmin.from().select().eq.mockResolvedValue({
        data: { id: 'user-123', is_pro: false },
        error: null,
      });

      const result = await isUserPro('user-123');
      expect(result).toBe(false);
    });

    it('should return false if PRO subscription expired', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
      mockSupabaseAdmin.from().select().eq.mockResolvedValue({
        data: {
          id: 'user-123',
          is_pro: true,
          subscription_until: expiredDate,
        },
        error: null,
      });

      const result = await isUserPro('user-123');
      expect(result).toBe(false);
    });

    it('should return true if PRO subscription is active', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now
      mockSupabaseAdmin.from().select().eq.mockResolvedValue({
        data: {
          id: 'user-123',
          is_pro: true,
          subscription_until: futureDate,
        },
        error: null,
      });

      const result = await isUserPro('user-123');
      expect(result).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseAdmin.from().select().eq.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await isUserPro('user-123');
      expect(result).toBe(false);
    });
  });

  describe('countUserJournalsThisMonth', () => {
    it('should return 0 if supabase admin is not available', async () => {
      (getSupabaseAdmin as jest.Mock).mockReturnValue(null);
      const result = await countUserJournalsThisMonth('user-123');
      expect(result).toBe(0);
    });

    it('should return correct count of journals', async () => {
      mockSupabaseAdmin.from().select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            count: 5,
            error: null,
          }),
        }),
      });

      const result = await countUserJournalsThisMonth('user-123');
      expect(result).toBe(5);
    });
  });
});
