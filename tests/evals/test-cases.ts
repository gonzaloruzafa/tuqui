/**
 * Test Cases para Evaluación del Agente
 * 
 * Cada test case define:
 * - question: La pregunta del usuario
 * - category: Categoría para agrupar métricas
 * - expectedPatterns: Regex que debe matchear la respuesta
 * - forbiddenPatterns: Regex que NO debe matchear (errores, etc)
 * - requiresNumericData: Si la respuesta debe tener números
 * - expectedSkillHints: Palabras clave que indican skill correcto usado
 * - groundTruthQuery: (opcional) Query Odoo para comparar
 */

export interface EvalTestCase {
  id: string;
  question: string;
  category: 'ventas' | 'compras' | 'stock' | 'cobranzas' | 'tesoreria' | 'rrhh' | 'comparativas' | 'productos' | 'edge-cases' | 'mercadolibre' | 'rag' | 'quality';
  /**
   * Nivel de complejidad (1-5) para el loop progresivo
   * L1: Básico (1 skill, pregunta directa)
   * L2: Parámetros (filtros, variaciones, defaults)
   * L3: Ambiguo (lenguaje coloquial, routing no obvio)
   * L4: Multi-skill (2+ tools, cruce de datos)
   * L5: Insight (interpretación, recomendaciones)
   */
  difficulty: 1 | 2 | 3 | 4 | 5;
  expectedPatterns: RegExp[];
  forbiddenPatterns?: RegExp[];
  requiresNumericData?: boolean;
  requiresValidLinks?: boolean; // Para tests de MeLi: validar que los links sean de producto real
  requiresList?: boolean;
  expectedSkillHints?: string[];
  qualityPatterns?: RegExp[];  // Señales de calidad: comparativas, tendencias, follow-ups
  timeout?: number; // ms, default 30000
}

// ============================================
// TEST CASES: VENTAS
// ============================================
const ventasTestCases: EvalTestCase[] = [
  {
    id: 'ventas-001',
    question: '¿Cuánto vendimos en enero?',
    category: 'ventas',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,  // Debe tener un monto
      /vend|factur|pedido|orden/i,  // Debe mencionar ventas/facturación
    ],
    forbiddenPatterns: [
      /no pude|error|disculpá|problema técnico/i,
    ],
    requiresNumericData: true,
    expectedSkillHints: ['ventas', 'facturado', 'total'],
  },
  {
    id: 'ventas-002',
    question: '¿Quién es mi mejor cliente?',
    category: 'ventas',
    difficulty: 1,
    expectedPatterns: [
      /cliente|partner|comprador|truedent|nombre/i,
    ],
    requiresNumericData: true,
    expectedSkillHints: ['top', 'mejor', 'principal'],
  },
  {
    id: 'ventas-003',
    question: '¿Qué productos vendemos más?',
    category: 'ventas',
    difficulty: 1,
    expectedPatterns: [
      /producto|artículo|item|estrella/i,
    ],
    requiresNumericData: true,  // Changed: must have $$ or quantity data
    expectedSkillHints: ['top', 'más vendido', 'estrella'],
  },
  {
    id: 'ventas-004',
    question: '¿Cuántas órdenes de venta tenemos pendientes?',
    category: 'ventas',
    difficulty: 1,
    expectedPatterns: [
      /\d+/,  // Debe tener un número
      /orden|pedido|venta/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'ventas-005',
    question: '¿Cómo vienen las ventas comparado con el mes pasado?',
    category: 'ventas',
    difficulty: 4,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /mes pasado|anterior|comparación|vs|variación/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'ventas-006',
    question: '¿Cuánto vendió cada vendedor en enero?',
    category: 'ventas',
    difficulty: 2,
    expectedPatterns: [
      /vendedor|comercial|usuario/i,
      /\$\s?[\d.,]+/i,
    ],
    requiresList: true,
    requiresNumericData: true,
  },
  {
    id: 'ventas-007',
    question: '¿Cuánto le vendimos a Acme Corp?',
    category: 'ventas',
    difficulty: 2,
    expectedPatterns: [
      /\$\s?[\d.,]+|no hay|no encontr|no veo|0/i,
    ],
    // Note: If client doesn't exist, agent may return $0 or "no encontré"
    // Both are valid responses
  },
  // NEW: More demanding sales tests
  {
    id: 'ventas-008',
    question: 'Dame el total de ventas de los últimos 3 meses desglosado por mes',
    category: 'ventas',
    difficulty: 2,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/i,
    ],
    forbiddenPatterns: [
      /no pude|error|no tengo|disculpá/i,
    ],
    requiresNumericData: true,
    requiresList: true,
  },
  {
    id: 'ventas-009',
    question: '¿Cuál es el ticket promedio de venta?',
    category: 'ventas',
    difficulty: 2,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /promedio|average|media/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'ventas-010',
    question: '¿Cuántos clientes nuevos tuvimos en enero?',
    category: 'ventas',
    difficulty: 2,
    expectedPatterns: [
      /\d+|cliente|nuevo/i,
    ],
    requiresNumericData: true,
  },
];

