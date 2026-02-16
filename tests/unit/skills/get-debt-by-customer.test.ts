/**
 * Tests for get_debt_by_customer skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDebtByCustomer, GetDebtByCustomerInputSchema } from '@/lib/skills/odoo/get-debt-by-customer';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/skills/odoo/_client')>('@/lib/skills/odoo/_client');
  return {
    createOdooClient: vi.fn(),
    dateRange: () => [],
    stateFilter: () => [],
    combineDomains: (...domains: any[]) => domains.flat().filter(Boolean),
    invoiceTypeFilter: (type: string) => [['move_type', '=', type]],
    formatMonto: actual.formatMonto,
  };
});

describe('Skill: get_debt_by_customer', () => {
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
    searchRead: vi.fn(),
  };

  const validInput = {
    limit: 20,
    minAmount: 0,
    includeOverdueDays: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.createOdooClient).mockReturnValue(mockOdooClient as any);
  });

  describe('Input Validation', () => {
    it('accepts empty input with defaults', () => {
      const result = GetDebtByCustomerInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.minAmount).toBe(0);
        expect(result.data.includeOverdueDays).toBe(true);
      }
    });

    it('accepts customerName parameter', () => {
      const result = GetDebtByCustomerInputSchema.safeParse({
        customerName: 'Fundacion Instituto',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBe('Fundacion Instituto');
      }
    });

    it('rejects limit below 1', () => {
      const result = GetDebtByCustomerInputSchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getDebtByCustomer.execute(
        validInput,
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_ERROR');
      }
    });
  });

  describe('Execution', () => {
    it('returns empty list when no debt found', async () => {
      mockOdooClient.readGroup.mockResolvedValue([]);

      const result = await getDebtByCustomer.execute(validInput, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customers).toEqual([]);
        expect(result.data.grandTotal).toBe(0);
      }
    });

    it('returns debt grouped by customer', async () => {
      mockOdooClient.readGroup.mockResolvedValue([
        { partner_id: [10, 'Cliente Moroso'], amount_residual: 50000, partner_id_count: 3, invoice_date: '2025-01-01' },
        { partner_id: [20, 'Otro Cliente'], amount_residual: 30000, partner_id_count: 2, invoice_date: '2025-02-01' },
      ]);

      const result = await getDebtByCustomer.execute(validInput, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customers).toHaveLength(2);
        expect(result.data.customers[0].customerName).toBe('Cliente Moroso');
        expect(result.data.customers[0].totalDebt).toBe(50000);
        expect(result.data.grandTotal).toBe(80000);
      }
    });

    it('adds customerName filter to domain when provided', async () => {
      mockOdooClient.readGroup.mockResolvedValue([]);

      await getDebtByCustomer.execute(
        { ...validInput, customerName: 'Fundacion Instituto' },
        mockContext
      );

      expect(mockOdooClient.readGroup).toHaveBeenCalledWith(
        'account.move',
        expect.arrayContaining([
          ['partner_id.name', 'ilike', 'Fundacion Instituto'],
        ]),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('does not add customerName filter when not provided', async () => {
      mockOdooClient.readGroup.mockResolvedValue([]);

      await getDebtByCustomer.execute(validInput, mockContext);

      const domain = mockOdooClient.readGroup.mock.calls[0][1];
      const hasCustomerFilter = domain.some(
        (d: any) => Array.isArray(d) && d[0] === 'partner_id.name'
      );
      expect(hasCustomerFilter).toBe(false);
    });

    it('handles API errors gracefully', async () => {
      mockOdooClient.readGroup.mockRejectedValue(new Error('Connection error'));

      const result = await getDebtByCustomer.execute(validInput, mockContext);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
      }
    });
  });

  describe('Metadata', () => {
    it('has correct name', () => {
      expect(getDebtByCustomer.name).toBe('get_debt_by_customer');
    });

    it('has tags including debt', () => {
      expect(getDebtByCustomer.tags).toContain('debt');
    });

    it('description mentions customerName filtering', () => {
      expect(getDebtByCustomer.description).toContain('customerName');
    });
  });
});
