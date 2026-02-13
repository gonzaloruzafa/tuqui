/**
 * Tests for get_subscription_health skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSubscriptionHealth, GetSubscriptionHealthInputSchema } from '@/lib/skills/odoo/get-subscription-health';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
}));

describe('Skill: get_subscription_health', () => {
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
    it('accepts defaults', () => {
      const result = GetSubscriptionHealthInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expiringWithinDays).toBe(30);
        expect(result.data.limit).toBe(10);
      }
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getSubscriptionHealth.execute(
        { expiringWithinDays: 30, limit: 10 },
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('computes MRR and state breakdown correctly', async () => {
      // State breakdown
      mockOdoo.readGroup.mockResolvedValueOnce([
        { subscription_state: 'in_progress', subscription_state_count: 20, recurring_monthly: 50000 },
        { subscription_state: 'paused', subscription_state_count: 3, recurring_monthly: 5000 },
        { subscription_state: 'churn', subscription_state_count: 5, recurring_monthly: 0 },
      ]);
      // Expiring query
      mockOdoo.readGroup.mockResolvedValueOnce([
        { __count: 2, recurring_monthly: 3000 },
      ]);
      // Top customers
      mockOdoo.readGroup.mockResolvedValueOnce([
        { partner_id: [1, 'Corp A'], partner_id_count: 3, recurring_monthly: 20000 },
        { partner_id: [2, 'Corp B'], partner_id_count: 1, recurring_monthly: 15000 },
      ]);

      const result = await getSubscriptionHealth.execute(
        { expiringWithinDays: 30, limit: 10 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalMRR).toBe(50000);
        expect(result.data.totalActiveSubscriptions).toBe(20);
        expect(result.data.totalAllSubscriptions).toBe(28);
        expect(result.data.stateBreakdown).toHaveLength(3);
        // At risk: 3 paused + 2 expiring
        expect(result.data.atRisk.pausedCount).toBe(3);
        expect(result.data.atRisk.pausedMRR).toBe(5000);
        expect(result.data.atRisk.expiringCount).toBe(2);
        expect(result.data.atRisk.expiringMRR).toBe(3000);
        expect(result.data.atRisk.totalAtRiskCount).toBe(5);
        // Top customers
        expect(result.data.topCustomersByMRR[0].partnerName).toBe('Corp A');
        expect(result.data.topCustomersByMRR[0].mrr).toBe(20000);
      }
    });

    it('handles no subscriptions', async () => {
      mockOdoo.readGroup
        .mockResolvedValueOnce([]) // state breakdown
        .mockResolvedValueOnce([]) // expiring
        .mockResolvedValueOnce([]); // top customers

      const result = await getSubscriptionHealth.execute(
        { expiringWithinDays: 30, limit: 10 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalMRR).toBe(0);
        expect(result.data.totalActiveSubscriptions).toBe(0);
        expect(result.data.atRisk.totalAtRiskCount).toBe(0);
      }
    });

    it('applies teamId filter to all queries', async () => {
      mockOdoo.readGroup
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await getSubscriptionHealth.execute(
        { teamId: 5, expiringWithinDays: 30, limit: 10 },
        mockContext
      );

      // All 3 readGroup calls should include team filter
      for (const call of mockOdoo.readGroup.mock.calls) {
        const domain = call[1];
        expect(domain).toContainEqual(['team_id', '=', 5]);
      }
    });
  });
});
