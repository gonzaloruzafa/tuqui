/**
 * 100 Preguntas de Negocio Realistas + Conversaciones Encadenadas
 * 
 * Rol: Gerente/Dueño de empresa que necesita insights del negocio
 * Objetivo: Evaluar qué tan bien Tuqui puede responder preguntas de BI reales
 */

export interface BusinessQuestion {
    id: number
    question: string
    category: 'ventas' | 'stock' | 'facturacion' | 'clientes' | 'vendedores' | 'productos' | 'alertas' | 'comparativas' | 'tendencias' | 'operaciones'
    complexity: 'simple' | 'media' | 'alta'
    expectedInsight: string
}

export interface ConversationChain {
    id: string
    name: string
    category: string
    messages: { role: 'user' | 'assistant', content: string }[]
    // El último mensaje es la pregunta a evaluar, los anteriores son contexto simulado
}

// =====================================================
// 100 PREGUNTAS INDIVIDUALES
// =====================================================
export const BUSINESS_QUESTIONS: BusinessQuestion[] = [
    // VENTAS (1-10)
    { id: 1, question: "¿Cómo vienen las ventas de esta semana comparado con la semana pasada?", category: 'ventas', complexity: 'media', expectedInsight: "Comparación WoW con variación porcentual" },
    { id: 2, question: "¿Estamos vendiendo más o menos que el mes pasado?", category: 'ventas', complexity: 'media', expectedInsight: "Comparación MoM con tendencia" },
    { id: 3, question: "¿Cuál fue nuestro mejor día de ventas en diciembre?", category: 'ventas', complexity: 'media', expectedInsight: "Día específico con monto" },
    { id: 4, question: "¿Cuántas ventas quedaron sin confirmar este mes?", category: 'ventas', complexity: 'simple', expectedInsight: "Cantidad de órdenes en draft" },
    { id: 5, question: "¿Cuál es el ticket promedio de venta?", category: 'ventas', complexity: 'simple', expectedInsight: "Promedio de amount_total" },
    { id: 6, question: "¿Cuánto vendimos por trimestre este año?", category: 'ventas', complexity: 'media', expectedInsight: "Desglose Q1-Q4" },
    { id: 7, question: "¿Las ventas de este año superan las del año pasado?", category: 'ventas', complexity: 'media', expectedInsight: "Comparación YoY" },
    { id: 8, question: "¿Cuáles son las 5 ventas más grandes del mes?", category: 'ventas', complexity: 'simple', expectedInsight: "Top 5 órdenes por monto" },
    { id: 9, question: "¿Cuántas órdenes de venta se cancelaron este mes?", category: 'ventas', complexity: 'simple', expectedInsight: "Count de órdenes canceladas" },
    { id: 10, question: "¿Qué día de la semana vendemos más?", category: 'ventas', complexity: 'alta', expectedInsight: "Patrón por día de semana" },
    
    // STOCK (11-20)
    { id: 11, question: "¿Qué productos tienen stock crítico o cero?", category: 'stock', complexity: 'simple', expectedInsight: "Productos con qty_available <= 0" },
    { id: 12, question: "¿Hay productos que deberíamos reponer urgente?", category: 'stock', complexity: 'media', expectedInsight: "Productos bajo punto de reorden" },
    { id: 13, question: "¿Cuánto vale el inventario total?", category: 'stock', complexity: 'simple', expectedInsight: "Suma de qty * standard_price" },
    { id: 14, question: "¿Hubo muchos ajustes de inventario este mes?", category: 'stock', complexity: 'media', expectedInsight: "Cantidad de ajustes" },
    { id: 15, question: "¿Hay productos con stock negativo?", category: 'stock', complexity: 'simple', expectedInsight: "Productos con qty < 0" },
    { id: 16, question: "¿Qué productos no se vendieron en los últimos 3 meses?", category: 'stock', complexity: 'alta', expectedInsight: "Productos sin ventas en 90 días" },
    { id: 17, question: "¿Cuántas transferencias de stock hicimos esta semana?", category: 'stock', complexity: 'simple', expectedInsight: "Count de stock.picking" },
    { id: 18, question: "¿Cuáles son los productos con más stock?", category: 'stock', complexity: 'simple', expectedInsight: "Top productos por qty_available" },
    { id: 19, question: "¿Qué ubicación tiene más productos?", category: 'stock', complexity: 'media', expectedInsight: "Stock por location" },
    { id: 20, question: "¿Hay recepciones de mercadería pendientes?", category: 'stock', complexity: 'simple', expectedInsight: "Pickings incoming sin procesar" },
    
    // FACTURACION (21-30)
    { id: 21, question: "¿Cuánto facturamos esta semana?", category: 'facturacion', complexity: 'simple', expectedInsight: "Total facturas de la semana" },
    { id: 22, question: "¿Estamos facturando menos que la semana pasada?", category: 'facturacion', complexity: 'media', expectedInsight: "Comparación WoW" },
    { id: 23, question: "¿Cuánta deuda tenemos sin cobrar?", category: 'facturacion', complexity: 'simple', expectedInsight: "Suma de amount_residual" },
    { id: 24, question: "¿Quiénes son los clientes que más nos deben?", category: 'facturacion', complexity: 'simple', expectedInsight: "Top deudores" },
    { id: 25, question: "¿Cuántas facturas vencidas tenemos?", category: 'facturacion', complexity: 'simple', expectedInsight: "Facturas pasadas de fecha" },
    { id: 26, question: "¿Hay facturas de más de 90 días sin pagar?", category: 'facturacion', complexity: 'media', expectedInsight: "Deuda muy antigua" },
    { id: 27, question: "¿Cuánto cobramos esta semana?", category: 'facturacion', complexity: 'simple', expectedInsight: "Total de pagos recibidos" },
    { id: 28, question: "¿Cuántas notas de crédito emitimos este mes?", category: 'facturacion', complexity: 'simple', expectedInsight: "Count de out_refund" },
    { id: 29, question: "¿A cuánto ascienden las notas de crédito del mes?", category: 'facturacion', complexity: 'simple', expectedInsight: "Suma de notas de crédito" },
    { id: 30, question: "¿Cuál es la factura más grande del mes?", category: 'facturacion', complexity: 'simple', expectedInsight: "Factura con mayor monto" },
    
    // CLIENTES (31-40)
    { id: 31, question: "¿Cuántos clientes nuevos tuvimos este mes?", category: 'clientes', complexity: 'media', expectedInsight: "Clientes con primera compra" },
    { id: 32, question: "¿Qué clientes dejaron de comprar?", category: 'clientes', complexity: 'alta', expectedInsight: "Clientes inactivos" },
    { id: 33, question: "¿Cuál es nuestro cliente más importante por facturación?", category: 'clientes', complexity: 'simple', expectedInsight: "Top 1 cliente" },
    { id: 34, question: "¿Hay clientes con crédito excedido?", category: 'clientes', complexity: 'media', expectedInsight: "Clientes sobre credit_limit" },
    { id: 35, question: "¿Cuántos clientes activos tenemos?", category: 'clientes', complexity: 'simple', expectedInsight: "Partners con compras" },
    { id: 36, question: "¿Qué clientes no compraron en los últimos 6 meses?", category: 'clientes', complexity: 'media', expectedInsight: "Clientes dormidos" },
    { id: 37, question: "¿Cuál es el ticket promedio por cliente?", category: 'clientes', complexity: 'media', expectedInsight: "Ventas / clientes" },
    { id: 38, question: "¿De qué provincia son nuestros mejores clientes?", category: 'clientes', complexity: 'media', expectedInsight: "Ventas por state_id" },
    { id: 39, question: "¿Cuántos clientes compraron más de una vez este año?", category: 'clientes', complexity: 'media', expectedInsight: "Clientes recurrentes" },
    { id: 40, question: "¿Qué cliente tiene más órdenes este año?", category: 'clientes', complexity: 'simple', expectedInsight: "Cliente con más transacciones" },
    
    // VENDEDORES (41-50)
    { id: 41, question: "¿Quién es el vendedor del mes?", category: 'vendedores', complexity: 'simple', expectedInsight: "Top vendedor por monto" },
    { id: 42, question: "¿Hay vendedores que no vendieron nada esta semana?", category: 'vendedores', complexity: 'media', expectedInsight: "Vendedores sin órdenes" },
    { id: 43, question: "¿Cuánto vendió cada vendedor este mes?", category: 'vendedores', complexity: 'simple', expectedInsight: "Desglose por vendedor" },
    { id: 44, question: "¿Qué vendedor tiene el ticket promedio más alto?", category: 'vendedores', complexity: 'media', expectedInsight: "Promedio por vendedor" },
    { id: 45, question: "¿Quién tiene más cotizaciones pendientes?", category: 'vendedores', complexity: 'simple', expectedInsight: "Drafts por vendedor" },
    { id: 46, question: "¿Qué vendedor tiene más clientes?", category: 'vendedores', complexity: 'media', expectedInsight: "Partners únicos por vendedor" },
    { id: 47, question: "¿Cómo le fue a cada vendedor comparado con el mes pasado?", category: 'vendedores', complexity: 'alta', expectedInsight: "MoM por vendedor" },
    { id: 48, question: "¿Qué vendedor cerró más ventas esta semana?", category: 'vendedores', complexity: 'simple', expectedInsight: "Count de confirmados" },
    { id: 49, question: "¿Cuántas ventas tiene cada vendedor en el año?", category: 'vendedores', complexity: 'simple', expectedInsight: "Count por vendedor" },
    { id: 50, question: "¿Hay vendedores con muchas cotizaciones sin convertir?", category: 'vendedores', complexity: 'media', expectedInsight: "Drafts viejos por vendedor" },
    
    // PRODUCTOS (51-60)
    { id: 51, question: "¿Cuál es el producto estrella este mes?", category: 'productos', complexity: 'simple', expectedInsight: "Producto más vendido" },
    { id: 52, question: "¿Qué productos no se vendieron en todo el año?", category: 'productos', complexity: 'media', expectedInsight: "Productos sin ventas" },
    { id: 53, question: "¿Qué categoría de productos vendemos más?", category: 'productos', complexity: 'simple', expectedInsight: "Ventas por categoría" },
    { id: 54, question: "¿Cuántos productos activos tenemos?", category: 'productos', complexity: 'simple', expectedInsight: "Count de productos" },
    { id: 55, question: "¿Cuál es el precio promedio de nuestros productos?", category: 'productos', complexity: 'simple', expectedInsight: "Promedio de list_price" },
    { id: 56, question: "¿Qué productos tienen el precio más alto?", category: 'productos', complexity: 'simple', expectedInsight: "Top por list_price" },
    { id: 57, question: "¿Cuántos productos vendimos en unidades este mes?", category: 'productos', complexity: 'simple', expectedInsight: "Suma de product_uom_qty" },
    { id: 58, question: "¿Qué producto se vende más en cantidad?", category: 'productos', complexity: 'simple', expectedInsight: "Top por qty" },
    { id: 59, question: "¿Hay productos descontinuados con stock?", category: 'productos', complexity: 'media', expectedInsight: "Productos inactivos con qty > 0" },
    { id: 60, question: "¿Cuántas categorías de productos tenemos?", category: 'productos', complexity: 'simple', expectedInsight: "Count de categorías" },
    
    // ALERTAS (61-70)
    { id: 61, question: "¿Hay algo preocupante que deba saber hoy?", category: 'alertas', complexity: 'alta', expectedInsight: "Resumen de alertas" },
    { id: 62, question: "¿Tenemos pedidos atrasados sin entregar?", category: 'alertas', complexity: 'media', expectedInsight: "Órdenes con fecha pasada" },
    { id: 63, question: "¿Hay clientes con problemas de pago recurrentes?", category: 'alertas', complexity: 'media', expectedInsight: "Clientes morosos" },
    { id: 64, question: "¿Las devoluciones aumentaron este mes?", category: 'alertas', complexity: 'media', expectedInsight: "Comparación NC MoM" },
    { id: 65, question: "¿Algún vendedor necesita atención?", category: 'alertas', complexity: 'alta', expectedInsight: "Vendedores con baja performance" },
    { id: 66, question: "¿Las cancelaciones de pedidos están aumentando?", category: 'alertas', complexity: 'media', expectedInsight: "Trend de cancelaciones" },
    { id: 67, question: "¿Hay facturas que llevan más de un año sin cobrar?", category: 'alertas', complexity: 'simple', expectedInsight: "Deuda muy antigua" },
    { id: 68, question: "¿Qué clientes están por exceder su crédito?", category: 'alertas', complexity: 'media', expectedInsight: "Cerca del credit_limit" },
    { id: 69, question: "¿Hay productos que se venden muy por debajo del precio lista?", category: 'alertas', complexity: 'alta', expectedInsight: "Descuentos excesivos" },
    { id: 70, question: "¿Tenemos órdenes de compra muy atrasadas?", category: 'alertas', complexity: 'media', expectedInsight: "PO sin recibir" },
    
    // COMPARATIVAS (71-80)
    { id: 71, question: "¿Este diciembre es mejor que el del año pasado?", category: 'comparativas', complexity: 'media', expectedInsight: "Diciembre YoY" },
    { id: 72, question: "¿El Q4 superó al Q3?", category: 'comparativas', complexity: 'media', expectedInsight: "Comparación trimestral" },
    { id: 73, question: "¿Cómo estamos vs el mismo período del año pasado?", category: 'comparativas', complexity: 'media', expectedInsight: "YTD vs PYTD" },
    { id: 74, question: "¿Vendemos más unidades o solo más monto?", category: 'comparativas', complexity: 'media', expectedInsight: "Qty vs amount" },
    { id: 75, question: "¿La facturación sigue el ritmo de las ventas?", category: 'comparativas', complexity: 'media', expectedInsight: "Ventas vs facturado" },
    { id: 76, question: "¿Cobramos más o menos que el mes pasado?", category: 'comparativas', complexity: 'media', expectedInsight: "Pagos MoM" },
    { id: 77, question: "¿Cómo está la deuda comparada con hace 3 meses?", category: 'comparativas', complexity: 'alta', expectedInsight: "AR trend" },
    { id: 78, question: "¿El promedio de venta subió o bajó este mes?", category: 'comparativas', complexity: 'media', expectedInsight: "Ticket MoM" },
    { id: 79, question: "¿Tenemos más o menos clientes activos que antes?", category: 'comparativas', complexity: 'alta', expectedInsight: "Clientes activos trend" },
    { id: 80, question: "¿Las notas de crédito están aumentando?", category: 'comparativas', complexity: 'media', expectedInsight: "NC trend" },
    
    // TENDENCIAS (81-90)
    { id: 81, question: "¿Las ventas tienen tendencia al alza o a la baja?", category: 'tendencias', complexity: 'media', expectedInsight: "Tendencia general" },
    { id: 82, question: "¿Qué mes fue el mejor del año en ventas?", category: 'tendencias', complexity: 'simple', expectedInsight: "Mes pico" },
    { id: 83, question: "¿La deuda está creciendo o disminuyendo?", category: 'tendencias', complexity: 'media', expectedInsight: "AR trend" },
    { id: 84, question: "¿El ticket promedio está subiendo o bajando?", category: 'tendencias', complexity: 'media', expectedInsight: "Ticket trend" },
    { id: 85, question: "¿Qué trimestre tuvo más ventas?", category: 'tendencias', complexity: 'simple', expectedInsight: "Top Q" },
    { id: 86, question: "¿En qué mes cobramos más?", category: 'tendencias', complexity: 'simple', expectedInsight: "Mes top cobranzas" },
    { id: 87, question: "¿La cantidad de pedidos va en aumento?", category: 'tendencias', complexity: 'media', expectedInsight: "Count trend" },
    { id: 88, question: "¿Qué producto creció más en ventas este año?", category: 'tendencias', complexity: 'alta', expectedInsight: "Producto con mayor crecimiento" },
    { id: 89, question: "¿Qué vendedor mejoró más su performance?", category: 'tendencias', complexity: 'alta', expectedInsight: "Vendedor con mayor mejora" },
    { id: 90, question: "¿La cantidad de clientes nuevos está creciendo?", category: 'tendencias', complexity: 'alta', expectedInsight: "Nuevos clientes trend" },
    
    // OPERACIONES (91-100)
    { id: 91, question: "¿Cuántos pedidos procesamos por día en promedio?", category: 'operaciones', complexity: 'simple', expectedInsight: "Promedio diario" },
    { id: 92, question: "¿Hay pickings pendientes de hace más de una semana?", category: 'operaciones', complexity: 'media', expectedInsight: "Transferencias atrasadas" },
    { id: 93, question: "¿Cuántas órdenes de compra tenemos abiertas?", category: 'operaciones', complexity: 'simple', expectedInsight: "PO sin completar" },
    { id: 94, question: "¿Qué proveedor tiene más entregas pendientes?", category: 'operaciones', complexity: 'media', expectedInsight: "Proveedor con más PO abiertas" },
    { id: 95, question: "¿Cuántos usuarios activos hay en el sistema?", category: 'operaciones', complexity: 'simple', expectedInsight: "Usuarios con login reciente" },
    { id: 96, question: "¿Cuántas oportunidades de CRM tenemos abiertas?", category: 'operaciones', complexity: 'simple', expectedInsight: "Leads/opportunities abiertos" },
    { id: 97, question: "¿En qué etapa del CRM hay más oportunidades?", category: 'operaciones', complexity: 'simple', expectedInsight: "Por stage_id" },
    { id: 98, question: "¿Cuánto vale el pipeline de ventas?", category: 'operaciones', complexity: 'simple', expectedInsight: "Total expected_revenue" },
    { id: 99, question: "¿Hay actividades vencidas sin completar?", category: 'operaciones', complexity: 'media', expectedInsight: "Activities overdue" },
    { id: 100, question: "Dame un resumen ejecutivo del estado del negocio", category: 'operaciones', complexity: 'alta', expectedInsight: "Dashboard KPIs" }
]

