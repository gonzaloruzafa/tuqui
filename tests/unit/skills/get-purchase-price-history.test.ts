/**
 * Tests for get_purchase_price_history skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPurchasePriceHistory, GetPurchasePriceHistoryInputSchema } from '@/lib/skills/odoo/get-purchase-price-history';
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

describe('Skill: get_purchase_price_history', () => {
  const mockContext: SkillContext = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    credentials: {
      odoo: { url: 'https://test.odoo.com', db: 'test_db', username: 'admin', apiKey: 'key' },
    },
  };

  const mockOdoo = { searchRead: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.createOdooClient).mockReturnValue(mockOdoo as any);
  });

  describe('Input Validation', () => {
    it('requires productQuery', () => {
      const result = GetPurchasePriceHistoryInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts valid productQuery', () => {
      const result = GetPurchasePriceHistoryInputSchema.safeParse({ productQuery: 'resina' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.groupBySupplier).toBe(true);
        expect(result.data.limit).toBe(20);
      }
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getPurchasePriceHistory.execute(
        { productQuery: 'test', groupBySupplier: true, limit: 20 },
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('returns price history with supplier comparison', async () => {
      mockOdoo.searchRead.mockResolvedValueOnce([
        { id: 1, name: 'Resina Dental 3M' },
      ]);

      // Purchase order lines sorted date_order desc (as the skill requests)
      mockOdoo.searchRead.mockResolvedValueOnce([
        {
          id: 12, product_id: [1, 'Resina Dental 3M'], order_id: [102, 'PO00102'],
          partner_id: [50, 'Dental Supply SA'], price_unit: 16000, product_qty: 8,
          price_subtotal: 128000, date_order: '2026-02-05 11:00:00',
        },
        {
          id: 11, product_id: [1, 'Resina Dental 3M'], order_id: [101, 'PO00101'],
          partner_id: [51, 'MegaDental'], price_unit: 14000, product_qty: 5,
          price_subtotal: 70000, date_order: '2026-02-01 09:00:00',
        },
        {
          id: 10, product_id: [1, 'Resina Dental 3M'], order_id: [100, 'PO00100'],
          partner_id: [50, 'Dental Supply SA'], price_unit: 15000, product_qty: 10,
          price_subtotal: 150000, date_order: '2026-01-15 10:00:00',
        },
      ]);

      const result = await getPurchasePriceHistory.execute(
        { productQuery: 'resina', groupBySupplier: true, limit: 20 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.productName).toBe('Resina Dental 3M');
        expect(result.data.history).toHaveLength(3);
        expect(result.data.bySupplier).toBeDefined();
        expect(result.data.bySupplier).toHaveLength(2);
        // MegaDental cheaper avg, should be first
        expect(result.data.bySupplier![0].supplierName).toBe('MegaDental');
        expect(result.data.bySupplier![0].lastPrice).toBe(14000);
        // Price trend
        expect(result.data.priceChange).toBeDefined();
        expect(result.data.priceChange!.firstPrice).toBe(15000);
        expect(result.data.priceChange!.lastPrice).toBe(16000);
        expect(result.data.priceChange!.trend).toBe('up');
      }
    });

    it('returns empty when product not found', async () => {
      mockOdoo.searchRead.mockResolvedValueOnce([]);

      const result = await getPurchasePriceHistory.execute(
        { productQuery: 'producto inexistente', groupBySupplier: true, limit: 20 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.history).toEqual([]);
      }
    });
  });
});
