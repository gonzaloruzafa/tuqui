/**
 * Tests for get_sales_margin_summary skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSalesMarginSummary, GetSalesMarginSummaryInputSchema } from '@/lib/skills/odoo/get-sales-margin-summary';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
  dateRange: (field: string, start: string, end: string) => [
    [field, '>=', start],
    [field, '<=', end],
  ],
  combineDomains: (...domains: any[]) => domains.flat().filter(Boolean),
  getDefaultPeriod: () => ({ start: '2026-02-01', end: '2026-02-28', label: 'Este mes' }),
}));

describe('Skill: get_sales_margin_summary', () => {
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
    it('accepts empty input', () => {
      const result = GetSalesMarginSummaryInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getSalesMarginSummary.execute({}, { ...mockContext, credentials: {} });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('calculates overall margin correctly', async () => {
      mockOdoo.readGroup
        .mockResolvedValueOnce([
          { price_subtotal: 500000, product_uom_qty: 100 },
        ])
        .mockResolvedValueOnce([
          { product_id: [1, 'Producto A'], price_subtotal: 300000, product_uom_qty: 60 },
          { product_id: [2, 'Producto B'], price_subtotal: 200000, product_uom_qty: 40 },
        ]);

      mockOdoo.searchRead.mockResolvedValue([
        { id: 1, standard_price: 3000 },
        { id: 2, standard_price: 2000 },
      ]);

      mockOdoo.searchCount.mockResolvedValue(50);

      const result = await getSalesMarginSummary.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalRevenue).toBe(500000);
        expect(result.data.totalCost).toBe(260000);
        expect(result.data.totalMargin).toBe(240000);
        expect(result.data.marginPercent).toBe(48);
        expect(result.data.orderCount).toBe(50);
        expect(result.data.productCount).toBe(2);
      }
    });

    it('returns zeros when no sales', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([]);

      const result = await getSalesMarginSummary.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalRevenue).toBe(0);
        expect(result.data.totalMargin).toBe(0);
        expect(result.data.marginPercent).toBe(0);
      }
    });
  });
});
