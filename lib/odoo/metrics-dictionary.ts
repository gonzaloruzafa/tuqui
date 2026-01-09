/**
 * Metrics Dictionary - Definiciones canónicas de métricas de negocio
 *
 * Problema: "Ventas totales", "margen", "stock disponible" significan cosas diferentes
 * según quién las calcule (con/sin IVA, bruto/neto, físico/disponible).
 *
 * Solución: Un diccionario único con definiciones precisas que todos usan.
 *
 * @example
 * const def = CANONICAL_METRICS.ventas_totales
 * console.log(def.definition) // "Suma de facturas posteadas..."
 * console.log(formatMetric('ventas_totales', 100000)) // "ventas_totales: $ 100.000 (con IVA)"
 */

// ============================================
// TYPES
// ============================================

export interface MetricDefinition {
  definition: string // Definición en lenguaje natural
  model?: string // Modelo Odoo principal
  field?: string // Campo principal
  includesVAT?: boolean // Si incluye IVA
  formula?: string // Fórmula de cálculo
  example?: string // Ejemplo de valor típico
  notes?: string // Notas adicionales
}

// ============================================
// CANONICAL METRICS
// ============================================

export const CANONICAL_METRICS = {
  // === VENTAS ===
  ventas_totales: {
    definition: 'Suma de facturas de cliente posteadas (confirmadas)',
    model: 'account.move',
    field: 'amount_total',
    includesVAT: true,
    formula: 'SUM(amount_total) WHERE state=posted AND move_type=out_invoice',
    example: '$ 1.234.567 (IVA incluido)',
    notes: 'Incluye IVA. Para obtener sin IVA usar amount_untaxed',
  },

  ventas_netas: {
    definition: 'Ventas totales sin IVA (base imponible)',
    model: 'account.move',
    field: 'amount_untaxed',
    includesVAT: false,
    formula: 'SUM(amount_untaxed) WHERE state=posted AND move_type=out_invoice',
    example: '$ 1.020.000 (sin IVA)',
  },

  unidades_vendidas: {
    definition: 'Cantidad total de productos vendidos',
    model: 'sale.order.line',
    field: 'product_uom_qty',
    formula: 'SUM(product_uom_qty) WHERE state IN (sale, done)',
    example: '1.234 unidades',
  },

  // === COMPRAS ===
  compras_totales: {
    definition: 'Suma de facturas de proveedor confirmadas',
    model: 'account.move',
    field: 'amount_total',
    includesVAT: true,
    formula: 'SUM(amount_total) WHERE state=posted AND move_type=in_invoice',
    notes: 'Incluye IVA',
  },

  // === MÁRGENES ===
  margen_bruto: {
    definition: '(Precio de venta - Costo) / Precio de venta',
    includesVAT: false,
    formula: '(price_subtotal - (standard_price * qty)) / price_subtotal',
    example: '35% (sin IVA)',
    notes: 'Se calcula a nivel de línea de venta, sin IVA',
  },

  margen_bruto_total: {
    definition: 'Suma de todos los márgenes brutos en pesos',
    formula: 'SUM(price_subtotal - (standard_price * qty))',
    includesVAT: false,
    example: '$ 450.000',
  },

  // === INVENTARIO ===
  stock_disponible: {
    definition: 'Stock físico menos reservado (disponible para vender)',
    model: 'stock.quant',
    formula: 'quantity - reserved_quantity',
    example: '120 unidades',
    notes: 'Solo ubicaciones de tipo interno/stock',
  },

  stock_fisico: {
    definition: 'Stock físico total (sin considerar reservas)',
    model: 'stock.quant',
    field: 'quantity',
    formula: 'SUM(quantity) WHERE location_id.usage=internal',
    example: '150 unidades',
  },

  stock_valorizado: {
    definition: 'Valor total del inventario (cantidad × costo estándar)',
    formula: 'SUM(quantity * standard_price)',
    includesVAT: false,
    example: '$ 2.500.000',
    notes: 'Usa standard_price, no último costo de compra',
  },

  // === CAJA Y TESORERÍA ===
  caja_disponible: {
    definition: 'Efectivo disponible en cuentas contables de tipo efectivo',
    model: 'account.journal',
    formula: 'SUM(default_account_id.current_balance) WHERE type IN (cash, bank)',
    includesVAT: false,
    example: '$ 125.000',
    notes: 'Suma de caja chica + cuentas bancarias',
  },

  cobros_pendientes: {
    definition: 'Facturas de cliente confirmadas pero no cobradas',
    model: 'account.move',
    formula: 'SUM(amount_residual) WHERE state=posted AND payment_state!=paid AND move_type=out_invoice',
    includesVAT: true,
    example: '$ 450.000 pendiente de cobro',
  },

  pagos_pendientes: {
    definition: 'Facturas de proveedor confirmadas pero no pagadas',
    model: 'account.move',
    formula: 'SUM(amount_residual) WHERE state=posted AND payment_state!=paid AND move_type=in_invoice',
    includesVAT: true,
    example: '$ 280.000 pendiente de pago',
  },

  // === CLIENTES ===
  clientes_activos: {
    definition: 'Clientes con al menos una venta en el período',
    model: 'res.partner',
    formula: 'COUNT(DISTINCT partner_id) FROM sale.order WHERE state IN (sale, done)',
    example: '85 clientes',
  },

  clientes_nuevos: {
    definition: 'Clientes con primera venta en el período',
    formula: 'COUNT WHERE MIN(sale.order.date_order) está en el período',
    example: '12 clientes nuevos',
  },

  ticket_promedio: {
    definition: 'Monto promedio por orden de venta',
    formula: 'AVG(amount_total) FROM sale.order WHERE state IN (sale, done)',
    includesVAT: true,
    example: '$ 45.000 por venta',
  },

  // === PRODUCTOS ===
  productos_vendidos: {
    definition: 'Cantidad de productos únicos con ventas',
    model: 'product.product',
    formula: 'COUNT(DISTINCT product_id) FROM sale.order.line WHERE state IN (sale, done)',
    example: '245 SKUs vendidos',
  },

  productos_sin_stock: {
    definition: 'Productos con cantidad disponible <= 0',
    formula: 'COUNT WHERE (quantity - reserved_quantity) <= 0',
    example: '12 productos agotados',
  },

  rotacion_inventario: {
    definition: 'Costo de ventas / Stock promedio (veces por período)',
    formula: 'SUM(standard_price * qty_sold) / AVG(stock_valorizado)',
    example: '4.5 veces (trimestral)',
    notes: 'Mayor = mejor rotación',
  },
} as const

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Formatea una métrica con su contexto (IVA, unidad, etc.)
 */
