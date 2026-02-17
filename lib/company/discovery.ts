/**
 * Company Discovery — Auto-discover company profile from Odoo
 * 
 * Runs a few key Odoo queries and synthesizes a company profile
 * with LLM. Light version: 4-5 queries, ~10s total.
 */

import { loadSkillsForAgent } from '@/lib/skills/loader'

interface DiscoveryResult {
  industry: string
  description: string
  topCustomers: { name: string; notes: string }[]
  topProducts: { name: string; notes: string }[]
}

/** Skills to run for discovery (subset of all Odoo skills) */
const DISCOVERY_SKILLS = [
  'get_companies',
  'get_top_customers', 
  'get_top_products',
  'get_sales_teams',
  'get_sales_total',
] as const

/**
 * Run Odoo queries and synthesize a company profile.
 * Returns structured data ready for company_contexts form.
 */
export async function discoverCompanyProfile(
  tenantId: string,
  userEmail: string
): Promise<DiscoveryResult | null> {
  try {
    // Load all odoo skills for this tenant
    const allOdooTools = [
      'odoo_sales', 'odoo_accounting', 'odoo_inventory',
      'odoo_purchase', 'odoo_crm'
    ]
    const skills = await loadSkillsForAgent(tenantId, userEmail, allOdooTools)

    // Run discovery queries in parallel
    const results: Record<string, unknown> = {}
    const queries = DISCOVERY_SKILLS.map(async (name) => {
      const skill = skills[name]
      if (!skill?.execute) return
      try {
        results[name] = await skill.execute({
          period: 'this_year',
          limit: 10,
        })
      } catch (e) {
        console.warn(`[Discovery] ${name} failed:`, (e as Error).message)
      }
    })

    await Promise.allSettled(queries)

    // Synthesize with LLM
    return await synthesizeProfile(results)
  } catch (e) {
    console.error('[Discovery] Error:', e)
    return null
  }
}

/** Use LLM to synthesize raw Odoo data into a company profile */
async function synthesizeProfile(
  data: Record<string, unknown>
): Promise<DiscoveryResult> {
  const { GoogleGenAI } = await import('@google/genai')
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  const prompt = `Analizá estos datos de un ERP (Odoo) y generá un perfil de empresa en JSON.

DATOS:
${JSON.stringify(data, null, 2)}

Respondé SOLO con JSON válido, sin markdown:
{
  "industry": "rubro/industria detectada",
  "description": "descripción de 2-3 oraciones de qué hace la empresa, basada en los datos",
  "topCustomers": [{"name": "Nombre", "notes": "observación breve"}],
  "topProducts": [{"name": "Nombre", "notes": "observación breve"}]
}

Máximo 5 clientes y 5 productos. Si no hay datos suficientes, dejá arrays vacíos.
La descripción debe ser en español, concisa y basada SOLO en los datos provistos.`

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 1024 },
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  
  try {
    // Clean potential markdown wrapping
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned) as DiscoveryResult
  } catch {
    return { industry: '', description: '', topCustomers: [], topProducts: [] }
  }
}
