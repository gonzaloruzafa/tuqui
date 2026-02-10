/**
 * Tests for get_sales_by_category skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSalesByCategory, GetSalesByCategoryInputSchema } from '@/lib/skills/odoo/get-sales-by-category';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
  dateRange: (field: string, start: string, end: string) => [
    [field, '>=', start],
    [field, '<=', end],
  ],
  stateFilter: (state: string) => {
    if (state === 'confirmed') return [['state', 'in', ['sale', 'done']]];
    return [];
  },
  combineDomains: (...domains: any[]) => domains.flat().filter(Boolean),
  getDefaultPeriod: () => ({ start: '2025-01-01', end: '2025-01-31' }),
}));

describe('Skill: get_sales_by_category', () => {
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
    readGroup: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.createOdooClient).mockReturnValue(mockOdooClient as any);
  });

  describe('Input Validation', () => {
    it('accepts empty input with defaults', () => {
      const result = GetSalesByCategoryInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.state).toBe('confirmed');
      }
    });

    it('accepts period and limit', () => {
      const result = GetSalesByCategoryInputSchema.safeParse({
        period: { start: '2025-01-01', end: '2025-01-31' },
        limit: 5,
      });
      expect(result.success).toBe(true);
    });

    it('accepts teamId filter', () => {
      const result = GetSalesByCategoryInputSchema.safeParse({ teamId: 3 });
      expect(result.success).toBe(true);
    });
  });

  describe('Execution', () => {
    it('returns auth error without credentials', async () => {
      const noAuthContext = { ...mockContext, credentials: {} };
      const result = await getSalesByCategory.execute(
        { limit: 20, state: 'confirmed' },
        noAuthContext as any
      );
      expect(result.success).toBe(false);
    });

    it('returns categories with percentages', async () => {
      mockOdooClient.readGroup.mockResolvedValue([
        {
          'product_id.categ_id': [1, 'Equipamiento Dental'],
          product_uom_qty: 50,
          price_total: 100000,
          price_subtotal: 82645,
          order_id_count: 20,
        },
        {
          'product_id.categ_id': [2, 'Descartables'],
          product_uom_qty: 200,
          price_total: 50000,
          price_subtotal: 41322,
          order_id_count: 40,
        },
        {
          'product_id.categ_id': [3, 'Instrumental'],
          product_uom_qty: 10,
          price_total: 50000,
          price_subtotal: 41322,
          order_id_count: 5,
        },
      ]);

      const result = await getSalesByCategory.execute(
        { limit: 20, state: 'confirmed' },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categoryCount).toBe(3);
        expect(result.data.grandTotalWithTax).toBe(200000);

        // First category: 100k / 200k = 50%
        expect(result.data.categories[0].categoryName).toBe('Equipamiento Dental');
        expect(result.data.categories[0].percentage).toBe(50);
        expect(result.data.categories[0].totalWithTax).toBe(100000);

        // Second: 50k / 200k = 25%
        expect(result.data.categories[1].percentage).toBe(25);

        // Third: 50k / 200k = 25%
        expect(result.data.categories[2].percentage).toBe(25);
      }
    });

    it('handles empty results', async () => {
      mockOdooClient.readGroup.mockResolvedValue([]);

      const result = await getSalesByCategory.execute(
        { limit: 20, state: 'confirmed' },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categories).toEqual([]);
        expect(result.data.grandTotalWithTax).toBe(0);
        expect(result.data.categoryCount).toBe(0);
      }
    });

    it('filters null category entries', async () => {
      mockOdooClient.readGroup.mockResolvedValue([
        {
          'product_id.categ_id': [1, 'Equipamiento'],
          product_uom_qty: 10,
          price_total: 5000,
          order_id_count: 2,
        },
        {
          'product_id.categ_id': false,
          product_uom_qty: 5,
          price_total: 1000,
        },
      ]);

      const result = await getSalesByCategory.execute(
        { limit: 20, state: 'confirmed' },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categories.length).toBe(1);
        expect(result.data.categories[0].categoryName).toBe('Equipamiento');
      }
    });

    it('passes teamId filter to domain', async () => {
      mockOdooClient.readGroup.mockResolvedValue([]);

      await getSalesByCategory.execute(
        { limit: 20, state: 'confirmed', teamId: 3 },
        mockContext
      );

      const callDomain = mockOdooClient.readGroup.mock.calls[0][1];
      expect(callDomain).toContainEqual(['order_id.team_id', '=', 3]);
    });

    it('uses default period when not specified', async () => {
      mockOdooClient.readGroup.mockResolvedValue([]);

      const result = await getSalesByCategory.execute(
        { limit: 20, state: 'confirmed' },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.period).toEqual({
          start: '2025-01-01',
          end: '2025-01-31',
        });
      }
    });
  });

  describe('Skill metadata', () => {
    it('has correct name', () => {
      expect(getSalesByCategory.name).toBe('get_sales_by_category');
    });

    it('has category-related tags', () => {
      expect(getSalesByCategory.tags).toContain('categories');
    });
  });
});