// =====================================================
// 20 CONVERSACIONES ENCADENADAS
// =====================================================
export const CONVERSATION_CHAINS: ConversationChain[] = [
    // 1. Análisis de ventas con drill-down
    {
        id: 'chain-1',
        name: 'Ventas → Vendedor → Productos',
        category: 'ventas',
        messages: [
            { role: 'user', content: 'dame las ventas de diciembre' },
            { role: 'assistant', content: 'Las ventas de diciembre 2025 fueron $14.823.079,92.' },
            { role: 'user', content: 'desglosame por vendedor' }
        ]
    },
    {
        id: 'chain-2',
        name: 'Ventas → Top vendedor → Sus productos',
        category: 'ventas',
        messages: [
            { role: 'user', content: '¿quién vendió más este mes?' },
            { role: 'assistant', content: 'Martín Travella vendió más con $5.520.064.820.' },
            { role: 'user', content: '¿qué productos vende él?' }
        ]
    },
    {
        id: 'chain-3',
        name: 'Ventas → Comparación → Por trimestre',
        category: 'ventas',
        messages: [
            { role: 'user', content: '¿cuánto vendimos este año?' },
            { role: 'assistant', content: 'Las ventas totales de 2025 fueron $89.174.397,97.' },
            { role: 'user', content: 'desglosame por trimestre' }
        ]
    },
    
    // 2. Análisis de clientes
    {
        id: 'chain-4',
        name: 'Top clientes → Segundo → Su deuda',
        category: 'clientes',
        messages: [
            { role: 'user', content: 'top 5 clientes por ventas' },
            { role: 'assistant', content: '1. Ministerio de Salud: $1.878M\n2. Universidad de Buenos Aires: $368M\n3. Polyquímica: $367M...' },
            { role: 'user', content: 'el segundo cuánto nos debe?' }
        ]
    },
    {
        id: 'chain-5',
        name: 'Deudores → Top 1 → Sus facturas',
        category: 'clientes',
        messages: [
            { role: 'user', content: '¿quiénes nos deben más?' },
            { role: 'assistant', content: 'Hospital Provincial Rosario: $49.233.889\nHospital Escuela Eva Perón: $15.573.553...' },
            { role: 'user', content: 'mostrame las facturas del primero' }
        ]
    },
    {
        id: 'chain-6',
        name: 'Clientes inactivos → Cantidad → Detalle',
        category: 'clientes',
        messages: [
            { role: 'user', content: '¿hay clientes que dejaron de comprar?' },
            { role: 'assistant', content: 'Hay 45 clientes que no compraron en los últimos 6 meses.' },
            { role: 'user', content: 'pasame el listado' }
        ]
    },
    
    // 3. Análisis de productos
    {
        id: 'chain-7',
        name: 'Producto estrella → Stock → Proyección',
        category: 'productos',
        messages: [
            { role: 'user', content: '¿cuál es el producto más vendido?' },
            { role: 'assistant', content: 'El Radiovisiografo RVG XVD2530 con 307.734 unidades vendidas.' },
            { role: 'user', content: '¿cuánto stock tenemos de ese?' }
        ]
    },
    {
        id: 'chain-8',
        name: 'Productos sin stock → Categoría → Reponer',
        category: 'productos',
        messages: [
            { role: 'user', content: '¿qué productos tienen stock cero?' },
            { role: 'assistant', content: 'Hay 23 productos sin stock: [C005691] Radiovisiografo..., [C009896] Compresor...' },
            { role: 'user', content: '¿de qué categoría son la mayoría?' }
        ]
    },
    
    // 4. Análisis de vendedores
    {
        id: 'chain-9',
        name: 'Ranking vendedores → Sin asignar → Filtrar',
        category: 'vendedores',
        messages: [
            { role: 'user', content: 'dame el ranking de ventas por vendedor' },
            { role: 'assistant', content: '1. Sin asignar: $24.274.714M\n2. Martín Travella: $5.520M\n3. Maico Moyano: $4.554M...' },
            { role: 'user', content: 'pero sin contar el "sin asignar"' }
        ]
    },
    {
        id: 'chain-10',
        name: 'Vendedor específico → MoM → Productos',
        category: 'vendedores',
        messages: [
            { role: 'user', content: '¿cómo le fue a Martín este mes?' },
            { role: 'assistant', content: 'Martín Travella vendió $249.026.888 en diciembre.' },
            { role: 'user', content: '¿y el mes pasado?' }
        ]
    },
    {
        id: 'chain-11',
        name: 'Vendedores inactivos → Semana → Lista',
        category: 'vendedores',
        messages: [
            { role: 'user', content: '¿hay vendedores que no vendieron?' },
            { role: 'assistant', content: 'Hay 3 vendedores sin ventas esta semana.' },
            { role: 'user', content: '¿quiénes son?' }
        ]
    },
    
    // 5. Análisis de facturación/cobranzas
    {
        id: 'chain-12',
        name: 'Deuda total → Vencida → Antigua',
        category: 'facturacion',
        messages: [
            { role: 'user', content: '¿cuánta deuda tenemos?' },
            { role: 'assistant', content: 'La deuda total es $850.234.567.' },
            { role: 'user', content: '¿cuánto de eso está vencido?' }
        ]
    },
    {
        id: 'chain-13',
        name: 'Facturación → WoW → Detalle',
        category: 'facturacion',
        messages: [
            { role: 'user', content: '¿cuánto facturamos esta semana?' },
            { role: 'assistant', content: 'Esta semana facturamos $12.345.678.' },
            { role: 'user', content: '¿es más o menos que la semana pasada?' }
        ]
    },
    
    // 6. Alertas y problemas
    {
        id: 'chain-14',
        name: 'Alertas → Específica → Acción',
        category: 'alertas',
        messages: [
            { role: 'user', content: '¿hay algo urgente que deba saber?' },
            { role: 'assistant', content: 'Sí: 15 productos sin stock, 8 facturas vencidas hace +90 días, 3 pedidos atrasados.' },
            { role: 'user', content: 'contame más de los pedidos atrasados' }
        ]
    },
    {
        id: 'chain-15',
        name: 'Stock crítico → Productos → Proveedor',
        category: 'alertas',
        messages: [
            { role: 'user', content: '¿tenemos productos en nivel crítico?' },
            { role: 'assistant', content: 'Hay 8 productos en nivel crítico de stock.' },
            { role: 'user', content: '¿a qué proveedor le compramos esos?' }
        ]
    },
    
    // 7. Comparativas y tendencias
    {
        id: 'chain-16',
        name: 'YoY → Desglose → Mejor mes',
        category: 'comparativas',
        messages: [
            { role: 'user', content: '¿cómo estamos vs el año pasado?' },
            { role: 'assistant', content: 'Las ventas crecieron 15% vs 2024.' },
            { role: 'user', content: '¿en qué mes crecimos más?' }
        ]
    },
    {
        id: 'chain-17',
        name: 'Tendencia ventas → Causa → Acción',
        category: 'tendencias',
        messages: [
            { role: 'user', content: '¿las ventas van en subida o bajada?' },
            { role: 'assistant', content: 'Las ventas muestran tendencia a la baja, -8% en el último trimestre.' },
            { role: 'user', content: '¿qué producto cayó más?' }
        ]
    },
    
    // 8. CRM y pipeline
    {
        id: 'chain-18',
        name: 'Pipeline → Etapas → Top oportunidad',
        category: 'operaciones',
        messages: [
            { role: 'user', content: '¿cuánto vale el pipeline de ventas?' },
            { role: 'assistant', content: 'El pipeline total es $30.362.501,75.' },
            { role: 'user', content: '¿en qué etapa hay más valor?' }
        ]
    },
    {
        id: 'chain-19',
        name: 'Oportunidades → Vendedor → Detalle',
        category: 'operaciones',
        messages: [
            { role: 'user', content: '¿cuántas oportunidades abiertas tenemos?' },
            { role: 'assistant', content: 'Hay 757 oportunidades abiertas.' },
            { role: 'user', content: '¿qué vendedor tiene más?' }
        ]
    },
    
    // 9. Operaciones múltiples
    {
        id: 'chain-20',
        name: 'Resumen → Drill-down → Acción',
        category: 'operaciones',
        messages: [
            { role: 'user', content: 'dame un resumen del negocio' },
            { role: 'assistant', content: 'Ventas mes: $89M, Deuda: $850M, Stock crítico: 15 productos, Pipeline: $30M.' },
            { role: 'user', content: 'profundizame en la deuda' }
        ]
    }
]

// Helpers
export function getQuestionsByCategory(category: string): BusinessQuestion[] {
    return BUSINESS_QUESTIONS.filter(q => q.category === category)
}

export function getQuestionsByComplexity(complexity: string): BusinessQuestion[] {
    return BUSINESS_QUESTIONS.filter(q => q.complexity === complexity)
}

export function getStats() {
    const stats = {
        totalQuestions: BUSINESS_QUESTIONS.length,
        totalChains: CONVERSATION_CHAINS.length,
        byCategory: {} as Record<string, number>,
        byComplexity: {} as Record<string, number>
    }
    
    for (const q of BUSINESS_QUESTIONS) {
        stats.byCategory[q.category] = (stats.byCategory[q.category] || 0) + 1
        stats.byComplexity[q.complexity] = (stats.byComplexity[q.complexity] || 0) + 1
    }
    
    return stats
}
