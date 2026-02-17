/**
 * Company Discovery — Auto-discover company profile from Odoo
 * 
 * Runs ~70 Odoo queries (using _descripcion) in batches and synthesizes
 * a rich company profile with LLM. Based on scripts/company-discovery.ts
 * which validated 57/61 queries on Cedent in 73s.
 * 
 * Goal: understand the ENTIRE business — sales, margins, customers,
 * products, suppliers, stock, treasury, CRM, subscriptions, HR, users, communication.
 */

import { loadSkillsForAgent } from '@/lib/skills/loader'

export interface DiscoveryResult {
  industry: string
  description: string
  toneOfVoice: string
  topCustomers: { name: string; notes: string }[]
  topProducts: { name: string; notes: string }[]
  topSuppliers: { name: string; notes: string }[]
}

export interface DiscoveryProgress {
  completed: number
  total: number
  currentLabel: string
  phase: 'querying' | 'synthesizing' | 'done'
}

type SkillRun = { skillName: string; input: Record<string, unknown>; label: string }

/** Build period helpers based on current date */
function buildPeriods() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0]
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0]

  return {
    today,
    threeMonthsAgo,
    sixMonthsAgo,
    thisMonth: { start: monthStart, end: today },
    lastMonth: { start: prevMonthStart, end: prevMonthEnd },
    lastThreeMonths: { start: threeMonthsAgo, end: today },
    lastSixMonths: { start: sixMonthsAgo, end: today },
    lastTwelveMonths: { start: twelveMonthsAgo, end: today },
  }
}

