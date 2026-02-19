/**
 * Tests for get_below_reorder_point skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBelowReorderPoint,
  GetBelowReorderPointInputSchema,
} from '@/lib/skills/odoo/get-below-reorder-point';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
}));

describe('Skill: get_below_reorder_point', () => {
  const mockContext: SkillContext = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    credentials: {
      odoo: {
        url: 'https://test.odoo.com',
        db: 'test_db',
        username: 'admin',
        apiKey: 'test-api-key',
      },
    },
  };

  const mockOdooClient = {
    searchRead: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.createOdooClient).mockReturnValue(
      mockOdooClient as any
    );
  });

  // ─── Input Validation ───

  describe('Input Validation', () => {
    it('accepts empty input with defaults', () => {
      const result = GetBelowReorderPointInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(30);
        expect(result.data.product_search).toBeUndefined();
        expect(result.data.warehouse_search).toBeUndefined();
      }
    });

    it('accepts product_search filter', () => {
      const result = GetBelowReorderPointInputSchema.safeParse({ product_search: 'cable' });
      expect(result.success).toBe(true);
    });

    it('rejects empty product_search', () => {
      const result = GetBelowReorderPointInputSchema.safeParse({ product_search: '' });
      expect(result.success).toBe(false);
    });

    it('accepts warehouse_search filter', () => {
      const result = GetBelowReorderPointInputSchema.safeParse({ warehouse_search: 'Rosario' });
      expect(result.success).toBe(true);
    });

    it('accepts custom limit', () => {
      const result = GetBelowReorderPointInputSchema.safeParse({ limit: 50 });
      expect(result.success).toBe(true);
    });

    it('rejects limit > 100', () => {
      const result = GetBelowReorderPointInputSchema.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });
  });

  // ─── Auth Error ───

  describe('Auth', () => {
    it('returns auth error when no Odoo credentials', async () => {
      const noAuthContext: SkillContext = {
        ...mockContext,
        credentials: {},
      };
      const result = await getBelowReorderPoint.execute(
        { limit: 30 },
        noAuthContext
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Odoo');
      }
    });
  });

  // ─── Execution ───

  describe('Execution', () => {
    it('returns products below reorder point', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([
        {
          id: 1,
          product_id: [42, 'Cable HDMI 2m'],
          product_min_qty: 50,
          product_max_qty: 200,
          qty_on_hand: 12,
          qty_forecast: 8,
          qty_to_order: 192,
          warehouse_id: [1, 'Depósito Central'],
        },
        {
          id: 2,
          product_id: [55, 'Mouse inalámbrico'],
          product_min_qty: 20,
          product_max_qty: 100,
          qty_on_hand: 5,
          qty_forecast: 3,
          qty_to_order: 97,
          warehouse_id: [2, 'Depósito Rosario'],
        },
      ]);

      const result = await getBelowReorderPoint.execute({ limit: 30 }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(2);
        expect(result.data.products[0].productName).toBe('Cable HDMI 2m');
        expect(result.data.products[0].qtyOnHand).toBe(12);
        expect(result.data.products[0].productMinQty).toBe(50);
        expect(result.data.products[0].qtyToOrder).toBe(192);
        expect(result.data.products[0].warehouseName).toBe('Depósito Central');
        expect(result.data.products[1].productName).toBe('Mouse inalámbrico');
      }
    });

    it('queries stock.warehouse.orderpoint with qty_to_order > 0', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([]);

      await getBelowReorderPoint.execute({ limit: 30 }, mockContext);

      expect(mockOdooClient.searchRead).toHaveBeenCalledWith(
        'stock.warehouse.orderpoint',
        [['qty_to_order', '>', 0]],
        expect.objectContaining({
          fields: expect.arrayContaining(['product_id', 'qty_on_hand', 'qty_to_order']),
          limit: 30,
          order: 'qty_to_order desc',
        })
      );
    });

    it('adds product_search filter to domain', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([]);

      await getBelowReorderPoint.execute(
        { product_search: 'cable', limit: 30 },
        mockContext
      );

      expect(mockOdooClient.searchRead).toHaveBeenCalledWith(
        'stock.warehouse.orderpoint',
        [
          ['qty_to_order', '>', 0],
          ['product_id.name', 'ilike', 'cable'],
        ],
        expect.anything()
      );
    });

    it('adds warehouse_search filter to domain', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([]);

      await getBelowReorderPoint.execute(
        { warehouse_search: 'Rosario', limit: 30 },
        mockContext
      );

      expect(mockOdooClient.searchRead).toHaveBeenCalledWith(
        'stock.warehouse.orderpoint',
        [
          ['qty_to_order', '>', 0],
          ['warehouse_id.name', 'ilike', 'Rosario'],
        ],
        expect.anything()
      );
    });

    it('handles empty results gracefully', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([]);

      const result = await getBelowReorderPoint.execute({ limit: 30 }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(0);
        expect(result.data.products).toEqual([]);
        expect(result.data._descripcion).toContain('por encima');
      }
    });

    it('handles missing warehouse_id', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([
        {
          id: 3,
          product_id: [10, 'Producto sin depósito'],
          product_min_qty: 5,
          product_max_qty: 20,
          qty_on_hand: 1,
          qty_forecast: 0,
          qty_to_order: 20,
          warehouse_id: false,
        },
      ]);

      const result = await getBelowReorderPoint.execute({ limit: 30 }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.products[0].warehouseName).toBe('Sin depósito');
      }
    });

    it('handles Odoo errors gracefully', async () => {
      mockOdooClient.searchRead.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await getBelowReorderPoint.execute({ limit: 30 }, mockContext);

      expect(result.success).toBe(false);
    });
  });
});
