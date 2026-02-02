# Phase 0: Skills Refactor Planning Document

**Date**: 2026-01-25
**Status**: PENDING APPROVAL
**Author**: Senior Software Architect (Claude)

---

## Executive Summary

This document outlines the refactoring plan to transform Tuqui Agents Alpha from a monolithic "God Tools" architecture to a modular, testable, multi-tenant **Skills-based platform**.

### The Problem
The current `odoo_intelligent_query` approach forces the LLM to generate SQL/JSON-RPC queries via a 500+ line system prompt. This results in:
- Erratic and unreliable query results
- Hallucination of data and names
- Difficulty testing individual operations
- High prompt token consumption
- Complex debugging when queries fail

### The Solution
Transform Tools into containers of **atomic, typed, testable Skills**. The LLM decides *which* skill to use; the code executes *how* to do it deterministically.

---

## 1. Current Architecture Analysis

### 1.1 Files Inventory

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| **lib/tools/gemini-odoo-v2.ts** | GOD TOOL - BI Agent with intelligent query | 1050 | DECOMPOSE |
| lib/tools/gemini-odoo.ts | Re-export of v2 (backwards compat) | 23 | DELETE AFTER |
| lib/tools/executor.ts | Tool loader for agents | 26 | EXTEND |
| lib/tools/web-search.ts | Unified web search tool | 507 | KEEP |
| lib/tools/native-gemini.ts | Native Gemini SDK wrapper | 149 | KEEP |
| lib/tools/odoo/client.ts | Odoo JSON-RPC client | 261 | KEEP (used by Skills) |
| lib/tools/odoo/query-builder.ts | Domain builder + query execution | 1365 | PARTIALLY KEEP |
| lib/tools/odoo/semantic-layer.ts | Field suggestions and schema | 271 | KEEP |
| lib/tools/odoo/insights.ts | Insight generation from results | 494 | KEEP |
| lib/tools/odoo/comparisons.ts | Period comparison logic | ~300 | KEEP |
| lib/mercadolibre/link-validator.ts | ML URL validation | 245 | KEEP |
| lib/mercadolibre/cache.ts | ML query cache | 163 | KEEP |
| lib/agents/router.ts | Intent routing by keywords | 427 | KEEP |
| lib/agents/service.ts | Agent CRUD and config | 364 | KEEP |
| lib/tenants/service.ts | Tenant management | 109 | KEEP |
| lib/supabase/client.ts | Supabase with RLS | 284 | KEEP |
| lib/validation/strict-validator.ts | Anti-hallucination validation | 454 | KEEP |
| lib/validation/response-guard.ts | Response quality guard | 280 | KEEP |

**Total lib/ lines**: ~7,134

### 1.2 Identified "God Tool" (to decompose)

#### `odoo_intelligent_query` in gemini-odoo-v2.ts

**Current Flow:**
```
User Question
    ↓
BI_ANALYST_PROMPT (500+ lines of instructions)
    ↓
LLM generates: { model, operation, filters, groupBy, ... }
    ↓
query-builder.ts parses filters → Odoo domain
    ↓
OdooClient executes query
    ↓
LLM interprets results
    ↓
StrictValidator checks for hallucinations
```

**Problems:**
1. LLM must "understand" Odoo data model from prompt
2. Natural language filters require complex parsing (800+ lines in query-builder)
3. State filters auto-applied but often incorrect
4. No unit testing of individual operations
5. Single failure point - entire tool breaks if any step fails

### 1.3 Credential Flow Analysis (CORRECT - No Changes Needed)

```typescript
// Current flow (WORKING)
getOdooClient(tenantId)
  → getTenantClient(tenantId)          // Sets RLS context
    → getClient()                       // Supabase singleton
    → db.rpc('set_tenant_context')      // PostgreSQL session var
  → db.from('integrations')
    .eq('type', 'odoo')
    .single()
  → decrypt(config.api_key)
  → new OdooClient(config)
```

**Verified Multi-Tenant:**
- Credentials stored in `integrations` table with `tenant_id`
- RLS policies filter by `current_tenant_id()`
- Each tenant has isolated Odoo credentials
- API key encrypted at rest

