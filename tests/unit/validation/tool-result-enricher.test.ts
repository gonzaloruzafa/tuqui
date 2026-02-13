/**
 * Tests for Tool Result Enricher
 * 
 * Validates that:
 * 1. Skills with resultMeta get correct _context and _summary
 * 2. Skills without resultMeta fall back to name-based inference
 * 3. Unknown tools pass through unchanged
 * 4. Error results are never enriched
 * 5. Entity extraction works across different output shapes
 */

import { describe, test, expect } from 'vitest'
import { enrichToolResult, extractEntities } from '../../../lib/validation/tool-result-enricher'

// ============================================
// MOCK DATA (realistic skill outputs)
// ============================================

const sellerResult = {
  success: true,
  data: {
    sellers: [
      { sellerId: 1, sellerName: 'Martín Travella C.', orderCount: 120, totalWithTax: 3900000000 },
      { sellerId: 2, sellerName: 'Maico Moyano', orderCount: 95, totalWithTax: 2749000000 },
      { sellerId: 3, sellerName: 'Luciana Cavallero', orderCount: 40, totalWithTax: 391000000 },
    ],
    grandTotalWithTax: 7040000000,
    sellerCount: 3,
  },
}

const customerDebtResult = {
  success: true,
  data: {
    customers: [
      { customerId: 10, customerName: 'Gaveno S.A.S.', totalDebt: 11000000 },
      { customerId: 11, customerName: 'Truedent S.A.', totalDebt: 23500000 },
      { customerId: 12, customerName: 'Odonto-Lógica', totalDebt: 63953513 },
    ],
    grandTotal: 98453513,
    customerCount: 3,
  },
}

const productStockResult = {
  success: true,
  data: {
    products: [
      { productId: 1, productName: 'Resina 3M Filtek Z350', qtyAvailable: 150, totalValue: 5000000 },
      { productId: 2, productName: 'Anestesia Carticaína', qtyAvailable: 300, totalValue: 2000000 },
    ],
  },
}

const errorResult = {
  success: false,
  error: { code: 'AUTH_ERROR', message: 'Invalid credentials' },
}

const emptyResult = {
  success: true,
  data: { sellers: [], grandTotalWithTax: 0, sellerCount: 0 },
}

// ============================================
// TESTS: enrichToolResult with resultMeta
// ============================================

