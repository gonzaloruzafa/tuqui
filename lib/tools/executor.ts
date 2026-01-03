import { tavilySearchTool } from './tavily'
import { webInvestigatorTool } from './firecrawl'
import { webScraperTool } from './web-scraper'
import { ecommerceSearchTool } from './ecommerce'

/**
 * Get tools for an agent based on its configured tool list.
 * 
 * Tool Categories:
 * - web_search / tavily: Búsqueda web general
 * - web_scraper: Scraping genérico de páginas (artículos, docs)
 * - ecommerce_search: Búsqueda de productos con precios (MeLi, Amazon)
 * - web_investigator: Legacy - usar web_scraper o ecommerce_search
 * 
 * Note: Odoo tools are handled separately using the native Google SDK wrapper
 * due to compatibility issues with the Vercel AI SDK's Zod-to-Gemini conversion.
 * See lib/tools/odoo/wrapper.ts for Odoo tool implementation.
 */
export async function getToolsForAgent(tenantId: string, agentTools: string[]) {
    const tools: Record<string, any> = {}

    // 1. Tavily - Búsqueda Web General
    if (agentTools.includes('web_search') || agentTools.includes('tavily')) {
        tools.web_search = tavilySearchTool
    }

    // 2. Web Scraper - Scraping genérico (artículos, docs)
    if (agentTools.includes('web_scraper')) {
        tools.web_scraper = webScraperTool
    }

    // 3. Ecommerce Search - Productos con precios (MeLi, Amazon)
    if (agentTools.includes('ecommerce_search') || agentTools.includes('mercadolibre')) {
        tools.ecommerce_search = ecommerceSearchTool
    }

    // 4. Firecrawl - Legacy Investigador Web (backward compatibility)
    if (agentTools.includes('firecrawl') || agentTools.includes('web_investigator')) {
        tools.web_investigator = webInvestigatorTool
    }

    // 5. Odoo Tools - Handled separately via native Google SDK wrapper
    // See app/api/chat/route.ts for Odoo-specific handling

    return tools
}