---

## 2. Skills Mapping

### 2.1 TOOL: Odoo

Decomposing `odoo_intelligent_query` into atomic Skills:

| Skill Name | Input Params | Output Type | Priority | Complexity | Current Code |
|------------|--------------|-------------|----------|------------|--------------|
| **SALES** | | | | | |
| `get_sales_total` | period, state? | SalesSummary | HIGH | LOW | executeQueries + aggregate |
| `get_sales_by_customer` | period, limit?, state? | GroupedSales | HIGH | LOW | readGroup + partner_id |
| `get_sales_by_product` | period, limit?, state? | GroupedSales | HIGH | LOW | readGroup + product_id |
| `get_sales_by_seller` | period, limit?, state? | GroupedSales | HIGH | MEDIUM | readGroup + user_id |
| `get_sales_trend` | months, compareYoY? | SalesTrend | MEDIUM | MEDIUM | readGroup + date grouping |
| `search_sale_orders` | filters, limit? | SaleOrder[] | MEDIUM | LOW | searchRead |
| **INVOICES** | | | | | |
| `get_invoices_total` | period, type?, state? | InvoiceSummary | HIGH | LOW | aggregate |
| `get_debt_by_customer` | limit?, minAmount? | DebtSummary | HIGH | MEDIUM | readGroup + amount_residual |
| `get_overdue_invoices` | daysOverdue? | Invoice[] | HIGH | LOW | searchRead + date filter |
| `get_invoices_by_customer` | period, limit? | GroupedInvoices | MEDIUM | LOW | readGroup |
| **PAYMENTS** | | | | | |
| `get_payments_received` | period | PaymentSummary | HIGH | LOW | aggregate + inbound |
| `get_payments_made` | period | PaymentSummary | HIGH | LOW | aggregate + outbound |
| `get_cash_balance` | journalIds? | CashBalance | HIGH | MEDIUM | readGroup by journal |
| **STOCK** | | | | | |
| `get_product_stock` | productId, warehouseId? | StockLevel | HIGH | LOW | searchRead + stock.quant |
| `get_low_stock_products` | minQty?, categoryId? | LowStockItem[] | MEDIUM | LOW | searchRead + filter |
| `get_stock_valuation` | warehouseId? | StockValuation | MEDIUM | MEDIUM | readGroup + value |
| **PURCHASES** | | | | | |
| `get_purchases_total` | period, state? | PurchaseSummary | MEDIUM | LOW | aggregate |
| `get_purchases_by_supplier` | period, limit? | GroupedPurchases | MEDIUM | LOW | readGroup |
| **CRM** | | | | | |
| `get_pipeline_summary` | userId? | PipelineSummary | MEDIUM | LOW | readGroup by stage |
| `get_opportunities_by_stage` | userId?, minAmount? | OpportunityGroup[] | MEDIUM | LOW | readGroup |
| `get_stale_opportunities` | daysOld? | Opportunity[] | LOW | LOW | searchRead + date filter |
| **DISCOVERY** | | | | | |
| `inspect_model_fields` | model | ModelSchema | LOW | LOW | fieldsGet |
| `get_distinct_values` | model, field | DistinctValues | LOW | LOW | readGroup |

### 2.2 TOOL: MercadoLibre (Web Search)

Current `web_search` tool is already well-structured. Minor refactor to Skills pattern:

| Skill Name | Input Params | Output Type | Priority | Complexity |
|------------|--------------|-------------|----------|------------|
| `search_web_general` | query | SearchResult | HIGH | LOW |
| `search_product_prices` | productName, marketplace? | PriceResults | HIGH | MEDIUM |
| `compare_competitor_prices` | productName, ourPrice | PriceComparison | MEDIUM | MEDIUM |

### 2.3 Dependencies Graph

```
get_debt_by_customer
  └── uses: get_invoices_by_customer (aggregated)

get_sales_trend
  └── uses: get_sales_total (for each period)

compare_competitor_prices
  └── uses: search_product_prices
  └── uses: get_sales_by_product (for our price)
```

---

