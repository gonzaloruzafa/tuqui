import { getClient } from '@/lib/supabase/client';

export interface CompanyContextData {
  key_products?: { name: string; notes: string }[];
  key_customers?: { name: string; notes: string }[];
  key_suppliers?: { name: string; notes: string }[];
  business_rules?: string[];
}

/**
 * Fetches and formats structured company context for the LLM prompt.
 * Combines basic tenant info with structured insights.
 */
export async function getStructuredCompanyContext(tenantId: string): Promise<string | null> {
  const db = getClient();

  try {
    const [tenantRes, contextRes] = await Promise.all([
      db.from('tenants').select('name, industry').eq('id', tenantId).single(),
      db.from('company_contexts').select('*').eq('tenant_id', tenantId).single()
    ]);

    const tenant = tenantRes.data;
    const ctx = contextRes.data as CompanyContextData | null;

    if (!tenant && !ctx) return null;

    const parts: string[] = [];

    // Basic Info
    if (tenant?.name) parts.push(`Empresa: ${tenant.name}`);
    if (tenant?.industry) parts.push(`Rubro: ${tenant.industry}`);

    // Structured Context
    if (ctx?.key_customers?.length) {
      const customers = ctx.key_customers.map(c =>
        c.notes ? `${c.name} (${c.notes})` : c.name
      ).join(', ');
      parts.push(`Clientes clave: ${customers}`);
    }

    if (ctx?.key_products?.length) {
      const products = ctx.key_products.map(p =>
        p.notes ? `${p.name} (${p.notes})` : p.name
      ).join(', ');
      parts.push(`Productos principales: ${products}`);
    }

    if (ctx?.business_rules?.length) {
      parts.push(`Reglas de negocio:\n${ctx.business_rules.map(r => `- ${r}`).join('\n')}`);
    }

    if (parts.length === 0) return null;

    return `\n--- CONTEXTO ESTRATEGICO DE LA EMPRESA ---\n${parts.join('\n')}\n`;
  } catch (error) {
    console.error('[CompanyContext] Error fetching structured context:', error);
    return null;
  }
}
