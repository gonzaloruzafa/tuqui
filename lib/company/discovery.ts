/**
 * Company Discovery — Auto-discover company profile from Odoo
 * 
 * Runs ~20 key Odoo queries (using _descripcion) and synthesizes
 * a rich company profile with LLM. Based on scripts/company-discovery.ts
 * which validated 57/61 queries on Cedent in 73s.
 */

import { loadSkillsForAgent } from '@/lib/skills/loader'

interface DiscoveryResult {
  industry: string
  description: string
  topCustomers: { name: string; notes: string }[]
  topProducts: { name: string; notes: string }[]
}

type SkillRun = { skillName: string; input: Record<string, unknown>; label: string }

/** Build period helpers based on current date */
function buildPeriods() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0]
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0]
  return {
    lastTwelveMonths: { start: twelveMonthsAgo, end: today },
    lastSixMonths: { start: sixMonthsAgo, end: today },
  }
}

/** Core discovery queries — rich enough to fill all form fields */
function buildDiscoveryRuns(): SkillRun[] {
  const { lastTwelveMonths, lastSixMonths } = buildPeriods()

  return [
    // === ESTRUCTURA ===
    { skillName: 'get_companies', input: { limit: 10 }, label: 'Empresas del grupo' },
    { skillName: 'get_sales_teams', input: { includeStats: true }, label: 'Equipos de venta' },

    // === VENTAS ===
    { skillName: 'get_sales_total', input: { period: lastTwelveMonths }, label: 'Ventas totales 12m' },
    { skillName: 'get_sales_by_customer', input: { period: lastTwelveMonths, limit: 30 }, label: 'Ventas por cliente 12m' },
    { skillName: 'get_sales_by_product', input: { period: lastTwelveMonths, limit: 30 }, label: 'Ventas por producto 12m' },
    { skillName: 'get_sales_by_seller', input: { period: lastTwelveMonths, limit: 20 }, label: 'Ventas por vendedor 12m' },
    { skillName: 'get_sales_by_category', input: { period: lastTwelveMonths, limit: 30 }, label: 'Ventas por categoría 12m' },
    { skillName: 'get_top_products', input: { period: lastTwelveMonths, limit: 30 }, label: 'Top productos 12m' },
    { skillName: 'get_top_customers', input: { period: lastTwelveMonths, limit: 30 }, label: 'Top clientes 12m' },
    { skillName: 'get_sales_margin_summary', input: { period: lastTwelveMonths }, label: 'Resumen margen 12m' },

    // === COMPRAS / PROVEEDORES ===
    { skillName: 'get_purchases_by_supplier', input: { period: lastTwelveMonths, limit: 30 }, label: 'Top proveedores 12m' },

    // === STOCK ===
    { skillName: 'get_product_stock', input: { limit: 30 }, label: 'Stock productos' },
    { skillName: 'get_stock_valuation', input: {}, label: 'Valuación de inventario' },

    // === CLIENTES ===
    { skillName: 'get_new_customers', input: { period: lastSixMonths, limit: 30, includeDetails: true }, label: 'Clientes nuevos 6m' },

    // === TESORERÍA ===
    { skillName: 'get_cash_balance', input: { includeBanks: true }, label: 'Saldos caja y bancos' },
    { skillName: 'get_debt_by_customer', input: { limit: 30, includeOverdueDays: true }, label: 'Deuda por cliente' },
  ]
}

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 200

/**
 * Run Odoo queries and synthesize a company profile.
 * Returns structured data ready for company_contexts form.
 */
export async function discoverCompanyProfile(
  tenantId: string,
  userEmail: string
): Promise<DiscoveryResult | null> {
  try {
    const allOdooTools = [
      'odoo_sales', 'odoo_accounting', 'odoo_inventory',
      'odoo_purchase', 'odoo_crm'
    ]
    const skills = await loadSkillsForAgent(tenantId, userEmail, allOdooTools)
    const runs = buildDiscoveryRuns()

    // Run in batches (like the script)
    const descriptions: { label: string; text: string }[] = []

    for (let i = 0; i < runs.length; i += BATCH_SIZE) {
      const batch = runs.slice(i, i + BATCH_SIZE)

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

      if (i + BATCH_SIZE < runs.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    if (descriptions.length === 0) return null

    console.log(`[Discovery] Got ${descriptions.length}/${runs.length} results, synthesizing...`)
    return await synthesizeProfile(descriptions)
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

  const prompt = `Sos un analista de negocios. Analizá datos REALES de Odoo y generá un perfil de empresa estructurado.

REGLAS:
- Usá EXCLUSIVAMENTE los datos proporcionados. NUNCA inventes.
- Mencioná nombres reales de clientes, productos, proveedores con cifras.
- La descripción debe ser RICA y detallada (5-8 oraciones mínimo).
- En topCustomers y topProducts incluí TODOS los relevantes (hasta 10 cada uno).
- Las "notes" de cada item deben incluir datos concretos (montos, %, volumen).

Respondé SOLO con JSON válido, sin markdown:
{
  "industry": "rubro/industria detectada (basada en productos y clientes reales)",
  "description": "Descripción EXTENSA de la empresa: qué vende, a quién, escala de facturación anual, cantidad de clientes, estructura (multi-empresa o no), equipos de venta, moneda de operación, margen general. Mínimo 5 oraciones con datos concretos.",
  "topCustomers": [{"name": "Nombre Real", "notes": "Facturación $X, X% del total, observación relevante"}],
  "topProducts": [{"name": "Nombre Real", "notes": "Revenue $X, margen X%, unidades vendidas si disponible"}]
}

Máximo 10 clientes y 10 productos. Ordenalos por importancia/facturación.
Todo en español argentino, conciso pero con datos duros.

---

DATA DE ODOO (${descriptions.length} reportes):

${dataDump}`

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 4096 },
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned) as DiscoveryResult
  } catch {
    return { industry: '', description: '', topCustomers: [], topProducts: [] }
  }
}
