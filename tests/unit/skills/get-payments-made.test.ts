/**
 * Tests for get_payments_made skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPaymentsMade, GetPaymentsMadeInputSchema } from '@/lib/skills/odoo/get-payments-made';
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

describe('Skill: get_payments_made', () => {
  const mockContext: SkillContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    credentials: {
      odoo: { url: 'https://test.odoo.com', db: 'test', username: 'admin', apiKey: 'key' },
    },
  };

  const mockOdoo = { readGroup: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.createOdooClient).mockReturnValue(mockOdoo as any);
  });

  describe('Input Validation', () => {
    it('accepts empty input', () => {
      expect(GetPaymentsMadeInputSchema.safeParse({}).success).toBe(true);
    });

    it('accepts groupByJournal', () => {
      expect(GetPaymentsMadeInputSchema.safeParse({ groupByJournal: true }).success).toBe(true);
    });

    it('accepts groupBySupplier', () => {
      expect(GetPaymentsMadeInputSchema.safeParse({ groupBySupplier: true }).success).toBe(true);
    });

    it('accepts journalIds', () => {
      expect(GetPaymentsMadeInputSchema.safeParse({ journalIds: [1, 2] }).success).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR without credentials', async () => {
      const result = await getPaymentsMade.execute({ groupByJournal: false, groupBySupplier: false, limit: 20 }, { ...mockContext, credentials: {} });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('returns total payments made', async () => {
      mockOdoo.readGroup.mockResolvedValue([{ amount: 75000, __count: 12 }]);

      const result = await getPaymentsMade.execute({ groupByJournal: false, groupBySupplier: false, limit: 20 }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalAmount).toBe(75000);
        expect(result.data.paymentCount).toBe(12);
        expect(result.data.period).toBeDefined();
      }
    });

    it('returns zero when no payments', async () => {
      mockOdoo.readGroup.mockResolvedValue([{}]);

      const result = await getPaymentsMade.execute({ groupByJournal: false, groupBySupplier: false, limit: 20 }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalAmount).toBe(0);
        expect(result.data.paymentCount).toBe(0);
      }
    });

    it('groups by journal when requested', async () => {
      // Total
      mockOdoo.readGroup.mockResolvedValueOnce([{ amount: 50000, __count: 5 }]);
      // By journal
      mockOdoo.readGroup.mockResolvedValueOnce([
        { journal_id: [1, 'Banco Nación'], amount: 30000, journal_id_count: 3 },
        { journal_id: [2, 'Efectivo'], amount: 20000, journal_id_count: 2 },
      ]);

      const result = await getPaymentsMade.execute({ groupByJournal: true, groupBySupplier: false, limit: 20 }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.byJournal).toHaveLength(2);
        expect(result.data.byJournal![0].groupName).toBe('Banco Nación');
      }
    });

    it('handles API errors gracefully', async () => {
      mockOdoo.readGroup.mockRejectedValue(new Error('Connection refused'));
      const result = await getPaymentsMade.execute({ groupByJournal: false, groupBySupplier: false, limit: 20 }, mockContext);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('API_ERROR');
    });
  });

  describe('Metadata', () => {
    it('has correct name', () => expect(getPaymentsMade.name).toBe('get_payments_made'));
    it('has description', () => expect(getPaymentsMade.description.length).toBeGreaterThan(10));
    it('has tags', () => expect(getPaymentsMade.tags).toContain('payments'));
  });
});
