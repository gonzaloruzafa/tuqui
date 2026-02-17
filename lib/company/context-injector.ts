import { getClient } from '@/lib/supabase/client'

interface CompanyContextResult {
  context: string
  tokenEstimate: number
  sources: string[]
}

interface NamedItem {
  name: string
  notes?: string
}

/**
 * Genera el contexto de empresa combinando 3 fuentes:
 * 1. Datos manuales (basics, clientes, productos, reglas, tono)
 * 2. Web summary (de scraping)
 * 3. Documentos vinculados (de la base de conocimiento)
 *
 * Output: string conciso de ~300 tokens para inyectar en system prompt.
 */
export async function getCompanyContext(tenantId: string): Promise<CompanyContextResult> {
  const db = getClient()
  const sources: string[] = []
  const parts: string[] = []

  // 1. TENANT BASICS
  const { data: tenant } = await db
    .from('tenants')
    .select('name, website')
    .eq('id', tenantId)
    .single()

  if (tenant?.name) {
    parts.push(`EMPRESA: ${tenant.name}`)
    sources.push('tenant')
  }

  // 2. COMPANY CONTEXT
  const { data: ctx } = await db
    .from('company_contexts')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  if (ctx) {
    const briefing = ctx.company_briefing as string | null

    if (briefing) {
      // Pre-generated narrative briefing (best quality, insider tone)
      parts.push(briefing)
      sources.push('briefing')
    } else {
      // Fallback: structured data with higher limits
      const basics = ctx.basics as Record<string, string> | null
      if (basics?.industry) parts.push(`RUBRO: ${basics.industry}`)
      if (basics?.description) parts.push(`DESCRIPCIÓN: ${basics.description}`)

      if (ctx.web_summary) {
        parts.push(`SOBRE LA EMPRESA: ${ctx.web_summary}`)
        sources.push('web_scraping')
      }

      const customers = (ctx.key_customers || []) as NamedItem[]
      if (customers.length > 0) {
        const list = customers.slice(0, 10)
          .map(c => c.notes ? `${c.name} (${c.notes})` : c.name)
          .join(', ')
        parts.push(`CLIENTES CLAVE: ${list}`)
        sources.push('manual')
      }

      const products = (ctx.key_products || []) as NamedItem[]
      if (products.length > 0) {
        const list = products.slice(0, 10)
          .map(p => p.notes ? `${p.name} (${p.notes})` : p.name)
          .join(', ')
        parts.push(`PRODUCTOS CLAVE: ${list}`)
      }

      const suppliers = (ctx.key_suppliers || []) as NamedItem[]
      if (suppliers.length > 0) {
        const list = suppliers.slice(0, 10)
          .map(s => s.notes ? `${s.name} (${s.notes})` : s.name)
          .join(', ')
        parts.push(`PROVEEDORES CLAVE: ${list}`)
      }

      const rules = (ctx.business_rules || []) as string[]
      if (rules.length > 0) {
        parts.push(`REGLAS: ${rules.slice(0, 5).join('. ')}`)
      }

      if (ctx.tone_of_voice) {
        parts.push(`TONO: ${ctx.tone_of_voice}`)
      }
    }

    // LINKED DOCUMENTS (always, even with briefing)
    const linkedDocs = (ctx.linked_documents || []) as string[]
    if (linkedDocs.length > 0) {
      const { data: docs } = await db
        .from('documents')
        .select('title, content')
        .in('id', linkedDocs)
        .eq('tenant_id', tenantId)

      if (docs && docs.length > 0) {
        const docsText = docs
          .map(d => d.content || '')
          .join(' ')
          .slice(0, 2000)
        parts.push(`INFO ADICIONAL: ${docsText}`)
        sources.push('documents')
      }
    }
  }

  const context = parts.join('\n')
  const tokenEstimate = Math.ceil(context.length / 4)

  return { context, tokenEstimate, sources }
}

/**
 * Versión light: solo retorna el string para inyección directa.
 */
export async function getCompanyContextString(tenantId: string): Promise<string> {
  const { context } = await getCompanyContext(tenantId)
  return context
}