## 3. Proposed Skill Interface

### 3.1 Base Types (lib/skills/types.ts)

```typescript
import { z } from 'zod';

// Base context passed to every skill
export interface SkillContext {
  userId: string;
  tenantId: string;
  credentials: TenantCredentials;
  locale?: string;
}

// Credential types per integration
export interface TenantCredentials {
  odoo?: OdooCredentials;
  // Future: mercadolibre?, google?, etc.
}

export interface OdooCredentials {
  url: string;
  db: string;
  username: string;
  apiKey: string;  // Already decrypted
}

// Standard skill definition
export interface Skill<TInput extends z.ZodType, TOutput> {
  name: string;
  description: string;      // Used by LLM to decide when to use
  tool: string;             // Parent tool (odoo, meli, calendar)
  inputSchema: TInput;
  execute: (
    input: z.infer<TInput>,
    context: SkillContext
  ) => Promise<SkillResult<TOutput>>;
}

// Standardized result wrapper
export type SkillResult<T> =
  | { success: true; data: T; metadata?: Record<string, unknown> }
  | { success: false; error: SkillError };

export interface SkillError {
  code: 'AUTH_ERROR' | 'VALIDATION_ERROR' | 'API_ERROR' | 'NOT_FOUND' | 'RATE_LIMIT';
  message: string;
  details?: unknown;
}

// Period specification (common input)
export const PeriodSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().optional(),
});

export type Period = z.infer<typeof PeriodSchema>;
```

### 3.2 Example Skill Implementation

```typescript
// lib/skills/odoo/get-sales-by-customer.ts

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult, Period } from '../types';
import { createOdooClient } from '@/lib/skills/odoo/_client';
import { PeriodSchema } from '../types';

// Input Schema
export const GetSalesByCustomerInput = z.object({
  period: PeriodSchema,
  limit: z.number().min(1).max(100).default(10),
  state: z.enum(['all', 'confirmed', 'draft']).default('confirmed'),
});

// Output Type
export interface CustomerSales {
  customerId: number;
  customerName: string;
  orderCount: number;
  totalAmount: number;
}

export interface SalesByCustomerResult {
  customers: CustomerSales[];
  totalAmount: number;
  totalOrders: number;
  period: Period;
}

// Skill Implementation
export const getSalesByCustomer: Skill<
  typeof GetSalesByCustomerInput,
  SalesByCustomerResult
> = {
  name: 'get_sales_by_customer',
  description: 'Get sales grouped by customer for a period. Use when user asks "top customers", "who bought most", "sales by client".',
  tool: 'odoo',
  inputSchema: GetSalesByCustomerInput,

  async execute(input, context): Promise<SkillResult<SalesByCustomerResult>> {
    if (!context.credentials.odoo) {
      return {
        success: false,
        error: { code: 'AUTH_ERROR', message: 'Odoo credentials not configured' },
      };
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      // Build deterministic domain
      const domain: any[] = [
        ['date_order', '>=', input.period.start],
        ['date_order', '<=', input.period.end],
      ];

      // State filter
      if (input.state === 'confirmed') {
        domain.push(['state', 'in', ['sale', 'done']]);
      } else if (input.state === 'draft') {
        domain.push(['state', '=', 'draft']);
      }

      // Execute aggregation
      const grouped = await odoo.readGroup(
        'sale.order',
        domain,
        ['partner_id', 'amount_total:sum'],
        ['partner_id'],
        { limit: input.limit, orderBy: 'amount_total desc' }
      );

      // Transform results
      const customers: CustomerSales[] = grouped.map(g => ({
        customerId: g.partner_id[0],
        customerName: g.partner_id[1],
        orderCount: g.partner_id_count || g.__count || 1,
        totalAmount: g.amount_total || 0,
      }));

      const totalAmount = customers.reduce((sum, c) => sum + c.totalAmount, 0);
      const totalOrders = customers.reduce((sum, c) => sum + c.orderCount, 0);

      return {
        success: true,
        data: {
          customers,
          totalAmount,
          totalOrders,
          period: input.period,
        },
      };

    } catch (err) {
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: err instanceof Error ? err.message : 'Unknown Odoo error',
          details: err,
        },
      };
    }
  },
};
```

