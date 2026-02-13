/**
 * Tests for get_subscription_churn skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSubscriptionChurn, GetSubscriptionChurnInputSchema } from '@/lib/skills/odoo/get-subscription-churn';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
  dateRange: (field: string, start: string, end: string) => [
    [field, '>=', start],
    [field, '<=', end],
  ],
  getDefaultPeriod: () => ({ start: '2026-02-01', end: '2026-02-28', label: 'Este mes' }),
}));

describe('Skill: get_subscription_churn', () => {
  const mockContext: SkillContext = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    credentials: {
      odoo: { url: 'https://test.odoo.com', db: 'test_db', username: 'admin', apiKey: 'key' },
    },
  };

  const mockOdoo = { readGroup: vi.fn(), searchRead: vi.fn(), searchCount: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.createOdooClient).mockReturnValue(mockOdoo as any);
  });

  describe('Input Validation', () => {
    it('defaults compareWithPrevious to true', () => {
      const result = GetSubscriptionChurnInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.compareWithPrevious).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getSubscriptionChurn.execute(
        { compareWithPrevious: false, limit: 10 },
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('computes churn rate and net growth correctly', async () => {
      // Current: churned
      mockOdoo.readGroup.mockResolvedValueOnce([{ __count: 5, recurring_monthly: 10000 }]);
      // Current: new
      mockOdoo.readGroup.mockResolvedValueOnce([{ __count: 8, recurring_monthly: 18000 }]);
      // Total active
      mockOdoo.searchCount.mockResolvedValueOnce(50);
      // Previous: churned
      mockOdoo.readGroup.mockResolvedValueOnce([{ __count: 7, recurring_monthly: 15000 }]);
      // Previous: new
      mockOdoo.readGroup.mockResolvedValueOnce([{ __count: 4, recurring_monthly: 8000 }]);
      // Top churned
      mockOdoo.searchRead.mockResolvedValueOnce([
        { id: 1, name: 'SUB-001', partner_id: [10, 'Corp A'], recurring_monthly: 5000, end_date: '2026-02-15' },
      ]);

      const result = await getSubscriptionChurn.execute(
        { period: { start: '2026-02-01', end: '2026-02-28' }, compareWithPrevious: true, limit: 10 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        // Current period
        expect(result.data.current.churnedCount).toBe(5);
        expect(result.data.current.churnedMRR).toBe(10000);
        expect(result.data.current.newCount).toBe(8);
        expect(result.data.current.newMRR).toBe(18000);
        expect(result.data.current.netGrowth).toBe(3); // 8 - 5
        expect(result.data.current.netGrowthMRR).toBe(8000); // 18k - 10k
        // Churn rate: 5 / (50 + 5) = 9%
        expect(result.data.churnRate).toBe(9);
        // Trend: 5 < 7 = mejorando
        expect(result.data.trend).toBe('mejorando');
        // Top churned
        expect(result.data.topChurnedCustomers[0].partnerName).toBe('Corp A');
        expect(result.data.topChurnedCustomers[0].lostMRR).toBe(5000);
      }
    });

    it('detects empeorando trend', async () => {
      // Current: 10 churned
      mockOdoo.readGroup.mockResolvedValueOnce([{ __count: 10, recurring_monthly: 20000 }]);
      mockOdoo.readGroup.mockResolvedValueOnce([{ __count: 3, recurring_monthly: 5000 }]);
      mockOdoo.searchCount.mockResolvedValueOnce(40);
      // Previous: 5 churned
      mockOdoo.readGroup.mockResolvedValueOnce([{ __count: 5, recurring_monthly: 10000 }]);
      mockOdoo.readGroup.mockResolvedValueOnce([{ __count: 6, recurring_monthly: 12000 }]);
      mockOdoo.searchRead.mockResolvedValueOnce([]);

      const result = await getSubscriptionChurn.execute(
        { period: { start: '2026-02-01', end: '2026-02-28' }, compareWithPrevious: true, limit: 10 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.trend).toBe('empeorando');
        expect(result.data.current.netGrowth).toBe(-7); // 3 - 10
      }
    });

    it('handles zero churn gracefully', async () => {
      mockOdoo.readGroup
        .mockResolvedValueOnce([]) // no churned
        .mockResolvedValueOnce([{ __count: 5, recurring_monthly: 10000 }]); // new
      mockOdoo.searchCount.mockResolvedValueOnce(30);
      mockOdoo.searchRead.mockResolvedValueOnce([]);

      const result = await getSubscriptionChurn.execute(
        { compareWithPrevious: false, limit: 10 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current.churnedCount).toBe(0);
        expect(result.data.churnRate).toBe(0);
        expect(result.data.current.netGrowth).toBe(5);
        expect(result.data.trend).toBe('estable');
      }
    });
  });
});