describe('enrichToolResult', () => {
  describe('with declared resultMeta (preferred path)', () => {
    const sellerMeta = { entityLabel: 'VENDEDORES', warning: 'Estos son VENDEDORES, NO clientes.' }
    const customerMeta = { entityLabel: 'CLIENTES', warning: 'Estos son CLIENTES, NO vendedores.' }

    test('adds _context with entityLabel and warning', () => {
      const enriched = enrichToolResult('get_sales_by_seller', sellerResult, sellerMeta) as any
      expect(enriched._context).toContain('VENDEDORES')
      expect(enriched._context).toContain('NO clientes')
    })

    test('adds _summary with entity names and amounts', () => {
      const enriched = enrichToolResult('get_sales_by_seller', sellerResult, sellerMeta) as any
      expect(enriched._summary).toContain('Martín Travella C.')
      expect(enriched._summary).toContain('Maico Moyano')
      expect(enriched._summary).toContain('$3.9B')
    })

    test('preserves all original data', () => {
      const enriched = enrichToolResult('get_sales_by_seller', sellerResult, sellerMeta) as any
      expect(enriched.success).toBe(true)
      expect(enriched.data.sellers).toHaveLength(3)
      expect(enriched.data.sellers[0].sellerName).toBe('Martín Travella C.')
      expect(enriched.data.grandTotalWithTax).toBe(7040000000)
    })

    test('customer debt gets correct labels', () => {
      const enriched = enrichToolResult('get_debt_by_customer', customerDebtResult, customerMeta) as any
      expect(enriched._context).toContain('CLIENTES')
      expect(enriched._context).toContain('NO vendedores')
      expect(enriched._summary).toContain('Gaveno S.A.S.')
      expect(enriched._summary).toContain('Truedent S.A.')
    })

    test('resultMeta overrides name-based inference', () => {
      const customMeta = { entityLabel: 'EQUIPO COMERCIAL', warning: 'Datos del equipo.' }
      const enriched = enrichToolResult('get_mystery_data', sellerResult, customMeta) as any
      expect(enriched._context).toContain('EQUIPO COMERCIAL')
    })
  })

  describe('without resultMeta (name-based fallback)', () => {
    test('infers VENDEDORES from tool name containing seller', () => {
      const enriched = enrichToolResult('get_sales_by_seller', sellerResult) as any
      expect(enriched._context).toContain('VENDEDORES')
    })

    test('infers DEUDA from tool name containing debt', () => {
      const enriched = enrichToolResult('get_debt_by_customer', customerDebtResult) as any
      expect(enriched._context).toContain('DEUDA')
    })

    test('infers STOCK from tool name containing stock', () => {
      const enriched = enrichToolResult('get_product_stock', productStockResult) as any
      expect(enriched._context).toContain('STOCK')
    })

    test('unknown tool name passes through unchanged', () => {
      const raw = { success: true, data: { foo: 'bar' } }
      const enriched = enrichToolResult('do_something_weird', raw)
      expect(enriched).toEqual(raw) // no _context or _summary added
    })
  })

  describe('edge cases', () => {
    test('error results are never enriched', () => {
      const enriched = enrichToolResult('get_sales_by_seller', errorResult)
      expect(enriched).toEqual(errorResult)
      expect((enriched as any)._context).toBeUndefined()
    })

    test('null/undefined results pass through', () => {
      expect(enrichToolResult('get_sales_by_seller', null)).toBeNull()
      expect(enrichToolResult('get_sales_by_seller', undefined)).toBeUndefined()
    })

    test('non-object results pass through', () => {
      expect(enrichToolResult('get_sales_by_seller', 'string')).toBe('string')
    })

    test('empty arrays get no _summary', () => {
      const enriched = enrichToolResult('get_sales_by_seller', emptyResult) as any
      expect(enriched._context).toBeDefined()
      expect(enriched._summary).toBeUndefined()
    })
  })
})

// ============================================
// TESTS: extractEntities
// ============================================

describe('extractEntities', () => {
  test('extracts from array of objects with *Name fields', () => {
    const entities = extractEntities({
      sellers: [
        { sellerName: 'Alice', totalWithTax: 1000 },
        { sellerName: 'Bob', totalWithTax: 2000 },
      ],
    })
    expect(entities).toEqual([
      { name: 'Alice', amount: 1000 },
      { name: 'Bob', amount: 2000 },
    ])
  })

  test('extracts from objects with "name" field', () => {
    const entities = extractEntities({
      items: [
        { name: 'Widget A', amount: 500 },
        { name: 'Widget B', amount: 300 },
      ],
    })
    expect(entities).toHaveLength(2)
    expect(entities[0].name).toBe('Widget A')
  })

  test('handles objects without amount fields', () => {
    const entities = extractEntities({
      customers: [
        { customerName: 'Acme Corp', email: 'acme@test.com' },
      ],
    })
    expect(entities).toEqual([{ name: 'Acme Corp', amount: undefined }])
  })

  test('returns empty for non-array data', () => {
    expect(extractEntities({ total: 5000 })).toEqual([])
  })

  test('returns empty for null/undefined', () => {
    expect(extractEntities(null)).toEqual([])
    expect(extractEntities(undefined)).toEqual([])
  })

  test('handles nested debt fields', () => {
    const entities = extractEntities({
      customers: [
        { customerName: 'Gaveno S.A.S.', totalDebt: 11000000 },
      ],
    })
    expect(entities[0]).toEqual({ name: 'Gaveno S.A.S.', amount: 11000000 })
  })
})
