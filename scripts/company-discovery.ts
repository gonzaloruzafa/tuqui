#!/usr/bin/env npx tsx
/**
 * Company Discovery — Full Odoo Analysis
 * 
 * Corre TODAS las skills de Odoo posibles y le pide a Gemini
 * un análisis detallado de la empresa basado en data real.
 * 
 * Usage: npx tsx scripts/company-discovery.ts [tenantId]
 * Default: Cedent (de7ef34a-12bd-4fe9-9d02-3d876a9393c2)
 * 
 * Output: /tmp/company-discovery-{tenantName}.md
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ============ LOAD ENV ============
const __dirname = dirname(fileURLToPath(import.meta.url))
const envFiles = ['.env', '.env.local', '.env.production.local']
for (const envFile of envFiles) {
  const envPath = resolve(__dirname, '..', envFile)
  if (existsSync(envPath)) {
    const envConfig = readFileSync(envPath, 'utf8')
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^([^=#]+)=(.*)$/)
      if (match) {
        const [, key, value] = match
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '')
        }
      }
    })
  }
}

import { createClient } from '@supabase/supabase-js'
import { createOdooClient } from '../lib/skills/odoo/_client.ts'
import type { OdooClientConfig } from '../lib/skills/odoo/_client.ts'
import { odooSkills } from '../lib/skills/odoo/index.ts'
import type { SkillContext } from '../lib/skills/types.ts'
import { decrypt } from '../lib/crypto.ts'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

// ============ CONFIG ============
const DEFAULT_TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'
const tenantId = process.argv[2] || DEFAULT_TENANT_ID
const BATCH_SIZE = 6 // concurrent skills per batch
const BATCH_DELAY_MS = 300 // pause between batches

// ============ PERIODS ============
const today = new Date().toISOString().split('T')[0]
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0]
const prevMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0]
const threeMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1).toISOString().split('T')[0]
const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1).toISOString().split('T')[0]
const twelveMonthsAgo = new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1).toISOString().split('T')[0]
const yearStart = `${new Date().getFullYear()}-01-01`
const prevYearStart = `${new Date().getFullYear() - 1}-01-01`
const prevYearEnd = `${new Date().getFullYear() - 1}-12-31`

const thisMonth = { start: monthStart, end: today }
const lastMonth = { start: prevMonthStart, end: prevMonthEnd }
const lastThreeMonths = { start: threeMonthsAgo, end: today }
const lastSixMonths = { start: sixMonthsAgo, end: today }
const lastTwelveMonths = { start: twelveMonthsAgo, end: today }
const ytd = { start: yearStart, end: today }
const prevYear = { start: prevYearStart, end: prevYearEnd }

// ============ SKILL INPUTS ============
// Run skills with MAXIMUM data extraction — wide periods, high limits, multiple angles
// Some skills run twice with different params for richer coverage
type SkillRun = { skillName: string; input: unknown; label: string }

const discoveryRuns: SkillRun[] = [
  // === VENTAS (panorama completo) ===
  { skillName: 'get_sales_total', input: { period: lastTwelveMonths }, label: 'Ventas totales 12 meses' },
  { skillName: 'get_sales_total', input: { period: thisMonth }, label: 'Ventas este mes' },
  { skillName: 'get_sales_total', input: { period: lastMonth }, label: 'Ventas mes pasado' },
  { skillName: 'get_sales_by_customer', input: { period: lastTwelveMonths, limit: 50 }, label: 'Ventas por cliente 12m' },
  { skillName: 'get_sales_by_product', input: { period: lastTwelveMonths, limit: 50 }, label: 'Ventas por producto 12m' },
  { skillName: 'get_sales_by_seller', input: { period: lastTwelveMonths, limit: 50 }, label: 'Ventas por vendedor 12m' },
  { skillName: 'get_sales_by_seller', input: { period: thisMonth, limit: 20 }, label: 'Ventas por vendedor este mes' },
  { skillName: 'get_top_products', input: { period: lastTwelveMonths, limit: 50 }, label: 'Top productos 12m (revenue)' },
  { skillName: 'get_top_products', input: { period: lastTwelveMonths, limit: 30, orderBy: 'quantity' }, label: 'Top productos 12m (unidades)' },
  { skillName: 'get_top_customers', input: { period: lastTwelveMonths, limit: 50 }, label: 'Top clientes 12m' },
  { skillName: 'get_pending_sale_orders', input: { limit: 50 }, label: 'Pedidos pendientes' },
  { skillName: 'get_pending_sale_orders', input: { limit: 30, pendingType: 'invoice' }, label: 'Pedidos pendientes facturar' },
  { skillName: 'get_sales_by_category', input: { period: lastTwelveMonths, limit: 50 }, label: 'Ventas por categoría 12m' },
  { skillName: 'get_sales_teams', input: { includeStats: true }, label: 'Equipos de venta' },
  { skillName: 'get_companies', input: { limit: 10 }, label: 'Empresas del grupo' },
  // Comparativas mes a mes
  { skillName: 'compare_sales_periods', input: {
    currentPeriod: { ...thisMonth, label: 'Este mes (feb 2026)' },
    previousPeriod: { ...lastMonth, label: 'Mes pasado (ene 2026)' },
    includeProducts: true, includeCustomers: true, limit: 10,
  }, label: 'Comparativa este mes vs pasado' },
  { skillName: 'compare_sales_periods', input: {
    currentPeriod: { ...lastThreeMonths, label: 'Últimos 3 meses' },
    previousPeriod: { start: new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1).toISOString().split('T')[0], end: threeMonthsAgo, label: '3 meses anteriores' },
    includeProducts: true, includeCustomers: true, limit: 10,
  }, label: 'Comparativa trimestral' },
  { skillName: 'get_sales_margin_summary', input: { period: lastTwelveMonths }, label: 'Resumen margen 12m' },
  { skillName: 'get_sales_margin_summary', input: { period: thisMonth }, label: 'Resumen margen este mes' },

  // === FACTURACIÓN / DEUDA ===
  { skillName: 'get_debt_by_customer', input: { limit: 50, includeOverdueDays: true }, label: 'Deuda por cliente' },
  { skillName: 'get_invoices_by_customer', input: { period: lastTwelveMonths, limit: 50 }, label: 'Facturas por cliente 12m' },
  { skillName: 'get_invoice_lines', input: { period: lastThreeMonths, limit: 100, groupBy: 'product' }, label: 'Líneas factura por producto 3m' },
  { skillName: 'get_invoice_lines', input: { period: lastThreeMonths, limit: 100, groupBy: 'seller' }, label: 'Líneas factura por vendedor 3m' },
  { skillName: 'get_invoice_lines', input: { period: lastThreeMonths, limit: 100, groupBy: 'customer' }, label: 'Líneas factura por cliente 3m' },
  { skillName: 'get_overdue_invoices', input: { limit: 50, groupByCustomer: true }, label: 'Facturas vencidas por cliente' },

  // === STOCK (inventario completo) ===
  { skillName: 'get_product_stock', input: { limit: 50 }, label: 'Stock productos' },
  { skillName: 'get_low_stock_products', input: { threshold: 10, limit: 50 }, label: 'Productos bajo stock' },
  { skillName: 'get_stock_valuation', input: {}, label: 'Valuación de inventario' },
  { skillName: 'get_top_stock_products', input: { limit: 30 }, label: 'Top stock por valor' },
  { skillName: 'get_expiring_stock', input: { days_ahead: 90, include_expired: true, limit: 30 }, label: 'Stock vencido/por vencer' },
  { skillName: 'get_stock_rotation', input: { period: lastSixMonths, limit: 30 }, label: 'Rotación stock 6m' },
  { skillName: 'get_stock_rotation', input: { period: lastSixMonths, limit: 30, zeroSalesOnly: true }, label: 'Productos sin rotación 6m' },

  // === PAGOS ===
  { skillName: 'get_payments_received', input: { period: lastTwelveMonths, groupByJournal: true }, label: 'Cobros por diario 12m' },
  { skillName: 'get_payments_received', input: { period: lastThreeMonths, groupByCustomer: true, limit: 30 }, label: 'Cobros por cliente 3m' },
  { skillName: 'get_payments_made', input: { period: lastTwelveMonths, groupByJournal: true }, label: 'Pagos por diario 12m' },
  { skillName: 'get_payments_made', input: { period: lastThreeMonths, groupBySupplier: true, limit: 30 }, label: 'Pagos a proveedores 3m' },

  // === COMPRAS ===
  { skillName: 'get_purchase_orders', input: { period: lastTwelveMonths, limit: 50 }, label: 'Órdenes de compra 12m' },
  { skillName: 'get_purchase_orders', input: { period: lastTwelveMonths, limit: 30, groupBy: 'vendor' }, label: 'Compras por proveedor 12m' },
  { skillName: 'get_purchases_by_supplier', input: { period: lastTwelveMonths, limit: 50 }, label: 'Top proveedores 12m' },
  { skillName: 'get_vendor_bills', input: { period: lastTwelveMonths, limit: 50 }, label: 'Facturas proveedor 12m' },

  // === TESORERÍA / CONTABILIDAD ===
  { skillName: 'get_cash_balance', input: { includeBanks: true }, label: 'Saldos caja y bancos' },
  { skillName: 'get_accounts_receivable', input: { groupByCustomer: true, limit: 50 }, label: 'Cuentas por cobrar' },
  { skillName: 'get_accounts_receivable', input: { overdueOnly: true, groupByCustomer: true, limit: 50 }, label: 'Cuentas por cobrar VENCIDAS' },
  { skillName: 'get_accounts_payable', input: { groupBySupplier: true, limit: 50 }, label: 'Cuentas por pagar' },
  { skillName: 'get_accounts_payable', input: { overdueOnly: true, groupBySupplier: true, limit: 50 }, label: 'Cuentas por pagar VENCIDAS' },
  { skillName: 'get_ar_aging', input: { groupByCustomer: true, limit: 30 }, label: 'Aging deuda clientes' },
  { skillName: 'get_account_balance', input: { limit: 100 }, label: 'Plan de cuentas con saldos' },
  { skillName: 'get_journal_entries', input: { period: thisMonth, limit: 50 }, label: 'Asientos del mes' },

  // === CLIENTES (inteligencia) ===
  { skillName: 'get_new_customers', input: { period: lastSixMonths, limit: 50, includeDetails: true }, label: 'Clientes nuevos 6m' },
  { skillName: 'get_inactive_customers', input: { limit: 50, includeDetails: true }, label: 'Clientes inactivos' },

  // === CRM ===
  { skillName: 'get_crm_pipeline', input: { groupByStage: true, limit: 100 }, label: 'Pipeline CRM' },
  { skillName: 'get_crm_pipeline', input: { status: 'won', period: lastSixMonths, groupByStage: true, limit: 50 }, label: 'Oportunidades ganadas 6m' },
  { skillName: 'get_stale_opportunities', input: { staleDays: 30, limit: 30 }, label: 'Oportunidades estancadas' },
  { skillName: 'get_lost_opportunities', input: { period: lastTwelveMonths, limit: 30 }, label: 'Oportunidades perdidas 12m' },
  { skillName: 'search_crm_opportunities', input: { status: 'open', limit: 50 }, label: 'Oportunidades abiertas' },
  { skillName: 'get_crm_tags', input: { includeStats: true }, label: 'Tags CRM' },

  // === MÁRGENES (doble ángulo) ===
  { skillName: 'get_product_margin', input: { period: lastTwelveMonths, limit: 30, sortBy: 'margin_total' }, label: 'Margen por producto (total) 12m' },
  { skillName: 'get_product_margin', input: { period: lastTwelveMonths, limit: 30, sortBy: 'margin_percent' }, label: 'Margen por producto (%) 12m' },
  { skillName: 'get_product_margin', input: { period: lastTwelveMonths, limit: 20, sortBy: 'margin_percent', maxMarginPercent: 30 }, label: 'Productos bajo margen 12m' },

  // === SUSCRIPCIONES ===
  { skillName: 'get_subscription_health', input: { expiringWithinDays: 90, limit: 30 }, label: 'Salud suscripciones' },
  { skillName: 'get_subscription_churn', input: { compareWithPrevious: true }, label: 'Churn suscripciones' },
]

// ============ HELPERS ============
function fmt(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

async function runDiscovery(
  skills: typeof odooSkills,
  runs: SkillRun[],
  context: SkillContext,
): Promise<{ label: string; descripcion: string; durationMs: number }[]> {
  const results: { label: string; descripcion: string; durationMs: number }[] = []
  const errors: string[] = []
  let completed = 0

  // Build skill lookup
  const skillMap = new Map(skills.map(s => [s.name, s]))

  // Validate all runs have matching skills
  const validRuns = runs.filter(r => {
    if (!skillMap.has(r.skillName)) {
      console.log(`⏭️  Skip: ${r.label} (skill '${r.skillName}' not found)`)
      return false
    }
    return true
  })

  console.log(`🚀 Running ${validRuns.length} discovery queries in batches of ${BATCH_SIZE}...\n`)

  // Process in batches
  for (let i = 0; i < validRuns.length; i += BATCH_SIZE) {
    const batch = validRuns.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(validRuns.length / BATCH_SIZE)
    console.log(`── Batch ${batchNum}/${totalBatches} ──`)

    await Promise.allSettled(
      batch.map(async (run) => {
        const skill = skillMap.get(run.skillName)!
        const start = Date.now()
        try {
          const result = await skill.execute(run.input, context) as { success: boolean; data?: { _descripcion?: string }; error?: { message?: string } }
          const duration = Date.now() - start
          completed++

          if (result.success && result.data?._descripcion) {
            results.push({ label: run.label, descripcion: result.data._descripcion, durationMs: duration })
            console.log(`  ✅ ${run.label.padEnd(40)} ${fmt(duration).padStart(6)}  (${result.data._descripcion.length} chars)`)
          } else if (result.success) {
            const summary = JSON.stringify(result.data).slice(0, 500)
            results.push({ label: run.label, descripcion: `[${run.skillName}] ${summary}`, durationMs: duration })
            console.log(`  ⚠️  ${run.label.padEnd(40)} ${fmt(duration).padStart(6)}  (raw data)`)
          } else {
            const errMsg = result.error?.message || 'Unknown error'
            errors.push(`${run.label}: ${errMsg}`)
            console.log(`  ❌ ${run.label.padEnd(40)} ${fmt(duration).padStart(6)}  → ${errMsg.slice(0, 60)}`)
          }
        } catch (err) {
          const duration = Date.now() - start
          completed++
          const errMsg = err instanceof Error ? err.message : String(err)
          errors.push(`${run.label}: ${errMsg}`)
          console.log(`  💥 ${run.label.padEnd(40)} ${fmt(duration).padStart(6)}  → ${errMsg.slice(0, 60)}`)
        }
      })
    )

    if (i + BATCH_SIZE < validRuns.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  console.log()
  console.log(`📊 Results: ${results.length} OK, ${errors.length} errors, ${completed}/${validRuns.length} total`)
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors:`)
    errors.forEach(e => console.log(`   - ${e.slice(0, 120)}`))
  }

  return results
}

// ============ GEMINI SYNTHESIS ============
async function synthesizeProfile(
  tenantName: string,
  results: { label: string; descripcion: string; durationMs: number }[],
): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('❌ Missing GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY')
    process.exit(1)
  }

  const google = createGoogleGenerativeAI({ apiKey })

  // Build the data dump grouped by label
  const dataDump = results
    .map(r => `### ${r.label}\n${r.descripcion}`)
    .join('\n\n')

  const totalChars = results.reduce((s, r) => s + r.descripcion.length, 0)
  console.log(`\n🧠 Feeding ${results.length} data points to Gemini (${totalChars} chars)...\n`)

  const systemPrompt = `Sos un analista de negocios senior y consultor estratégico. A partir de datos REALES extraídos de Odoo (ERP), generás análisis extensos, detallados y accionables.

REGLAS ESTRICTAS:
- Usá EXCLUSIVAMENTE datos proporcionados. NUNCA inventes nombres, cifras ni entidades.
- Mencioná TODOS los nombres que aparezcan: clientes, vendedores, productos, proveedores — con sus cifras exactas.
- Cuando listés datos, incluí TODOS los disponibles, no solo top 3. Si hay 20 vendedores, listalos a todos.
- Hacé CÁLCULOS: porcentajes de concentración, ratios, tasas de crecimiento, ticket promedio, etc.
- Detectá PATRONES: estacionalidad, tendencias, correlaciones entre datos de distintas fuentes.
- Identificá PROBLEMAS CONCRETOS con nombre y apellido (ej: "Ministerio de Salud de Santa Fe debe $X vencidos hace Y días").
- El tono es profesional pero directo, estilo consultoría argentina.
- SER EXTENSO. Esto no es un resumen ejecutivo — es un DOSSIER COMPLETO de la empresa.`

  const userPrompt = `# DOSSIER COMPLETO: ${tenantName}

Tenés ${results.length} reportes de datos reales de Odoo. Generá un análisis EXHAUSTIVO con las siguientes secciones. Para cada sección, usá TODA la data disponible — no resumas, expandí.

---

## 1. IDENTIDAD Y NATURALEZA DEL NEGOCIO
- ¿Qué vende esta empresa? Listá los productos/servicios concretos que aparecen.
- ¿A quién le vende? Tipo de clientes (empresas, gobierno, profesionales, consumidor final).
- ¿En qué industria/rubro opera? Justificá con los productos y clientes reales.
- Estructura societaria: ¿es multiempresa? ¿Cuáles son las razones sociales?
- Escala: ¿es micro, PyME, mediana? Basate en facturación, cantidad de clientes y empleados.
- Moneda(s) de operación.

## 2. RADIOGRAFÍA COMERCIAL COMPLETA
### 2.1 Facturación y evolución
- Facturación total del último año, desglosada mes a mes si hay data.
- Comparativa: ¿crece o decrece? ¿A qué tasa?
- Ticket promedio por pedido.
- Cantidad total de pedidos y clientes únicos.

### 2.2 Equipo de ventas (TODOS los vendedores)
- Listá CADA vendedor con su facturación, cantidad de pedidos, ticket promedio.
- ¿Quién es el top performer? ¿Cuánto representa del total?
- ¿Hay vendedores con bajo rendimiento? ¿Quiénes?
- Equipos de venta: listalos todos con métricas.
- ¿Hay dependencia peligrosa de un vendedor o equipo?

### 2.3 Márgenes
- Margen bruto general y del último período.
- Productos con MEJOR margen (listá todos con %).
- Productos con PEOR margen — ¿hay productos vendidos a pérdida?
- ¿El margen está mejorando o empeorando?

## 3. CLIENTES: ANÁLISIS PROFUNDO
### 3.1 Top clientes
- Listá TODOS los top clientes con montos exactos.
- Calculá: ¿el top 5 qué % del revenue total representa? ¿Y el top 10?
- ¿Hay dependencia de 1-2 clientes grandes?

### 3.2 Adquisición y retención
- ¿Cuántos clientes nuevos en los últimos 6 meses? Listá los principales.
- ¿Cuántos clientes se perdieron (inactivos)? ¿Cuánto revenue representaban?
- ¿Cuáles son los clientes perdidos más significativos por nombre?

### 3.3 Morosidad y cobranzas
- Total de deuda pendiente y total vencida.
- LISTÁ cada deudor con monto, días de atraso.
- Aging completo: ¿cuánto hay en cada tramo (0-30, 31-60, 61-90, 90+)?
- ¿Quiénes son los casos más urgentes?

## 4. PRODUCTOS: CATÁLOGO Y PERFORMANCE
### 4.1 Qué venden
- Listá TODOS los productos del top con nombre, código, revenue y unidades.
- ¿Qué categorías de productos manejan?
- ¿Hay una línea de productos dominante?

### 4.2 Stock e inventario
- Valuación total del inventario.
- Productos con mayor valor en stock.
- Productos con stock crítico (bajo o negativo) — listá cada uno.
- Productos sin rotación (no se vendieron en 6 meses) — ¿cuánto capital representan?
- Stock vencido o por vencer.

## 5. COMPRAS Y PROVEEDORES
- Volumen total de compras (12 meses).
- Top proveedores por monto — listá todos los disponibles.
- Facturas de proveedores pendientes de pago.
- ¿Hay concentración en pocos proveedores?

## 6. FINANZAS Y TESORERÍA
### 6.1 Posición financiera
- Saldos de caja y bancos (cada cuenta/diario).
- Cuentas por cobrar totales y vencidas.
- Cuentas por pagar totales y vencidas.
- Ratio: CxC / CxP — ¿la empresa financia a sus clientes con deuda de proveedores?

### 6.2 Flujo de fondos
- Cobros del período por canal/diario.
- Pagos del período por canal/diario.
- ¿El flujo es positivo o negativo?

### 6.3 Aging de deuda
- Descomposición completa por tramos.
- ¿La morosidad se concentra en pocos clientes o es generalizada?

## 7. CRM Y PIPELINE COMERCIAL
- Total oportunidades abiertas y monto.
- Pipeline por etapa con cantidades y montos.
- Oportunidades estancadas: ¿cuántas, hace cuánto, por qué monto?
- Oportunidades perdidas: causas principales, montos.
- Tags que usa el equipo — ¿qué revelan sobre el proceso comercial?
- Win rate estimado si hay data de ganadas vs perdidas.

## 8. SUSCRIPCIONES Y RECURRENCIA (si aplica)
- MRR actual.
- Cantidad de suscripciones activas vs totales.
- Churn rate.
- Suscripciones en riesgo.

## 9. DIAGNÓSTICO EJECUTIVO
### 9.1 Fortalezas
- ¿Qué hace BIEN esta empresa? Con evidencia concreta.

### 9.2 Problemas y Riesgos detectados
- Listá CADA problema encontrado, con datos específicos:
  - Morosidad de clientes específicos
  - Concentración de revenue
  - Stock parado
  - Vendedores de bajo rendimiento
  - Pipeline estancado
  - Caída de ventas
  - Liquidez

### 9.3 Oportunidades de mejora
- Acciones concretas que podrían implementar.

### 9.4 Métricas clave
Armá una tabla con las 15-20 métricas más importantes del negocio.

---

DATA COMPLETA DE ODOO (${results.length} reportes):

${dataDump}`

  const { text } = await generateText({
    model: google('gemini-2.0-flash'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 16000,
  })

  return text
}

// ============ MAIN ============
async function main() {
  const startTime = Date.now()

  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║              🔍 COMPANY DISCOVERY — FULL ODOO ANALYSIS          ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`📋 Tenant: ${tenantId}`)
  console.log(`📦 Skills disponibles: ${odooSkills.length}`)
  console.log(`🎯 Queries a ejecutar: ${discoveryRuns.length}`)
  console.log()

  // ---- Connect to Supabase ----
  const supabaseUrl = process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.NEXT_PUBLIC_MASTER_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // ---- Fetch tenant ----
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) {
    console.error(`❌ Tenant not found: ${tenantError?.message || 'No data'}`)
    process.exit(1)
  }

  // ---- Fetch Odoo integration ----
  const { data: integration, error: integrationError } = await supabase
    .from('integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('type', 'odoo')
    .single()

  if (integrationError || !integration || !integration.is_active) {
    console.error(`❌ Odoo integration not found or inactive: ${integrationError?.message || 'No data'}`)
    process.exit(1)
  }

  const config = integration.config as Record<string, string>
  const rawApiKey = config.odoo_password || config.api_key
  const apiKey = decrypt(rawApiKey)

  const clientConfig: OdooClientConfig = {
    url: config.odoo_url || config.url,
    db: config.odoo_db || config.db,
    username: config.odoo_user || config.username,
    apiKey,
  }

  console.log(`🏢 Empresa: ${tenant.name}`)
  console.log(`🔗 Odoo: ${clientConfig.url}`)
  console.log(`📦 DB: ${clientConfig.db}`)
  console.log()

  // ---- Test connection ----
  const client = createOdooClient(clientConfig)
  console.log('🔌 Testeando conexión...')
  try {
    await client.authenticate()
    console.log('✅ Conexión exitosa!\n')
  } catch (error) {
    console.error('❌ Conexión falló:', error)
    process.exit(1)
  }

  // ---- Build SkillContext ----
  const skillContext: SkillContext = {
    userId: 'company-discovery',
    tenantId,
    credentials: {
      odoo: {
        url: clientConfig.url,
        db: clientConfig.db,
        username: clientConfig.username,
        apiKey: clientConfig.apiKey,
      },
    },
  }

  // ---- Run ALL skills ----
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('         FASE 1: RECOLECCIÓN DE DATA (Odoo Skills)            ')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const descriptions = await runDiscovery(odooSkills, discoveryRuns, skillContext)

  if (descriptions.length === 0) {
    console.error('\n❌ No se obtuvo data de ningún skill. Abortando.')
    process.exit(1)
  }

  // ---- Synthesize with Gemini ----
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('         FASE 2: SÍNTESIS CON GEMINI                          ')
  console.log('═══════════════════════════════════════════════════════════════')

  const profile = await synthesizeProfile(tenant.name, descriptions)

  // ---- Output ----
  const totalDuration = Date.now() - startTime
  const slug = tenant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const outputPath = `/tmp/company-discovery-${slug}.md`

  // Build full output
  const fullOutput = `# 🔍 Company Discovery: ${tenant.name}

> Generado: ${new Date().toISOString()}
> Tenant: ${tenantId}
> Queries ejecutadas: ${descriptions.length}/${discoveryRuns.length}
> Duración total: ${fmt(totalDuration)}

---

${profile}

---

## 📊 Data Sources (${descriptions.length} queries)

| Query | Duración | Chars |
|-------|----------|-------|
${descriptions.map(d =>
    `| ${d.label} | ${fmt(d.durationMs)} | ${d.descripcion.length} |`
  ).join('\n')}

## 📝 Raw Descriptions

${descriptions.map(d =>
    `### ${d.label}\n\`\`\`\n${d.descripcion}\n\`\`\``
  ).join('\n\n')}
`

  writeFileSync(outputPath, fullOutput, 'utf8')

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('                      RESULTADO                                ')
  console.log('═══════════════════════════════════════════════════════════════\n')
  console.log(profile)
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`\n📄 Perfil guardado en: ${outputPath}`)
  console.log(`⏱️  Duración total: ${fmt(totalDuration)}`)
  console.log(`📦 Queries exitosas: ${descriptions.length}/${discoveryRuns.length}`)
  console.log()
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