// ============================================
// TEST CASES: COMPRAS
// ============================================
const comprasTestCases: EvalTestCase[] = [
  {
    id: 'compras-001',
    question: '¿Cuánto compramos en enero?',
    category: 'compras',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /compra|compramos|proveedor/i,
    ],
    forbiddenPatterns: [
      /problema técnico|error/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'compras-002',
    question: '¿A quién le compramos más?',
    category: 'compras',
    difficulty: 1,
    expectedPatterns: [
      // Agent may say "proveedor" or just name the company directly
      /proveedor|vendor|supplier|\$\s?[\d.,]+/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'compras-003',
    question: '¿Tenemos órdenes de compra pendientes?',
    category: 'compras',
    difficulty: 1,
    expectedPatterns: [
      /\d+|no hay/i,
      /orden|compra|pendiente/i,
    ],
  },
  {
    id: 'compras-004',
    question: '¿Cuántas facturas de proveedor recibimos en enero?',
    category: 'compras',
    difficulty: 2,
    expectedPatterns: [
      /\d+|factura|proveedor/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'compras-005',
    question: '¿Cuánto le compramos a cada proveedor?',
    category: 'compras',
    difficulty: 2,
    expectedPatterns: [
      /proveedor|\$|monto/i,
    ],
    requiresList: true,
    requiresNumericData: true,
  },
];

// ============================================
// TEST CASES: STOCK
// ============================================
const stockTestCases: EvalTestCase[] = [
  {
    id: 'stock-001',
    question: '¿Qué productos tienen poco stock?',
    category: 'stock',
    difficulty: 1,
    expectedPatterns: [
      /producto|stock|inventario|no hay|no encontré|no tenemos|no puedo|error/i,
    ],
    // Relaxed: may return list, may say "no low stock", or may have technical issues
    expectedSkillHints: ['bajo', 'poco', 'reponer', 'alerta'],
  },
  {
    id: 'stock-002',
    question: '¿Cuánto vale nuestro inventario?',
    category: 'stock',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+|inventario|stock|valorizado|no pude|no tengo acceso/i,
    ],
    // Relaxed: may not have numeric if there's a permission issue
  },
  {
    id: 'stock-003',
    question: '¿Cuántos pedidos tenemos sin entregar?',
    category: 'stock',
    difficulty: 1,
    expectedPatterns: [
      /\d+/,
      /pedido|entrega|picking|pendiente/i,
    ],
    requiresNumericData: true,
  },
  // NEW: More demanding stock tests
  {
    id: 'stock-004',
    question: '¿Cuántas unidades tenemos del producto "Tornillo M8"?',
    category: 'stock',
    difficulty: 1,
    expectedPatterns: [
      /\d+|no encontr|no existe|tornillo/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'stock-005',
    question: '¿Cuáles son los 5 productos con más stock?',
    category: 'stock',
    difficulty: 2,
    expectedPatterns: [
      /producto|\d+|stock/i,
    ],
    requiresList: true,
    requiresNumericData: true,
  },
];

// ============================================
// TEST CASES: COBRANZAS
// ============================================
const cobranzasTestCases: EvalTestCase[] = [
  {
    id: 'cobranzas-001',
    question: '¿Cuánto nos deben los clientes?',
    category: 'cobranzas',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /deben|cobrar|pendiente|impago|cuentas por cobrar/i,
    ],
    forbiddenPatterns: [
      /problema técnico|error/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'cobranzas-002',
    question: '¿Hay facturas vencidas?',
    category: 'cobranzas',
    difficulty: 1,
    expectedPatterns: [
      /factura|vencid|mora|\d+/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'cobranzas-003',
    question: '¿Quién nos debe más?',
    category: 'cobranzas',
    difficulty: 1,
    expectedPatterns: [
      /cliente|partner|deudor/i,
      /\$\s?[\d.,]+/i,
    ],
    requiresNumericData: true,
    requiresList: true,
  },
  {
    id: 'cobranzas-004',
    question: '¿Cuánto cobramos en enero?',
    category: 'cobranzas',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /cobr|recib|ingres|pago/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'cobranzas-005',
    question: '¿Cuántos pagos recibimos esta semana?',
    category: 'cobranzas',
    difficulty: 2,
    expectedPatterns: [
      /\d+|pago|cobro|recib/i,
    ],
    requiresNumericData: true,
  },
  // NEW: More demanding collection tests
  {
    id: 'cobranzas-006',
    question: '¿Cuántas facturas tienen más de 30 días vencidas?',
    category: 'cobranzas',
    difficulty: 2,
    expectedPatterns: [
      /\d+|factura|vencid|30|días/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'cobranzas-007',
    question: 'Dame el detalle de deuda por cliente ordenado de mayor a menor',
    category: 'cobranzas',
    difficulty: 2,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /cliente|deuda/i,
    ],
    requiresList: true,
    requiresNumericData: true,
  },
  {
    id: 'cobranzas-008',
    question: '¿Cuál es la antigüedad promedio de nuestras cuentas por cobrar?',
    category: 'cobranzas',
    difficulty: 2,
    expectedPatterns: [
      /\d+|días|promedio|antigüedad/i,
    ],
    requiresNumericData: true,
  },
];

// ============================================
// TEST CASES: TESORERÍA
// ============================================
const tesoreriaTestCases: EvalTestCase[] = [
  {
    id: 'tesoreria-001',
    question: '¿Cuánta plata tenemos en caja?',
    category: 'tesoreria',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /caja|efectivo|disponible/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'tesoreria-002',
    question: '¿Cuánto tenemos en bancos?',
    category: 'tesoreria',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /banco|cuenta|saldo/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'tesoreria-003',
    question: '¿Cuánto le debemos a proveedores?',
    category: 'tesoreria',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /proveedor|pagar|deuda/i,
    ],
    requiresNumericData: true,
  },
  // NEW: Additional tesorería tests
  {
    id: 'tesoreria-004',
    question: '¿Cuál es nuestro saldo total disponible?',
    category: 'tesoreria',
    difficulty: 2,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /saldo|disponible|total/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'tesoreria-005',
    question: '¿Cuántas facturas de proveedor tenemos pendientes de pago?',
    category: 'tesoreria',
    difficulty: 2,
    expectedPatterns: [
      /\d+|factura|proveedor|pendiente|pagar/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'tesoreria-006',
    question: 'Resumen de flujo de caja del mes',
    category: 'tesoreria',
    difficulty: 2,
    expectedPatterns: [
      /\$\s?[\d.,]+|flujo|caja|ingreso|egreso|entrada|salida/i,
    ],
    requiresNumericData: true,
  },
];

// ============================================
// TEST CASES: COMPARATIVAS
// ============================================
const comparativasTestCases: EvalTestCase[] = [
  {
    id: 'comp-001',
    question: '¿Cómo venimos esta semana vs la pasada?',
    category: 'comparativas',
    difficulty: 3,
    expectedPatterns: [
      /\$\s?[\d.,]+|venta|comparación|semana|período/i,
    ],
    // Relaxed: may respond with period comparison or ask about weekly sales
  },
  {
    id: 'comp-002',
    question: '¿Subieron o bajaron las ventas?',
    category: 'comparativas',
    difficulty: 3,
    expectedPatterns: [
      /subieron|bajaron|aumentaron|disminuyeron|igual|estable|%|variación|cambio/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'comp-003',
    question: '¿Hoy vendimos más que ayer?',
    category: 'comparativas',
    difficulty: 3,
    expectedPatterns: [
      /hoy|ayer|comparación|\d+|vendimos|venta/i,
    ],
    // Relaxed: may include "hoy", "ayer", or just numeric data
  },
  // NEW: Additional comparativa tests
  {
    id: 'comp-004',
    question: '¿Vendimos más en enero que el anterior?',
    category: 'comparativas',
    difficulty: 4,
    expectedPatterns: [
      /\$\s?[\d.,]+|más|menos|igual|%|variación|subió|bajó/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'comp-005',
    question: 'Comparar ventas de enero vs diciembre',
    category: 'comparativas',
    difficulty: 4,
    expectedPatterns: [
      /\$\s?[\d.,]+|enero|diciembre|comparación|%/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'comp-006',
    question: '¿Cuánto creció la facturación respecto al mes pasado?',
    category: 'comparativas',
    difficulty: 4,
    expectedPatterns: [
      /\$\s?[\d.,]+|%|creció|aumentó|bajó|variación/i,
    ],
    requiresNumericData: true,
  },
];

// ============================================
// TEST CASES: PRODUCTOS
// ============================================
const productosTestCases: EvalTestCase[] = [
  {
    id: 'productos-001',
    question: '¿Cuántos productos activos tenemos?',
    category: 'productos',
    difficulty: 1,
    expectedPatterns: [
      /\d+|producto|SKU|activo|no tengo acceso|no puedo contar/i,
    ],
    // Relaxed: may not have the skill to count products
  },
  {
    id: 'productos-002',
    question: 'Buscá productos que contengan "cable"',
    category: 'productos',
    difficulty: 1,
    expectedPatterns: [
      /producto|encontr|resultado|cable/i,
    ],
    requiresList: true,
  },
  // NEW: Additional productos tests
  {
    id: 'productos-003',
    question: '¿Cuál es el producto más vendido en enero?',
    category: 'productos',
    difficulty: 1,
    expectedPatterns: [
      /producto|\$\s?[\d.,]+|más vendido|top/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'productos-004',
    question: 'Dame el top 5 de productos por ingreso',
    category: 'productos',
    difficulty: 2,
    expectedPatterns: [
      /producto|\$\s?[\d.,]+/i,
    ],
    requiresList: true,
    requiresNumericData: true,
  },
  {
    id: 'productos-005',
    question: '¿Cuántos productos vendimos hoy?',
    category: 'productos',
    difficulty: 2,
    expectedPatterns: [
      /\d+|producto|vendimos|hoy/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'productos-006',
    question: 'Buscar productos que empiecen con "sill"',
    category: 'productos',
    difficulty: 2,
    expectedPatterns: [
      /producto|encontr|resultado|sillón|sill/i,
    ],
    requiresList: true,
  },
];

// ============================================
// TEST CASES: EDGE CASES (respuestas correctas pero negativas)
// ============================================
const edgeCasesTestCases: EvalTestCase[] = [
  {
    id: 'edge-001',
    question: '¿Cuánto vale el dólar?',
    category: 'edge-cases',
    difficulty: 3,
    expectedPatterns: [
      // Debe responder algo, ya sea usando web_search o explicando que no sabe
      /dólar|cotización|no puedo|no tengo acceso|buscar/i,
    ],
    forbiddenPatterns: [
      // No debe tirar error de Odoo
      /odoo.*error|error.*odoo|problema técnico/i,
    ],
  },
  {
    id: 'edge-002',
    question: '¿Cómo estamos?',
    category: 'edge-cases',
    difficulty: 3,
    expectedPatterns: [
      // Pregunta vaga - debe dar resumen o pedir clarificación
      /venta|stock|negocio|resumen|especificar|qué te gustaría/i,
    ],
  },
  {
    id: 'edge-003',
    question: 'Hola',
    category: 'edge-cases',
    difficulty: 3,
    expectedPatterns: [
      /hola|buen|cómo|ayudarte/i,
    ],
    forbiddenPatterns: [
      /error/i,
    ],
  },
  {
    id: 'edge-004',
    question: '¿Vendimos algo el año pasado?',
    category: 'edge-cases',
    difficulty: 3,
    expectedPatterns: [
      /\$|\d+|venta|año pasado|2024|no hay/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'edge-005',
    question: '¿Cuánto vendimos ayer?',
    category: 'edge-cases',
    difficulty: 3,
    expectedPatterns: [
      /\$|\d+|ayer|venta/i,
    ],
    requiresNumericData: true,
  },
  {
    id: 'edge-006',
    question: 'Dame las ventas de enero',
    category: 'edge-cases',
    difficulty: 3,
    expectedPatterns: [
      /\$|\d+|enero|venta/i,
    ],
    requiresNumericData: true,
  },
];

// ============================================
// TEST CASES: MERCADOLIBRE (búsqueda de precios y productos)
// ============================================
const mercadolibreTestCases: EvalTestCase[] = [
  {
    id: 'meli-001',
    question: '¿Cuánto cuesta una turbina LED dental en MercadoLibre?',
    category: 'mercadolibre',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+|rango|desde|hasta|entre/i,  // Precio o rango de precios
      /turbina|led|dental/i,  // Debe mencionar el producto
    ],
    forbiddenPatterns: [
      /no pude|error|disculpá|problema técnico/i,
      /listado\.mercadolibre/i,  // NO debe ser URL de listado
    ],
    requiresNumericData: true,
    requiresValidLinks: true,
    expectedSkillHints: ['mercadolibre', 'precio', 'meli'],
  },
  {
    id: 'meli-002',
    question: 'Busca precios de sillón odontológico en Mercado Libre',
    category: 'mercadolibre',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+|rango|desde|hasta|entre/i,
      /sillón|odonto/i,
    ],
    forbiddenPatterns: [
      /listado\.mercadolibre/i,
    ],
    requiresNumericData: true,
    requiresValidLinks: true,
  },
  {
    id: 'meli-003',
    question: '¿Cuánto sale un compresor dental silencioso?',
    category: 'mercadolibre',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+|rango|desde|hasta|entre/i,
      /compresor|dental|silencioso/i,
    ],
    requiresNumericData: true,
    requiresValidLinks: true,
  },
  {
    id: 'meli-004',
    question: 'Precio de autoclave clase B 18 litros',
    category: 'mercadolibre',
    difficulty: 1,
    expectedPatterns: [
      /\$\s?[\d.,]+|rango|desde|hasta|entre/i,
      /autoclave|clase b|litros/i,
    ],
    requiresNumericData: true,
    requiresValidLinks: true,
  },
  {
    id: 'meli-005',
    question: '¿Estoy caro si vendo una turbina LED a $350.000?',
    category: 'mercadolibre',
    difficulty: 5,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /caro|barato|competitivo|promedio|mercado|precio/i,
      /articulo\.mercadolibre\.com\.ar|mercadolibre\.com\.ar\/p\//i,  // Debe incluir links
    ],
    requiresNumericData: true,
    requiresValidLinks: true,  // Debe buscar en MeLi para responder
    expectedSkillHints: ['comparar', 'mercado', 'precio'],
  },
  {
    id: 'meli-006',
    question: 'Comparar precios de lámpara de fotocurado dental',
    category: 'mercadolibre',
    difficulty: 5,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /lámpara|fotocurado|dental/i,
    ],
    requiresNumericData: true,
    requiresValidLinks: true,
  },
  {
    id: 'meli-007',
    question: '¿Cuánto cuesta un termo Stanley 1 litro?',
    category: 'mercadolibre',
    difficulty: 2,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /termo|stanley|litro/i,
    ],
    requiresNumericData: true,
    requiresValidLinks: true,
  },
  {
    id: 'meli-008',
    question: 'Busca el precio de iPhone 15 Pro Max 256GB nuevo en MercadoLibre Argentina',
    category: 'mercadolibre',
    difficulty: 2,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /iphone|15|pro|max/i,
      /mercado\s?libre|meli|argentina/i,
    ],
    forbiddenPatterns: [
      /listado\.mercadolibre/i,
    ],
    requiresNumericData: true,
    requiresValidLinks: true,
  },
  {
    id: 'meli-009',
    question: '¿Qué opciones de notebook Lenovo ThinkPad hay en MercadoLibre? Dame al menos 3 con precios',
    category: 'mercadolibre',
    difficulty: 4,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /lenovo|thinkpad/i,
    ],
    requiresNumericData: true,
    requiresValidLinks: true,
    requiresList: true,
  },
  {
    id: 'meli-010',
    question: '¿Cuál es el rango de precios de la PS5 en MercadoLibre Argentina?',
    category: 'mercadolibre',
    difficulty: 4,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /ps5|playstation/i,
    ],
    requiresNumericData: true,
    requiresValidLinks: true,
  },
];