export function formatMetric(
  name: keyof typeof CANONICAL_METRICS,
  value: number,
  options?: {
    currency?: string
    locale?: string
  }
): string {
  const metric = CANONICAL_METRICS[name]
  const { currency = 'ARS', locale = 'es-AR' } = options || {}

  // Determinar formato según tipo de métrica
  let formattedValue: string

  if (name.includes('_promedio') || name.includes('ticket') || name.includes('margen_bruto')) {
    // Métricas monetarias
    formattedValue = `$ ${value.toLocaleString(locale)}`
  } else if (name.includes('unidades') || name.includes('productos') || name.includes('clientes')) {
    // Conteos
    formattedValue = value.toLocaleString(locale)
  } else if (name.includes('margen') && !name.includes('_total')) {
    // Porcentajes
    formattedValue = `${value.toFixed(1)}%`
  } else {
    // Default: monetario
    formattedValue = `$ ${value.toLocaleString(locale)}`
  }

  // Agregar contexto de IVA si aplica
  const vatSuffix = metric.includesVAT !== undefined ?
    (metric.includesVAT ? ' (con IVA)' : ' (sin IVA)') : ''

  return `${formattedValue}${vatSuffix}`
}

/**
 * Obtiene definición de una métrica
 */
export function getMetricDefinition(name: keyof typeof CANONICAL_METRICS): MetricDefinition {
  return CANONICAL_METRICS[name]
}

/**
 * Busca métricas relacionadas por nombre parcial
 */
export function findMetrics(searchTerm: string): Array<{ name: string; definition: MetricDefinition }> {
  const lowerSearch = searchTerm.toLowerCase()
  return Object.entries(CANONICAL_METRICS)
    .filter(([name, _]) => name.toLowerCase().includes(lowerSearch))
    .map(([name, definition]) => ({ name, definition }))
}

/**
 * Genera prompt snippet con definiciones de métricas relevantes
 */
export function getMetricsPromptSnippet(metricNames?: Array<keyof typeof CANONICAL_METRICS>): string {
  const metricsToInclude = metricNames || (Object.keys(CANONICAL_METRICS) as Array<keyof typeof CANONICAL_METRICS>)

  const snippets = metricsToInclude.map((name) => {
    const metric = CANONICAL_METRICS[name]
    const vatInfo = metric.includesVAT !== undefined ?
      (metric.includesVAT ? ' (CON IVA)' : ' (SIN IVA)') : ''
    return `- **${name}**: ${metric.definition}${vatInfo}`
  })

  return `
## Métricas Canónicas (usar estas definiciones)

${snippets.join('\n')}

**IMPORTANTE**: Estas son las definiciones oficiales. No inventar otras definiciones.
`.trim()
}

/**
 * Valida que una métrica esté en el diccionario
 */
export function isValidMetric(name: string): name is keyof typeof CANONICAL_METRICS {
  return name in CANONICAL_METRICS
}
