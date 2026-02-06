/**
 * Tests for get_accounts_payable skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccountsPayable, GetAccountsPayableInputSchema } from '@/lib/skills/odoo/get-accounts-payable';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
  dateRange: (field: string, start: string, end: string) => [
    [field, '>=', start],
    [field, '<=', end],
  ],
  combineDomains: (...domains: any[]) => domains.flat().filter(Boolean),
}));

describe('Skill: get_accounts_payable', () => {
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
    it('accepts empty input', () => {
      expect(GetAccountsPayableInputSchema.safeParse({}).success).toBe(true);
    });

    it('accepts overdueOnly flag', () => {
      expect(GetAccountsPayableInputSchema.safeParse({ overdueOnly: true }).success).toBe(true);
    });

    it('accepts groupBySupplier flag', () => {
      expect(GetAccountsPayableInputSchema.safeParse({ groupBySupplier: true }).success).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR without credentials', async () => {
      const result = await getAccountsPayable.execute({}, { ...mockContext, credentials: {} });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('returns payable totals', async () => {
      // Total payable
      mockOdoo.readGroup.mockResolvedValueOnce([{ amount_residual: 50000 }]);
      // Total overdue
      mockOdoo.readGroup.mockResolvedValueOnce([{ amount_residual: 15000 }]);
      // Bills for counting
      mockOdoo.searchRead.mockResolvedValue([
        { id: 1, partner_id: [10, 'Prov A'] },
        { id: 2, partner_id: [10, 'Prov A'] },
        { id: 3, partner_id: [20, 'Prov B'] },
      ]);

      const result = await getAccountsPayable.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalPayable).toBe(50000);
        expect(result.data.totalOverdue).toBe(15000);
        expect(result.data.billCount).toBe(3);
        expect(result.data.supplierCount).toBe(2);
      }
    });

    it('groups by supplier when requested', async () => {
      mockOdoo.readGroup
        .mockResolvedValueOnce([{ amount_residual: 30000 }])  // total
        .mockResolvedValueOnce([{ amount_residual: 10000 }])  // overdue
        .mockResolvedValueOnce([                               // grouped
          { partner_id: [10, 'Prov A'], amount_residual: 20000, partner_id_count: 2 },
          { partner_id: [20, 'Prov B'], amount_residual: 10000, partner_id_count: 1 },
        ]);
      mockOdoo.searchRead.mockResolvedValue([{ id: 1, partner_id: [10, 'Prov A'] }]);

      const result = await getAccountsPayable.execute({ groupBySupplier: true }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bySupplier).toHaveLength(2);
        expect(result.data.bySupplier![0].supplierName).toBe('Prov A');
      }
    });

    it('handles API errors gracefully', async () => {
      mockOdoo.readGroup.mockRejectedValue(new Error('Connection refused'));
      const result = await getAccountsPayable.execute({}, mockContext);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('API_ERROR');
    });
  });

  describe('Metadata', () => {
    it('has correct name', () => expect(getAccountsPayable.name).toBe('get_accounts_payable'));
    it('has description', () => expect(getAccountsPayable.description.length).toBeGreaterThan(10));
    it('has tags', () => expect(getAccountsPayable.tags).toContain('payable'));
  });
});