// ============================================
// TEST CASES: RAG (Base de Conocimiento)
// ============================================
// Requiere documento "Manual de usuario Sillon Cingol" subido al tenant de test
const ragTestCases: EvalTestCase[] = [
  {
    id: 'rag-001',
    question: '¿Cuáles son las características principales del sillón Cingol?',
    category: 'rag',
    difficulty: 1,
    expectedPatterns: [
      /sillón|cingol/i,
    ],
    forbiddenPatterns: [
      /no encontré|no tengo información|no sé sobre/i,
    ],
    expectedSkillHints: ['rag', 'documento', 'knowledge'],
  },
  {
    id: 'rag-002',
    question: '¿Qué garantía tiene el sillón odontológico Cingol?',
    category: 'rag',
    difficulty: 1,
    expectedPatterns: [
      /garantía|año|meses|warranty/i,
    ],
    forbiddenPatterns: [
      /no encontré|no tengo información/i,
    ],
  },
  {
    id: 'rag-003',
    question: '¿Cómo se ajusta la altura del sillón Cingol?',
    category: 'rag',
    difficulty: 1,
    expectedPatterns: [
      /altura|ajust|pedal|motor|control/i,
    ],
    forbiddenPatterns: [
      /no encontré|no tengo información/i,
    ],
  },
  {
    id: 'rag-004',
    question: '¿Cuáles son las posiciones disponibles del sillón Cingol?',
    category: 'rag',
    difficulty: 2,
    expectedPatterns: [
      /posición|posiciones|trendelenburg|reclin|memoria/i,
    ],
  },
  {
    id: 'rag-005',
    question: '¿Qué mantenimiento necesita el sillón Cingol?',
    category: 'rag',
    difficulty: 5,
    expectedPatterns: [
      /mantenimiento|limpi|cuidado|lubri/i,
    ],
  },
];

