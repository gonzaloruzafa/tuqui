/**
 * Tests for get_expiring_stock skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getExpiringStock,
  GetExpiringStockInputSchema,
} from '@/lib/skills/odoo/get-expiring-stock';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
}));

describe('Skill: get_expiring_stock', () => {
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
    // Freeze time for deterministic tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-08'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Input Validation ───

  describe('Input Validation', () => {
    it('accepts empty input with defaults', () => {
      const result = GetExpiringStockInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.days_ahead).toBe(30);
        expect(result.data.include_expired).toBe(false);
        expect(result.data.limit).toBe(30);
      }
    });

    it('accepts custom days_ahead', () => {
      const result = GetExpiringStockInputSchema.safeParse({ days_ahead: 7 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.days_ahead).toBe(7);
      }
    });

    it('rejects days_ahead > 180', () => {
      const result = GetExpiringStockInputSchema.safeParse({ days_ahead: 200 });
      expect(result.success).toBe(false);
    });

    it('rejects days_ahead < 1', () => {
      const result = GetExpiringStockInputSchema.safeParse({ days_ahead: 0 });
      expect(result.success).toBe(false);
    });

    it('accepts include_expired flag', () => {
      const result = GetExpiringStockInputSchema.safeParse({
        include_expired: true,
      });
      expect(result.success).toBe(true);
    });

    it('accepts product_search', () => {
      const result = GetExpiringStockInputSchema.safeParse({
        product_search: 'leche',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty product_search', () => {
      const result = GetExpiringStockInputSchema.safeParse({
        product_search: '',
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── Authentication ───

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getExpiringStock.execute(
        { days_ahead: 30, include_expired: false, limit: 30 },
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_ERROR');
      }
    });
  });

  // ─── Execution ───

  describe('Execution', () => {
    it('returns empty when no lots found', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([]); // stock.lot

      const result = await getExpiringStock.execute(
        { days_ahead: 30, include_expired: false, limit: 30 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.products).toHaveLength(0);
        expect(result.data.summary.totalProducts).toBe(0);
        expect(result.data.summary.buckets).toHaveLength(0);
      }
      // Should only call stock.lot, not stock.quant
      expect(mockOdooClient.searchRead).toHaveBeenCalledTimes(1);
    });

    it('filters out lots with no stock (2-step query)', async () => {
      // Step 1: stock.lot returns 2 lots
      mockOdooClient.searchRead.mockResolvedValueOnce([
        {
          id: 1,
          name: 'LOT-001',
          product_id: [10, 'Leche Entera'],
          expiration_date: '2026-02-15',
        },
        {
          id: 2,
          name: 'LOT-002',
          product_id: [20, 'Yogurt Natural'],
          expiration_date: '2026-02-20',
        },
      ]);

      // Step 2: stock.quant only has stock for lot 1
      mockOdooClient.searchRead.mockResolvedValueOnce([
        {
          lot_id: [1, 'LOT-001'],
          product_id: [10, 'Leche Entera'],
          quantity: 50,
          location_id: [5, 'WH/Stock'],
        },
      ]);

      const result = await getExpiringStock.execute(
        { days_ahead: 30, include_expired: false, limit: 30 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.products).toHaveLength(1);
        expect(result.data.products[0].productName).toBe('Leche Entera');
        expect(result.data.products[0].quantity).toBe(50);
        expect(result.data.products[0].daysUntilExpiry).toBe(7);
      }
    });

    it('sorts by days until expiry ascending (most urgent first)', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([
        {
          id: 1,
          name: 'LOT-A',
          product_id: [10, 'Producto A'],
          expiration_date: '2026-03-01',
        },
        {
          id: 2,
          name: 'LOT-B',
          product_id: [20, 'Producto B'],
          expiration_date: '2026-02-10',
        },
        {
          id: 3,
          name: 'LOT-C',
          product_id: [30, 'Producto C'],
          expiration_date: '2026-02-15',
        },
      ]);

      mockOdooClient.searchRead.mockResolvedValueOnce([
        { lot_id: [1, 'LOT-A'], product_id: [10, 'Producto A'], quantity: 10, location_id: [5, 'WH'] },
        { lot_id: [2, 'LOT-B'], product_id: [20, 'Producto B'], quantity: 20, location_id: [5, 'WH'] },
        { lot_id: [3, 'LOT-C'], product_id: [30, 'Producto C'], quantity: 15, location_id: [5, 'WH'] },
      ]);

      const result = await getExpiringStock.execute(
        { days_ahead: 30, include_expired: false, limit: 30 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.products[0].productName).toBe('Producto B'); // 2 days
        expect(result.data.products[1].productName).toBe('Producto C'); // 7 days
        expect(result.data.products[2].productName).toBe('Producto A'); // 21 days
      }
    });

    it('aggregates quantity from multiple quants for same lot', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([
        {
          id: 1,
          name: 'LOT-001',
          product_id: [10, 'Leche'],
          expiration_date: '2026-02-20',
        },
      ]);

      // Same lot in 2 locations
      mockOdooClient.searchRead.mockResolvedValueOnce([
        { lot_id: [1, 'LOT-001'], product_id: [10, 'Leche'], quantity: 30, location_id: [5, 'WH/Stock'] },
        { lot_id: [1, 'LOT-001'], product_id: [10, 'Leche'], quantity: 20, location_id: [6, 'WH/Output'] },
      ]);

      const result = await getExpiringStock.execute(
        { days_ahead: 30, include_expired: false, limit: 30 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.products[0].quantity).toBe(50);
      }
    });

    it('includes expired products when include_expired is true', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([
        {
          id: 1,
          name: 'LOT-EXPIRED',
          product_id: [10, 'Yogurt Vencido'],
          expiration_date: '2026-02-01', // 7 days ago
        },
        {
          id: 2,
          name: 'LOT-SOON',
          product_id: [20, 'Leche Fresca'],
          expiration_date: '2026-02-12', // 4 days ahead
        },
      ]);

      mockOdooClient.searchRead.mockResolvedValueOnce([
        { lot_id: [1, 'LOT-EXPIRED'], product_id: [10, 'Yogurt Vencido'], quantity: 10, location_id: [5, 'WH'] },
        { lot_id: [2, 'LOT-SOON'], product_id: [20, 'Leche Fresca'], quantity: 25, location_id: [5, 'WH'] },
      ]);

      const result = await getExpiringStock.execute(
        { days_ahead: 30, include_expired: true, limit: 30 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.products).toHaveLength(2);
        // Expired first (negative days)
        expect(result.data.products[0].daysUntilExpiry).toBeLessThan(0);
        expect(result.data.products[0].productName).toBe('Yogurt Vencido');
        // Then the one expiring soon
        expect(result.data.products[1].daysUntilExpiry).toBeGreaterThan(0);
      }
    });

    it('builds correct urgency buckets', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([
        { id: 1, name: 'L1', product_id: [1, 'P1'], expiration_date: '2026-02-01' }, // expired
        { id: 2, name: 'L2', product_id: [2, 'P2'], expiration_date: '2026-02-10' }, // critical (2d)
        { id: 3, name: 'L3', product_id: [3, 'P3'], expiration_date: '2026-02-14' }, // critical (6d)
        { id: 4, name: 'L4', product_id: [4, 'P4'], expiration_date: '2026-02-25' }, // soon (17d)
        { id: 5, name: 'L5', product_id: [5, 'P5'], expiration_date: '2026-03-15' }, // later (35d)
      ]);

      mockOdooClient.searchRead.mockResolvedValueOnce([
        { lot_id: [1, 'L1'], product_id: [1, 'P1'], quantity: 5, location_id: [1, 'WH'] },
        { lot_id: [2, 'L2'], product_id: [2, 'P2'], quantity: 10, location_id: [1, 'WH'] },
        { lot_id: [3, 'L3'], product_id: [3, 'P3'], quantity: 15, location_id: [1, 'WH'] },
        { lot_id: [4, 'L4'], product_id: [4, 'P4'], quantity: 20, location_id: [1, 'WH'] },
        { lot_id: [5, 'L5'], product_id: [5, 'P5'], quantity: 30, location_id: [1, 'WH'] },
      ]);

      const result = await getExpiringStock.execute(
        { days_ahead: 60, include_expired: true, limit: 30 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const { buckets } = result.data.summary;

        const expired = buckets.find(b => b.label.includes('Vencidos'));
        expect(expired?.count).toBe(1);
        expect(expired?.totalQuantity).toBe(5);

        const critical = buckets.find(b => b.label.includes('Crítico'));
        expect(critical?.count).toBe(2);
        expect(critical?.totalQuantity).toBe(25);

        const soon = buckets.find(b => b.label.includes('Próximo'));
        expect(soon?.count).toBe(1);
        expect(soon?.totalQuantity).toBe(20);

        const later = buckets.find(b => b.label.includes('Futuro'));
        expect(later?.count).toBe(1);
        expect(later?.totalQuantity).toBe(30);
      }
    });

    it('respects limit parameter', async () => {
      const manyLots = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `LOT-${i}`,
        product_id: [i + 1, `Product ${i}`],
        expiration_date: '2026-02-20',
      }));
      mockOdooClient.searchRead.mockResolvedValueOnce(manyLots);

      const manyQuants = manyLots.map(l => ({
        lot_id: [l.id, l.name],
        product_id: l.product_id,
        quantity: 10,
        location_id: [1, 'WH'],
      }));
      mockOdooClient.searchRead.mockResolvedValueOnce(manyQuants);

      const result = await getExpiringStock.execute(
        { days_ahead: 30, include_expired: false, limit: 3 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.products).toHaveLength(3);
      }
    });

    it('passes product_search to lot domain', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([]);

      await getExpiringStock.execute(
        { days_ahead: 30, include_expired: false, limit: 30, product_search: 'leche' },
        mockContext
      );

      const lotCall = mockOdooClient.searchRead.mock.calls[0];
      expect(lotCall[0]).toBe('stock.lot');
      const domain = lotCall[1] as any[];
      const hasProductFilter = domain.some(
        (d: any) => Array.isArray(d) && d[0] === 'product_id.name' && d[2] === 'leche'
      );
      expect(hasProductFilter).toBe(true);
    });

    it('passes warehouse_id to quant domain', async () => {
      mockOdooClient.searchRead.mockResolvedValueOnce([
        { id: 1, name: 'L1', product_id: [1, 'P1'], expiration_date: '2026-02-20' },
      ]);
      mockOdooClient.searchRead.mockResolvedValueOnce([]);

      await getExpiringStock.execute(
        { days_ahead: 30, include_expired: false, limit: 30, warehouse_id: 7 },
        mockContext
      );

      const quantCall = mockOdooClient.searchRead.mock.calls[1];
      expect(quantCall[0]).toBe('stock.quant');
      const domain = quantCall[1] as any[];
      const hasWarehouseFilter = domain.some(
        (d: any) => Array.isArray(d) && d[0] === 'location_id' && d[1] === 'child_of' && d[2] === 7
      );
      expect(hasWarehouseFilter).toBe(true);
    });

    it('handles API errors gracefully', async () => {
      mockOdooClient.searchRead.mockRejectedValue(new Error('❌ Server error'));

      const result = await getExpiringStock.execute(
        { days_ahead: 30, include_expired: false, limit: 30 },
        mockContext
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
      }
    });
  });

  // ─── Metadata ───

  describe('Metadata', () => {
    it('has correct name', () => {
      expect(getExpiringStock.name).toBe('get_expiring_stock');
    });

    it('has tags including stock and expiration', () => {
      expect(getExpiringStock.tags).toContain('stock');
      expect(getExpiringStock.tags).toContain('expiration');
    });

    it('belongs to odoo tool', () => {
      expect(getExpiringStock.tool).toBe('odoo');
    });

    it('has priority set', () => {
      expect(getExpiringStock.priority).toBeDefined();
      expect(getExpiringStock.priority).toBeGreaterThan(0);
    });
  });
});
