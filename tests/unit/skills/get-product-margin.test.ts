/**
 * Tests for get_product_margin skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProductMargin, GetProductMarginInputSchema } from '@/lib/skills/odoo/get-product-margin';
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

describe('Skill: get_product_margin', () => {
  const mockContext: SkillContext = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    credentials: {
      odoo: { url: 'https://test.odoo.com', db: 'test_db', username: 'admin', apiKey: 'key' },
    },
  };

  const mockOdoo = { readGroup: vi.fn(), searchRead: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.createOdooClient).mockReturnValue(mockOdoo as any);
  });

  describe('Input Validation', () => {
    it('accepts empty input with defaults', () => {
      const result = GetProductMarginInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.sortBy).toBe('margin_total');
      }
    });

    it('accepts sortBy margin_percent', () => {
      const result = GetProductMarginInputSchema.safeParse({ sortBy: 'margin_percent' });
      expect(result.success).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getProductMargin.execute(
        { limit: 20, sortBy: 'margin_total' },
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('calculates margin per product correctly', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([
        { product_id: [1, 'Producto A'], price_subtotal: 300000, product_uom_qty: 60 },
        { product_id: [2, 'Producto B'], price_subtotal: 200000, product_uom_qty: 40 },
      ]);

      mockOdoo.searchRead.mockResolvedValueOnce([
        { id: 1, standard_price: 3000 },
        { id: 2, standard_price: 2000 },
      ]);

      const result = await getProductMargin.execute(
        { limit: 20, sortBy: 'margin_total' },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.products).toHaveLength(2);
        expect(result.data.products[0].marginTotal).toBe(120000);
        expect(result.data.products[0].revenue).toBe(300000);
        expect(result.data.products[0].cost).toBe(180000);
        expect(result.data.products[0].marginPercent).toBe(40);
        expect(result.data.totals.marginPercent).toBe(48);
      }
    });

    it('returns empty when no sales', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([]);

      const result = await getProductMargin.execute(
        { limit: 20, sortBy: 'margin_total' },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.products).toEqual([]);
        expect(result.data.totals.revenue).toBe(0);
      }
    });

    it('filters by maxMarginPercent', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([
        { product_id: [1, 'Alto Margen'], price_subtotal: 100000, product_uom_qty: 10 },
        { product_id: [2, 'Bajo Margen'], price_subtotal: 50000, product_uom_qty: 10 },
      ]);

      mockOdoo.searchRead.mockResolvedValueOnce([
        { id: 1, standard_price: 2000 },
        { id: 2, standard_price: 4500 },
      ]);

      const result = await getProductMargin.execute(
        { limit: 20, sortBy: 'margin_total', maxMarginPercent: 50 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.products).toHaveLength(1);
        expect(result.data.products[0].productName).toBe('Bajo Margen');
      }
    });
  });
});