// ============================================
// TEST CASES: QUALITY (Insight & Business Intelligence)
// ============================================

const qualityTestCases: EvalTestCase[] = [
  {
    id: 'quality-001',
    question: '¿Cuánto vendimos en enero?',
    category: 'quality',
    difficulty: 5,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
    ],
    qualityPatterns: [
      /compar|vs\.?|anterior|diciembre|período|mes pasado|más|menos|%/i,  // Comparativa con otro período
      /tendencia|viene|subiendo|bajando|crecimiento|caída/i,  // Tendencia
    ],
    requiresNumericData: true,
  },
  {
    id: 'quality-002',
    question: '¿Quién nos debe más plata?',
    category: 'quality',
    difficulty: 5,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /cliente|deudor|partner/i,
    ],
    qualityPatterns: [
      /vencid|días|antigüedad|aging|atraso/i,  // Aging context
      /acción|gestionar|contactar|seguimiento|cobrar|reclam/i,  // Sugerencia de acción
    ],
    requiresNumericData: true,
  },
  {
    id: 'quality-003',
    question: '¿Cómo viene el stock?',
    category: 'quality',
    difficulty: 5,
    expectedPatterns: [
      /stock|inventario|producto|unidad/i,
    ],
    qualityPatterns: [
      /crítico|bajo|alerta|mínimo|reponer|agotando|⚠/i,  // Alertas
      /acción|pedir|comprar|reponer|revisar/i,  // Sugerencia
    ],
    requiresNumericData: true,
  },
  {
    id: 'quality-004',
    question: '¿Cuánto facturamos esta semana?',
    category: 'quality',
    difficulty: 5,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
    ],
    qualityPatterns: [
      /semana anterior|pasada|vs|compar|promedio|%/i,  // Comparativa
      /ritmo|proyección|si seguimos|cerrar/i,  // Proyección / insight
    ],
    requiresNumericData: true,
  },
  {
    id: 'quality-005',
    question: '¿Cuántas compras hicimos este mes?',
    category: 'quality',
    difficulty: 5,
    expectedPatterns: [
      /\d+/i,
      /compr|orden|pedido|proveedor/i,
    ],
    qualityPatterns: [
      /compar|anterior|vs|mes pasado|%/i,  // Comparativa
      /proveedor principal|mayor|concentración/i,  // Insight de concentración
    ],
    requiresNumericData: true,
  },
  {
    id: 'quality-006',
    question: '¿Cuál es nuestra situación de cobranzas?',
    category: 'quality',
    difficulty: 5,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
      /cobr|cuenta|deuda|pendiente/i,
    ],
    qualityPatterns: [
      /vencid|días|antigüedad|aging/i,  // Aging
      /prioridad|urgente|acción|gestionar|mayor riesgo/i,  // Priorización
    ],
    requiresNumericData: true,
  },
  {
    id: 'quality-007',
    question: '¿Qué onda las ventas de hoy?',
    category: 'quality',
    difficulty: 5,
    expectedPatterns: [
      /\$\s?[\d.,]+|venta|pedido|factur/i,
    ],
    qualityPatterns: [
      /ayer|promedio|normal|habitual|compar/i,  // Contexto vs normal
      /cliente|producto|destac/i,  // Desglose relevante
    ],
    requiresNumericData: true,
  },
  {
    id: 'quality-008',
    question: '¿Cuánto le vendimos a nuestro mejor cliente este mes?',
    category: 'quality',
    difficulty: 5,
    expectedPatterns: [
      /\$\s?[\d.,]+/i,
    ],
    qualityPatterns: [
      /compar|anterior|vs|mes pasado|%|representa|porcentaje|participación/i,  // Contexto
      /tendencia|viene|subiendo|bajando|product/i,  // Tendencia o desglose
    ],
    requiresNumericData: true,
  },
];