/** ALL discovery queries — mirrors scripts/company-discovery.ts for maximum coverage */
function buildDiscoveryRuns(): SkillRun[] {
  const p = buildPeriods()

  return [
    // === ESTRUCTURA ===
    { skillName: 'get_companies', input: { limit: 10 }, label: 'Empresas del grupo' },
    { skillName: 'get_sales_teams', input: { includeStats: true }, label: 'Equipos de venta' },

    // === VENTAS — panorama completo, múltiples ángulos ===
    { skillName: 'get_sales_total', input: { period: p.lastTwelveMonths }, label: 'Ventas totales 12m' },
    { skillName: 'get_sales_total', input: { period: p.thisMonth }, label: 'Ventas este mes' },
    { skillName: 'get_sales_total', input: { period: p.lastMonth }, label: 'Ventas mes pasado' },
    { skillName: 'get_sales_by_customer', input: { period: p.lastTwelveMonths, limit: 50 }, label: 'Ventas por cliente 12m' },
    { skillName: 'get_sales_by_product', input: { period: p.lastTwelveMonths, limit: 50 }, label: 'Ventas por producto 12m' },
    { skillName: 'get_sales_by_seller', input: { period: p.lastTwelveMonths, limit: 50 }, label: 'Ventas por vendedor 12m' },
    { skillName: 'get_sales_by_seller', input: { period: p.thisMonth, limit: 20 }, label: 'Ventas por vendedor este mes' },
    { skillName: 'get_top_products', input: { period: p.lastTwelveMonths, limit: 50 }, label: 'Top productos 12m (revenue)' },
    { skillName: 'get_top_products', input: { period: p.lastTwelveMonths, limit: 30, orderBy: 'quantity' }, label: 'Top productos 12m (unidades)' },
    { skillName: 'get_top_customers', input: { period: p.lastTwelveMonths, limit: 50 }, label: 'Top clientes 12m' },
    { skillName: 'get_sales_by_category', input: { period: p.lastTwelveMonths, limit: 50 }, label: 'Ventas por categoría 12m' },
    { skillName: 'get_pending_sale_orders', input: { limit: 50 }, label: 'Pedidos pendientes' },
    { skillName: 'get_pending_sale_orders', input: { limit: 30, pendingType: 'invoice' }, label: 'Pedidos pendientes facturar' },

    // === COMPARATIVAS ===
    { skillName: 'compare_sales_periods', input: {
      currentPeriod: { ...p.thisMonth, label: 'Este mes' },
      previousPeriod: { ...p.lastMonth, label: 'Mes pasado' },
      includeProducts: true, includeCustomers: true, limit: 10,
    }, label: 'Comparativa este mes vs pasado' },
    { skillName: 'compare_sales_periods', input: {
      currentPeriod: { ...p.lastThreeMonths, label: 'Últimos 3 meses' },
      previousPeriod: { start: p.sixMonthsAgo, end: p.threeMonthsAgo, label: '3 meses anteriores' },
      includeProducts: true, includeCustomers: true, limit: 10,
    }, label: 'Comparativa trimestral' },

    // === MÁRGENES — doble ángulo ===
    { skillName: 'get_sales_margin_summary', input: { period: p.lastTwelveMonths }, label: 'Resumen margen 12m' },
    { skillName: 'get_sales_margin_summary', input: { period: p.thisMonth }, label: 'Resumen margen este mes' },
    { skillName: 'get_product_margin', input: { period: p.lastTwelveMonths, limit: 30, sortBy: 'margin_total' }, label: 'Margen por producto (total) 12m' },
    { skillName: 'get_product_margin', input: { period: p.lastTwelveMonths, limit: 30, sortBy: 'margin_percent' }, label: 'Margen por producto (%) 12m' },
    { skillName: 'get_product_margin', input: { period: p.lastTwelveMonths, limit: 20, sortBy: 'margin_percent', maxMarginPercent: 30 }, label: 'Productos bajo margen 12m' },

    // === FACTURACIÓN / DEUDA ===
    { skillName: 'get_debt_by_customer', input: { limit: 50, includeOverdueDays: true }, label: 'Deuda por cliente' },
    { skillName: 'get_invoices_by_customer', input: { period: p.lastTwelveMonths, limit: 50 }, label: 'Facturas por cliente 12m' },
    { skillName: 'get_overdue_invoices', input: { limit: 50, groupByCustomer: true }, label: 'Facturas vencidas' },
    { skillName: 'get_invoice_lines', input: { period: p.lastThreeMonths, limit: 100, groupBy: 'product' }, label: 'Líneas factura por producto 3m' },
    { skillName: 'get_invoice_lines', input: { period: p.lastThreeMonths, limit: 100, groupBy: 'seller' }, label: 'Líneas factura por vendedor 3m' },
    { skillName: 'get_invoice_lines', input: { period: p.lastThreeMonths, limit: 100, groupBy: 'customer' }, label: 'Líneas factura por cliente 3m' },

    // === STOCK — inventario completo ===
    { skillName: 'get_product_stock', input: { limit: 50 }, label: 'Stock productos' },
    { skillName: 'get_stock_valuation', input: {}, label: 'Valuación de inventario' },
    { skillName: 'get_top_stock_products', input: { limit: 30 }, label: 'Top stock por valor' },
    { skillName: 'get_low_stock_products', input: { threshold: 10, limit: 50 }, label: 'Productos bajo stock' },
    { skillName: 'get_expiring_stock', input: { days_ahead: 90, include_expired: true, limit: 30 }, label: 'Stock vencido/por vencer' },
    { skillName: 'get_stock_rotation', input: { period: p.lastSixMonths, limit: 30 }, label: 'Rotación stock 6m' },
    { skillName: 'get_stock_rotation', input: { period: p.lastSixMonths, limit: 30, zeroSalesOnly: true }, label: 'Productos sin rotación 6m' },

    // === COMPRAS / PROVEEDORES ===
    { skillName: 'get_purchases_by_supplier', input: { period: p.lastTwelveMonths, limit: 50 }, label: 'Top proveedores 12m' },
    { skillName: 'get_purchase_orders', input: { period: p.lastTwelveMonths, limit: 50 }, label: 'Órdenes de compra 12m' },
    { skillName: 'get_purchase_orders', input: { period: p.lastTwelveMonths, limit: 30, groupBy: 'vendor' }, label: 'Compras por proveedor 12m' },
    { skillName: 'get_vendor_bills', input: { period: p.lastTwelveMonths, limit: 50 }, label: 'Facturas proveedor 12m' },

    // === TESORERÍA / CONTABILIDAD ===
    { skillName: 'get_cash_balance', input: { includeBanks: true }, label: 'Saldos caja y bancos' },
    { skillName: 'get_accounts_receivable', input: { groupByCustomer: true, limit: 50 }, label: 'Cuentas por cobrar' },
    { skillName: 'get_accounts_receivable', input: { overdueOnly: true, groupByCustomer: true, limit: 50 }, label: 'CxC vencidas' },
    { skillName: 'get_accounts_payable', input: { groupBySupplier: true, limit: 50 }, label: 'Cuentas por pagar' },
    { skillName: 'get_accounts_payable', input: { overdueOnly: true, groupBySupplier: true, limit: 50 }, label: 'CxP vencidas' },
    { skillName: 'get_ar_aging', input: { groupByCustomer: true, limit: 30 }, label: 'Aging deuda clientes' },
    { skillName: 'get_account_balance', input: { limit: 100 }, label: 'Plan de cuentas con saldos' },
    { skillName: 'get_journal_entries', input: { period: p.thisMonth, limit: 50 }, label: 'Asientos del mes' },

    // === PAGOS ===
    { skillName: 'get_payments_received', input: { period: p.lastTwelveMonths, groupByJournal: true }, label: 'Cobros por diario 12m' },
    { skillName: 'get_payments_received', input: { period: p.lastThreeMonths, groupByCustomer: true, limit: 30 }, label: 'Cobros por cliente 3m' },
    { skillName: 'get_payments_made', input: { period: p.lastTwelveMonths, groupByJournal: true }, label: 'Pagos por diario 12m' },
    { skillName: 'get_payments_made', input: { period: p.lastThreeMonths, groupBySupplier: true, limit: 30 }, label: 'Pagos a proveedores 3m' },

    // === CLIENTES (inteligencia) ===
    { skillName: 'get_new_customers', input: { period: p.lastSixMonths, limit: 50, includeDetails: true }, label: 'Clientes nuevos 6m' },
    { skillName: 'get_inactive_customers', input: { limit: 50, includeDetails: true }, label: 'Clientes inactivos' },

    // === CRM ===
    { skillName: 'get_crm_pipeline', input: { groupByStage: true, limit: 100 }, label: 'Pipeline CRM' },
    { skillName: 'get_crm_pipeline', input: { status: 'won', period: p.lastSixMonths, groupByStage: true, limit: 50 }, label: 'Oportunidades ganadas 6m' },
    { skillName: 'get_stale_opportunities', input: { staleDays: 30, limit: 30 }, label: 'Oportunidades estancadas' },
    { skillName: 'get_lost_opportunities', input: { period: p.lastTwelveMonths, limit: 30 }, label: 'Oportunidades perdidas 12m' },
    { skillName: 'search_crm_opportunities', input: { status: 'open', limit: 50 }, label: 'Oportunidades abiertas' },
    { skillName: 'get_crm_tags', input: { includeStats: true }, label: 'Tags CRM' },

    // === SUSCRIPCIONES ===
    { skillName: 'get_subscription_health', input: { expiringWithinDays: 90, limit: 30 }, label: 'Salud suscripciones' },
    { skillName: 'get_subscription_churn', input: { compareWithPrevious: true }, label: 'Churn suscripciones' },

    // === RRHH / EMPLEADOS ===
    { skillName: 'get_employees', input: { limit: 100 }, label: 'Empleados' },
    { skillName: 'get_departments', input: { limit: 50 }, label: 'Departamentos' },
    { skillName: 'get_leave_summary', input: { approvedOnly: true }, label: 'Resumen ausencias' },

    // === USUARIOS ===
    { skillName: 'get_users', input: { internalOnly: true, limit: 100 }, label: 'Usuarios internos Odoo' },

    // === COMUNICACIÓN / CHATTER (MÁS volumen para detectar tono) ===
    { skillName: 'get_chatter_messages', input: { limit: 100 }, label: 'Mensajes chatter (últimos 100)' },
    { skillName: 'get_chatter_messages', input: { limit: 50, model: 'sale.order' }, label: 'Chatter en pedidos de venta' },
    { skillName: 'get_chatter_messages', input: { limit: 50, model: 'account.move' }, label: 'Chatter en facturas' },
    { skillName: 'get_chatter_messages', input: { limit: 50, model: 'crm.lead' }, label: 'Chatter en oportunidades CRM' },
    { skillName: 'get_mail_activities', input: { limit: 50 }, label: 'Actividades pendientes' },
    { skillName: 'get_recent_emails', input: { limit: 50 }, label: 'Emails enviados recientes' },
    { skillName: 'get_recent_emails', input: { limit: 50, direction: 'incoming' }, label: 'Emails recibidos recientes' },
  ]
}

