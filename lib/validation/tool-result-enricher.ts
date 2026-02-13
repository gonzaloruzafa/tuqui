/**
 * Tool Result Enricher
 * 
 * Adds _context and _summary to tool results BEFORE passing them to the LLM.
 * This gives the model clear structural cues about what kind of data it's looking at,
 * preventing cross-domain confusion (e.g., mixing seller names with customer names).
 * 
 * Priority: skill.resultMeta (declared by the skill) > name-based inference (fallback).
 * The raw data is NEVER modified — only _context and _summary are prepended.
 */

// ============================================
// TYPES
// ============================================

export interface ResultMeta {
  entityLabel: string
  warning: string
}

// ============================================
// NAME-BASED FALLBACK (for skills without resultMeta)
// ============================================

const FALLBACK_MAP: Array<{ pattern: RegExp; label: string; warning: string }> = [
  { pattern: /seller|sales_team/i, label: 'VENDEDORES', warning: 'Estos son VENDEDORES del equipo, NO clientes.' },
  { pattern: /debt|overdue|aging|receivable|payable/i, label: 'DEUDA', warning: 'Los nombres son CLIENTES que deben dinero, NO vendedores.' },
  { pattern: /customer|inactive_customer|new_customer/i, label: 'CLIENTES', warning: 'Estos son CLIENTES, NO vendedores.' },
  { pattern: /subscription|churn/i, label: 'SUSCRIPCIONES', warning: 'Los nombres son CLIENTES suscriptores.' },
  { pattern: /stock|expiring|rotation/i, label: 'STOCK', warning: 'Los nombres son PRODUCTOS, NO clientes ni vendedores.' },
  { pattern: /product|margin/i, label: 'PRODUCTOS', warning: 'Estos son PRODUCTOS del catálogo.' },
  { pattern: /invoice/i, label: 'FACTURAS', warning: 'customerName = CLIENTE, sellerName = VENDEDOR.' },
  { pattern: /payment/i, label: 'PAGOS', warning: 'Los nombres son CLIENTES o PROVEEDORES.' },
  { pattern: /purchase|vendor_bill/i, label: 'COMPRAS', warning: 'Los nombres son PROVEEDORES, NO clientes.' },
  { pattern: /supplier/i, label: 'PROVEEDORES', warning: 'Estos son PROVEEDORES, NO clientes.' },
  { pattern: /crm|pipeline|opportunit/i, label: 'CRM', warning: 'Datos de oportunidades comerciales.' },
  { pattern: /journal/i, label: 'ASIENTOS', warning: 'Datos contables.' },
  { pattern: /account|balance|cash/i, label: 'CONTABILIDAD', warning: 'Datos contables.' },
]

function inferMeta(toolName: string): ResultMeta | null {
  for (const { pattern, label, warning } of FALLBACK_MAP) {
    if (pattern.test(toolName)) {
      return { entityLabel: label, warning }
    }
  }
  return null
}

// ============================================
// ENTITY EXTRACTION (for _summary generation)
// ============================================

/**
 * Extract name+amount pairs from any skill result structure.
 * Searches for arrays of objects with name-like fields.
 */
export function extractEntities(data: unknown): Array<{ name: string; amount?: number }> {
  if (!data || typeof data !== 'object') return []

  const result: Array<{ name: string; amount?: number }> = []

  if (Array.isArray(data)) {
    for (const item of data) {
      const entity = extractEntityFromObject(item)
      if (entity) result.push(entity)
    }
    return result
  }

  // Look for array fields inside the object
  for (const value of Object.values(data as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      for (const item of value) {
        const entity = extractEntityFromObject(item)
        if (entity) result.push(entity)
      }
    }
  }

  return result
}

function extractEntityFromObject(obj: unknown): { name: string; amount?: number } | null {
  if (!obj || typeof obj !== 'object') return null
  const r = obj as Record<string, unknown>

  // Find name field — check fields ending in 'Name' first, then generic 'name'
  let name: string | null = null
  for (const key of Object.keys(r)) {
    if ((key.endsWith('Name') || key === 'name' || key === 'display_name') && typeof r[key] === 'string' && (r[key] as string).length > 0) {
      name = r[key] as string
      break
    }
  }
  if (!name) return null

  // Find amount field (best effort)
  let amount: number | undefined
  for (const key of Object.keys(r)) {
    if (/total|amount|debt|revenue|mrr|balance/i.test(key) && typeof r[key] === 'number') {
      amount = r[key] as number
      break
    }
  }

  return { name, amount }
}

// ============================================
// FORMATTING
// ============================================

function formatAmount(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function buildSummary(entities: Array<{ name: string; amount?: number }>, maxItems = 5): string {
  if (entities.length === 0) return ''

  const top = entities.slice(0, maxItems)
  const lines = top.map((e, i) =>
    e.amount !== undefined
      ? `${i + 1}) ${e.name}: ${formatAmount(e.amount)}`
      : `${i + 1}) ${e.name}`
  )
  return lines.join(', ')
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Enrich a tool result with _context and _summary.
 * 
 * @param toolName - The skill name (e.g., 'get_sales_by_seller')
 * @param rawResult - The raw SkillResult from the skill execution
 * @param resultMeta - Optional metadata declared by the skill (preferred over fallback)
 */
export function enrichToolResult(
  toolName: string,
  rawResult: unknown,
  resultMeta?: ResultMeta
): unknown {
  if (!rawResult || typeof rawResult !== 'object') return rawResult
  const result = rawResult as Record<string, unknown>
  if (result.success === false) return rawResult

  // Priority: declared meta > name-based fallback
  const meta = resultMeta || inferMeta(toolName)
  if (!meta) return rawResult

  // Extract entities from the data field
  const data = result.data ?? result
  const entities = extractEntities(data)
  const summary = buildSummary(entities)

  const _context = `⚠️ DATOS DE ${meta.entityLabel} (${toolName}): ${meta.warning}`
  const _summary = summary || undefined

  return { _context, _summary, ...result }
}