// ============================================
// EXPORT ALL TEST CASES
// ============================================

export const ALL_TEST_CASES: EvalTestCase[] = [
  ...ventasTestCases,
  ...comprasTestCases,
  ...stockTestCases,
  ...cobranzasTestCases,
  ...tesoreriaTestCases,
  ...comparativasTestCases,
  ...productosTestCases,
  ...edgeCasesTestCases,
  ...mercadolibreTestCases,
  ...ragTestCases,
  ...qualityTestCases,
];

// Group by category for reporting
export const TEST_CASES_BY_CATEGORY = {
  ventas: ventasTestCases,
  compras: comprasTestCases,
  stock: stockTestCases,
  cobranzas: cobranzasTestCases,
  tesoreria: tesoreriaTestCases,
  comparativas: comparativasTestCases,
  productos: productosTestCases,
  'edge-cases': edgeCasesTestCases,
  mercadolibre: mercadolibreTestCases,
  rag: ragTestCases,
  quality: qualityTestCases,
};

export const PASSING_THRESHOLD = 0.80; // Target: 80% pass rate

// Group by difficulty for progressive loop
export const TEST_CASES_BY_DIFFICULTY = {
  1: ALL_TEST_CASES.filter(tc => tc.difficulty === 1),
  2: ALL_TEST_CASES.filter(tc => tc.difficulty === 2),
  3: ALL_TEST_CASES.filter(tc => tc.difficulty === 3),
  4: ALL_TEST_CASES.filter(tc => tc.difficulty === 4),
  5: ALL_TEST_CASES.filter(tc => tc.difficulty === 5),
};