---

## 4. Test Strategy

### 4.1 Unit Test Template

```typescript
// lib/skills/odoo/__tests__/get-sales-by-customer.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSalesByCustomer } from '../get-sales-by-customer';
import type { SkillContext } from '../../types';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
}));

describe('Skill: get_sales_by_customer', () => {
  const mockContext: SkillContext = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    credentials: {
      odoo: {
        url: 'https://test.odoo.com',
        db: 'test_db',
        username: 'admin',
        apiKey: 'test-key',
      },
    },
  };

  describe('Input Validation', () => {
    it('rejects invalid period format', () => {
      const result = getSalesByCustomer.inputSchema.safeParse({
        period: { start: '2025/01/01', end: '2025-01-31' },
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid input with defaults', () => {
      const result = getSalesByCustomer.inputSchema.safeParse({
        period: { start: '2025-01-01', end: '2025-01-31' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.state).toBe('confirmed');
      }
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const noCredsContext = { ...mockContext, credentials: {} };
      const result = await getSalesByCustomer.execute(
        { period: { start: '2025-01-01', end: '2025-01-31' } },
        noCredsContext
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_ERROR');
      }
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('uses tenant-specific credentials', async () => {
      const { createOdooClient } = await import('@/lib/skills/odoo/_client');

      await getSalesByCustomer.execute(
        { period: { start: '2025-01-01', end: '2025-01-31' } },
        mockContext
      );

      expect(createOdooClient).toHaveBeenCalledWith(mockContext.credentials.odoo);
    });
  });

  describe('Query Execution', () => {
    it('builds correct domain for confirmed sales', async () => {
      const { createOdooClient } = await import('@/lib/skills/odoo/_client');
      const mockReadGroup = vi.fn().mockResolvedValue([
        { partner_id: [1, 'Customer A'], amount_total: 1000, __count: 5 },
        { partner_id: [2, 'Customer B'], amount_total: 500, __count: 3 },
      ]);
      (createOdooClient as any).mockReturnValue({ readGroup: mockReadGroup });

      const result = await getSalesByCustomer.execute(
        { period: { start: '2025-01-01', end: '2025-01-31' }, state: 'confirmed' },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockReadGroup).toHaveBeenCalledWith(
        'sale.order',
        expect.arrayContaining([
          ['date_order', '>=', '2025-01-01'],
          ['date_order', '<=', '2025-01-31'],
          ['state', 'in', ['sale', 'done']],
        ]),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('returns correct totals', async () => {
      const { createOdooClient } = await import('@/lib/skills/odoo/_client');
      (createOdooClient as any).mockReturnValue({
        readGroup: vi.fn().mockResolvedValue([
          { partner_id: [1, 'Customer A'], amount_total: 1000, __count: 5 },
          { partner_id: [2, 'Customer B'], amount_total: 500, __count: 3 },
        ]),
      });

      const result = await getSalesByCustomer.execute(
        { period: { start: '2025-01-01', end: '2025-01-31' } },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalAmount).toBe(1500);
        expect(result.data.totalOrders).toBe(8);
        expect(result.data.customers).toHaveLength(2);
      }
    });
  });
});
```

### 4.2 Integration Test Strategy

```markdown
## Integration Tests (Real Odoo Sandbox)

### Prerequisites
- Odoo sandbox with test data
- Test tenant with credentials in CI secrets

### Test Cases
1. **Smoke Test**: Each skill executes without error
2. **Data Integrity**: Known product returns expected stock
3. **Performance**: Response time < 3s for standard queries
4. **Multi-tenant**: User A cannot see User B data
```

---

## 5. Dead Code Candidates

### 5.1 Files to Remove After Migration

| File | Reason | Safe to Remove When |
|------|--------|---------------------|
| `lib/tools/gemini-odoo.ts` | Just re-exports v2 | Skills fully deployed |
| `lib/tools/gemini-odoo-v2.ts` | Replaced by Skills | Skills fully deployed |
| Parts of `query-builder.ts` | `buildDomain()` replaced | Skills use typed domains |

