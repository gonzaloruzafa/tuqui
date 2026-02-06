/**
 * Tests for get_account_balance skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccountBalance, GetAccountBalanceInputSchema } from '@/lib/skills/odoo/get-account-balance';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
  dateRange: (field: string, start: string, end: string) => [
    [field, '>=', start],
    [field, '<=', end],
  ],
  combineDomains: (...domains: any[]) => domains.flat().filter(Boolean),
  getDefaultPeriod: () => ({ start: '2025-01-01', end: '2025-01-31' }),
}));

describe('Skill: get_account_balance', () => {
  const mockContext: SkillContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    credentials: {
      odoo: { url: 'https://test.odoo.com', db: 'test', username: 'admin', apiKey: 'key' },
    },
  };

  const mockOdoo = { searchRead: vi.fn(), readGroup: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.createOdooClient).mockReturnValue(mockOdoo as any);
  });

  describe('Input Validation', () => {
    it('accepts empty input (defaults)', () => {
      expect(GetAccountBalanceInputSchema.safeParse({}).success).toBe(true);
    });

    it('accepts accountCode filter', () => {
      expect(GetAccountBalanceInputSchema.safeParse({ accountCode: '1.1.1' }).success).toBe(true);
    });

    it('accepts accountIds filter', () => {
      expect(GetAccountBalanceInputSchema.safeParse({ accountIds: [1, 2] }).success).toBe(true);
    });

    it('rejects invalid accountIds', () => {
      expect(GetAccountBalanceInputSchema.safeParse({ accountIds: [0] }).success).toBe(false);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR without credentials', async () => {
      const result = await getAccountBalance.execute({}, { ...mockContext, credentials: {} });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('returns account balances grouped by account', async () => {
      mockOdoo.readGroup.mockResolvedValue([
        { account_id: [10, '1.1.1.01 Caja'], debit: 5000, credit: 2000, balance: 3000 },
        { account_id: [20, '1.1.2.01 Banco'], debit: 10000, credit: 4000, balance: 6000 },
      ]);

      const result = await getAccountBalance.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accounts).toHaveLength(2);
        expect(result.data.totalBalance).toBe(9000);
        expect(result.data.totalDebit).toBe(15000);
        expect(result.data.totalCredit).toBe(6000);
      }
    });

    it('returns empty when no accounts match', async () => {
      mockOdoo.readGroup.mockResolvedValue([]);

      const result = await getAccountBalance.execute({ accountCode: '9.9.9' }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accounts).toHaveLength(0);
        expect(result.data.totalBalance).toBe(0);
      }
    });

    it('handles API errors gracefully', async () => {
      mockOdoo.readGroup.mockRejectedValue(new Error('Connection refused'));
      const result = await getAccountBalance.execute({}, mockContext);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('API_ERROR');
    });
  });

  describe('Metadata', () => {
    it('has correct name', () => expect(getAccountBalance.name).toBe('get_account_balance'));
    it('has description', () => expect(getAccountBalance.description.length).toBeGreaterThan(10));
    it('has tags', () => expect(getAccountBalance.tags).toContain('accounting'));
  });
});
