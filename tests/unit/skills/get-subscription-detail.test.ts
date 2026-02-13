/**
 * Tests for get_subscription_detail skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSubscriptionDetail, GetSubscriptionDetailInputSchema } from '@/lib/skills/odoo/get-subscription-detail';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
}));

describe('Skill: get_subscription_detail', () => {
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
    it('requires partnerId', () => {
      const result = GetSubscriptionDetailInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts valid partnerId with defaults', () => {
      const result = GetSubscriptionDetailInputSchema.safeParse({ partnerId: 10 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeLines).toBe(true);
        expect(result.data.subscriptionState).toBe('all');
      }
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getSubscriptionDetail.execute(
        { partnerId: 10, includeLines: true, subscriptionState: 'all' },
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('returns subscriptions with product lines', async () => {
      // Subscriptions
      mockOdoo.searchRead.mockResolvedValueOnce([
        {
          id: 100, name: 'SUB-001', subscription_state: 'in_progress', recurring_monthly: 5000,
          start_date: '2025-06-01', next_invoice_date: '2026-03-01', end_date: false,
          partner_id: [10, 'Corp A'], order_line: [200, 201],
        },
        {
          id: 101, name: 'SUB-002', subscription_state: 'paused', recurring_monthly: 2000,
          start_date: '2025-08-01', next_invoice_date: '2026-04-01', end_date: '2026-06-01',
          partner_id: [10, 'Corp A'], order_line: [202],
        },
      ]);
      // Lines
      mockOdoo.searchRead.mockResolvedValueOnce([
        { id: 200, order_id: [100, 'SUB-001'], product_id: [50, 'Plan Pro'], product_uom_qty: 1, price_unit: 3000, price_subtotal: 3000 },
        { id: 201, order_id: [100, 'SUB-001'], product_id: [51, 'Soporte Premium'], product_uom_qty: 1, price_unit: 2000, price_subtotal: 2000 },
        { id: 202, order_id: [101, 'SUB-002'], product_id: [52, 'Hosting Extra'], product_uom_qty: 2, price_unit: 1000, price_subtotal: 2000 },
      ]);

      const result = await getSubscriptionDetail.execute(
        { partnerId: 10, includeLines: true, subscriptionState: 'all' },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBe('Corp A');
        expect(result.data.totalMRR).toBe(5000); // only in_progress
        expect(result.data.totalSubscriptions).toBe(2);
        // SUB-001 lines
        expect(result.data.subscriptions[0].lines).toHaveLength(2);
        expect(result.data.subscriptions[0].lines[0].productName).toBe('Plan Pro');
        // SUB-002 lines
        expect(result.data.subscriptions[1].lines).toHaveLength(1);
        expect(result.data.subscriptions[1].stateLabel).toBe('Pausada');
        expect(result.data.subscriptions[1].endDate).toBe('2026-06-01');
      }
    });

    it('handles customer with no subscriptions', async () => {
      mockOdoo.searchRead
        // No subs
        .mockResolvedValueOnce([])
        // Partner lookup
        .mockResolvedValueOnce([{ id: 10, name: 'Corp A' }]);

      const result = await getSubscriptionDetail.execute(
        { partnerId: 10, includeLines: true, subscriptionState: 'all' },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBe('Corp A');
        expect(result.data.totalMRR).toBe(0);
        expect(result.data.subscriptions).toEqual([]);
      }
    });

    it('filters by subscription state', async () => {
      mockOdoo.searchRead.mockResolvedValueOnce([]);
      mockOdoo.searchRead.mockResolvedValueOnce([{ id: 10, name: 'Corp A' }]);

      await getSubscriptionDetail.execute(
        { partnerId: 10, includeLines: false, subscriptionState: 'in_progress' },
        mockContext
      );

      const domain = mockOdoo.searchRead.mock.calls[0][1];
      expect(domain).toContainEqual(['subscription_state', '=', 'in_progress']);
    });
  });
});