### 5.2 Functions to Remove

In `query-builder.ts`:
- `buildDomain()` - 350 lines of NLP parsing → replaced by typed skill inputs
- `executeSingleQuery()` - replaced by individual skill execute()
- `executeQueries()` - no longer needed for parallel sub-queries

In `gemini-odoo-v2.ts`:
- `BI_ANALYST_PROMPT` - 500+ lines → replaced by skill descriptions
- `odooIntelligentQueryDeclaration` - replaced by skill registry
- `executeIntelligentQuery()` - replaced by skill executor
- `streamChatWithOdoo()` - refactored to use skill router

### 5.3 Code to Keep

- `OdooClient` class - used by all skills
- `MODEL_CONFIG` - used for field metadata
- `generateInsights()` - can be called post-skill execution
- `StrictValidator` - still validates LLM responses
- `suggestFieldCorrection()` - error recovery

---

## 6. Migration Strategy

### 6.1 Phase 1: Foundation (Week 1)
- [ ] Create `lib/skills/types.ts` with base interfaces
- [ ] Create `lib/skills/registry.ts` for skill loading
- [ ] Create `lib/skills/odoo/_client.ts` (thin wrapper over existing)
- [ ] Set up test infrastructure with mocks

### 6.2 Phase 2: Priority Skills (Week 2)
- [ ] `get_sales_total` + tests
- [ ] `get_sales_by_customer` + tests
- [ ] `get_debt_by_customer` + tests
- [ ] `get_product_stock` + tests
- [ ] `get_payments_received` + tests

### 6.3 Phase 3: Secondary Skills (Week 3)
- [ ] `get_sales_by_product` + tests
- [ ] `get_sales_by_seller` + tests
- [ ] `get_invoices_total` + tests
- [ ] `get_overdue_invoices` + tests
- [ ] `get_low_stock_products` + tests

### 6.4 Phase 4: Integration (Week 4)
- [ ] Create skill router in `lib/skills/router.ts`
- [ ] Update `app/api/chat/route.ts` to use Skills
- [ ] Run parallel with old system for comparison
- [ ] A/B test with real users

### 6.5 Phase 5: Cleanup (Week 5)
- [ ] Remove deprecated God Tool code
- [ ] Update documentation
- [ ] Performance benchmarking

---

## 7. Risk Assessment

### 7.1 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Skills don't cover all edge cases | MEDIUM | HIGH | Keep old system as fallback during migration |
| LLM chooses wrong skill | MEDIUM | MEDIUM | Improve skill descriptions, add fallback to "discover" |
| Performance regression | LOW | MEDIUM | Skills should be faster (no NLP parsing) |
| Multi-tenant leakage | LOW | CRITICAL | Unit tests verify credential isolation |

### 7.2 Rollback Plan

1. Keep `gemini-odoo-v2.ts` intact until Skills proven stable
2. Feature flag to switch between old/new systems
3. Monitor error rates and fallback automatically if > 5%

---

## 8. Success Criteria

A skill is **complete** when:
- [ ] Input schema defined with Zod
- [ ] Output type defined with TypeScript interface
- [ ] `execute()` function implemented with deterministic logic
- [ ] Unit tests pass (mocked dependencies)
- [ ] Auth/credential check implemented
- [ ] Error handling returns proper SkillError
- [ ] Description is clear enough for LLM to choose correctly

The refactor is **successful** when:
- [ ] All 20+ skills implemented and tested
- [ ] Error rate < 5% in production
- [ ] Response time improved by 20%+
- [ ] No hallucination of customer/product names
- [ ] Developers can add new skills in < 1 hour

---

## 9. Approval Request

**Architect Recommendation**: Proceed with Phase 1 (Foundation)

**Required Decisions:**
1. Confirm skill list covers business requirements
2. Approve test strategy
3. Allocate resources for 5-week implementation

**Next Steps Upon Approval:**
1. Create `lib/skills/` directory structure
2. Implement base types and registry
3. Build first 5 priority skills with tests

---

*Document version: 1.0*
*Last updated: 2026-01-25*