const BATCH_SIZE = 6
const BATCH_DELAY_MS = 200

/**
 * Run Odoo queries and synthesize a company profile.
 * Returns structured data ready for company_contexts form.
 */
export async function discoverCompanyProfile(
  tenantId: string,
  userEmail: string,
  onProgress?: (p: DiscoveryProgress) => void
): Promise<DiscoveryResult | null> {
  try {
    const allOdooTools = [
      'odoo_sales', 'odoo_accounting', 'odoo_inventory',
      'odoo_purchase', 'odoo_crm', 'odoo_hr', 'odoo_mail'
    ]
    const skills = await loadSkillsForAgent(tenantId, userEmail, allOdooTools)
    const runs = buildDiscoveryRuns()

    // Run in batches (like the script)
    const descriptions: { label: string; text: string }[] = []
    let completed = 0

    for (let i = 0; i < runs.length; i += BATCH_SIZE) {
      const batch = runs.slice(i, i + BATCH_SIZE)
      const batchLabel = batch.map(r => r.label).join(', ')
      onProgress?.({ completed, total: runs.length, currentLabel: batchLabel, phase: 'querying' })

      await Promise.allSettled(
        batch.map(async (run) => {
          const skill = skills[run.skillName]
          if (!skill?.execute) return
          try {
            const result = await skill.execute(run.input) as {
              success: boolean
              data?: { _descripcion?: string }
            }
            if (result.success && result.data?._descripcion) {
              descriptions.push({ label: run.label, text: result.data._descripcion })
            }
          } catch (e) {
            console.warn(`[Discovery] ${run.skillName} failed:`, (e as Error).message)
          }
        })
      )

      completed += batch.length

      if (i + BATCH_SIZE < runs.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    if (descriptions.length === 0) return null

    console.log(`[Discovery] Got ${descriptions.length}/${runs.length} results, synthesizing...`)
    onProgress?.({ completed: runs.length, total: runs.length, currentLabel: 'Sintetizando perfil con IA...', phase: 'synthesizing' })
    const result = await synthesizeProfile(descriptions)
    onProgress?.({ completed: runs.length, total: runs.length, currentLabel: '¡Listo!', phase: 'done' })
    return result
  } catch (e) {
    console.error('[Discovery] Error:', e)
    return null
  }
}

/** Use LLM to synthesize rich Odoo data into structured form fields */
async function synthesizeProfile(
  descriptions: { label: string; text: string }[]
): Promise<DiscoveryResult> {
  const { GoogleGenAI } = await import('@google/genai')
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  const dataDump = descriptions
    .map(d => `### ${d.label}\n${d.text}`)
    .join('\n\n')

  const prompt = `Sos un analista de negocios senior. Analizá datos REALES de Odoo y generá un PERFIL DE CONTEXTO de la empresa.

OBJETIVO: Generar una descripción que sirva como MARCO DE REFERENCIA para cualquier consulta futura. Quien lea esto debe entender DESDE DÓNDE VIENE esta empresa: qué hace, a qué escala, cómo opera, qué estructura tiene.

REGLAS ESTRICTAS:
- Usá EXCLUSIVAMENTE datos proporcionados. NUNCA inventes nombres, cifras ni entidades.
- Priorizá el CONTEXTO GENERAL sobre detalles específicos: industria, escala, estructura, perfil de clientes/productos, modelo de negocio.
- Mencioná nombres concretos (clientes, productos, vendedores) SOLO cuando tengan evidencia fuerte con cifras reales. No listes nombres sin datos que los respalden.
- La descripción debe responder: ¿qué hace esta empresa? ¿a quién le vende? ¿de qué tamaño es? ¿cómo está organizada? ¿cuál es su situación financiera general?
- Evitá ir a lo micro sin evidencia. Mejor "tiene ~50 clientes activos, concentrados en el sector farmacéutico" que listar 15 nombres sin contexto.

Respondé SOLO con JSON válido, sin markdown:
{
  "industry": "rubro/industria detectada — basado en los productos reales y tipo de clientes",
  "toneOfVoice": "Análisis DETALLADO del tono de comunicación basado en chatter y emails REALES. Incluí: (1) nivel de formalidad (tuteo/usted/vos), (2) largo típico de mensajes (cortos y directos vs. elaborados), (3) uso de emojis o signos, (4) si saludan/despiden o van directo al grano, (5) si usan jerga técnica o lenguaje simple, (6) velocidad percibida de respuesta, (7) si el tono cambia entre comunicación interna vs. externa. CITÁ EJEMPLOS TEXTUALES de los mensajes cuando sea posible. Ej: 'Informal, usan tuteo (\"dale, te paso el presupuesto\"), mensajes cortos de 1-2 líneas, sin saludo formal, respuestas rápidas'. Si no hay datos de comunicación suficientes, dejá string vacío.",
  "description": "PERFIL DE CONTEXTO (10-15 oraciones). Debe responder estas preguntas:\\n1. ¿Qué vende la empresa? (tipo de productos/servicios, no lista exhaustiva)\\n2. ¿A quién le vende? (perfil de clientes: empresas, gobierno, profesionales, sectores)\\n3. ¿De qué tamaño es? (facturación anual aproximada, cantidad de clientes activos, productos)\\n4. ¿Cómo está organizada? (multi-empresa, equipos de venta, departamentos, cantidad de empleados)\\n5. ¿Cómo está financieramente? (situación general de caja, deuda, morosidad — sin listar cada cliente moroso)\\n6. ¿Qué modelo de negocio tiene? (distribución, fabricación, servicios, suscripciones, mixto)\\n7. Margen bruto general y moneda(s) de operación\\n8. Proveedores: perfil general (cuántos, de qué tipo), no lista\\n9. Stock: ¿manejan inventario? ¿es crítico? situación general\\n10. CRM/Pipeline: ¿tienen proceso comercial activo? magnitud general\\n11. Equipo humano: departamentos principales, estructura organizacional\\n12. Comunicación: tono general (formal/informal), canales que usan\\nIMPORTANTE: Priorizá el MARCO GENERAL. Los detalles específicos (nombres, cifras exactas) van en topCustomers y topProducts, no en la descripción.",
  "topCustomers": [{"name": "Nombre REAL del cliente", "notes": "Facturación $X (X% del total), deuda $X, X días de mora si aplica, categoría/rubro si se puede inferir"}],
  "topProducts": [{"name": "Nombre REAL del producto", "notes": "Revenue $X, margen X%, unidades vendidas X, categoría, stock actual si disponible"}],
  "topSuppliers": [{"name": "Nombre REAL del proveedor", "notes": "Compras $X, cantidad de OC, tipo de productos que provee, plazo de pago si se puede inferir"}]
}

IMPORTANTE sobre topCustomers, topProducts y topSuppliers:
- SOLO incluí clientes/productos/proveedores que aparezcan en MÚLTIPLES fuentes de datos (ej: ventas + deuda, o revenue + margen + stock, o compras + facturas proveedor). Un nombre que aparece en un solo reporte NO tiene suficiente evidencia.
- Máximo 10 cada uno, ordenados por facturación/revenue/compras de mayor a menor
- Las "notes" deben tener DATOS CONCRETOS de al menos 2 fuentes: montos, porcentajes, deuda, mora, margen, stock
- Si un cliente solo aparece en una lista sin cifras, NO lo incluyas
- Si un producto solo tiene revenue pero no margen ni stock, mencioná solo lo que tenés
- Priorizá los que tienen la foto más COMPLETA (revenue + margen + deuda + stock)

Todo en español argentino, datos duros, sin florituras.

---

DATA COMPLETA DE ODOO (${descriptions.length} reportes):

${dataDump}`

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 8192 },
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned) as DiscoveryResult
  } catch {
    return { industry: '', description: '', toneOfVoice: '', topCustomers: [], topProducts: [], topSuppliers: [] }
  }
}
