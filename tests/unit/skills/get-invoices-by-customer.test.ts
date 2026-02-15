/**
 * Tests for get_invoices_by_customer skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInvoicesByCustomer, GetInvoicesByCustomerInputSchema } from '@/lib/skills/odoo/get-invoices-by-customer';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/skills/odoo/_client')>('@/lib/skills/odoo/_client');
  return {
    createOdooClient: vi.fn(),
    dateRange: (field: string, start: string, end: string) => [
      [field, '>=', start],
      [field, '<=', end],
    ],
    stateFilter: () => [],
    combineDomains: (...domains: any[]) => domains.flat().filter(Boolean),
    getDefaultPeriod: () => ({ start: '2025-01-01', end: '2025-01-31' }),
    formatMonto: actual.formatMonto,
  };
});

describe('Skill: get_invoices_by_customer', () => {
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
    period: { start: '2025-01-01', end: '2025-01-31' },
    limit: 10,
    state: 'posted' as const,
    invoiceType: 'out_invoice' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.createOdooClient).mockReturnValue(mockOdooClient as any);
  });

  describe('Input Validation', () => {
    it('accepts empty input with defaults', () => {
      const result = GetInvoicesByCustomerInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.state).toBe('posted');
        expect(result.data.invoiceType).toBe('out_invoice');
      }
    });

    it('accepts customerName parameter', () => {
      const result = GetInvoicesByCustomerInputSchema.safeParse({
        customerName: 'Acme Corp',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBe('Acme Corp');
      }
    });

    it('rejects invalid state', () => {
      const result = GetInvoicesByCustomerInputSchema.safeParse({
        state: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getInvoicesByCustomer.execute(
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
    it('returns empty list when no invoices found', async () => {
      mockOdooClient.readGroup.mockResolvedValue([]);

      const result = await getInvoicesByCustomer.execute(validInput, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customers).toEqual([]);
        expect(result.data.grandTotal).toBe(0);
        expect(result.data.totalInvoices).toBe(0);
      }
    });

    it('returns invoices grouped by customer', async () => {
      mockOdooClient.readGroup.mockResolvedValue([
        { partner_id: [10, 'Cliente A'], amount_total: 100000, partner_id_count: 5 },
        { partner_id: [20, 'Cliente B'], amount_total: 50000, partner_id_count: 3 },
      ]);

      const result = await getInvoicesByCustomer.execute(validInput, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customers).toHaveLength(2);
        expect(result.data.customers[0].customerName).toBe('Cliente A');
        expect(result.data.customers[0].totalAmount).toBe(100000);
        expect(result.data.grandTotal).toBe(150000);
        expect(result.data.totalInvoices).toBe(8);
      }
    });

    it('adds customerName filter to domain when provided', async () => {
      mockOdooClient.readGroup.mockResolvedValue([]);

      await getInvoicesByCustomer.execute(
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

      await getInvoicesByCustomer.execute(validInput, mockContext);

      const domain = mockOdooClient.readGroup.mock.calls[0][1];
      const hasCustomerFilter = domain.some(
        (d: any) => Array.isArray(d) && d[0] === 'partner_id.name'
      );
      expect(hasCustomerFilter).toBe(false);
    });

    it('filters out null partner_id entries', async () => {
      mockOdooClient.readGroup.mockResolvedValue([
        { partner_id: [10, 'Cliente A'], amount_total: 100000, partner_id_count: 5 },
        { partner_id: null, amount_total: 500, partner_id_count: 1 },
      ]);

      const result = await getInvoicesByCustomer.execute(validInput, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customers).toHaveLength(1);
      }
    });

    it('handles API errors gracefully', async () => {
      mockOdooClient.readGroup.mockRejectedValue(new Error('Connection error'));

      const result = await getInvoicesByCustomer.execute(validInput, mockContext);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
      }
    });
  });

  describe('Metadata', () => {
    it('has correct name', () => {
      expect(getInvoicesByCustomer.name).toBe('get_invoices_by_customer');
    });

    it('description mentions customerName filtering', () => {
      expect(getInvoicesByCustomer.description).toContain('customerName');
    });

    it('has tags including invoices', () => {
      expect(getInvoicesByCustomer.tags).toContain('invoices');
    });
  });
});
