import { webSearchTool } from './web-search'

/**
 * Get tools for an agent based on its configured tool list.
 *
 * Tool Categories:
 * - web_search: Búsqueda web unificada (Tavily + Google Grounding)
 *   Handles: búsquedas generales, precios ecommerce, noticias, info actualizada
 *
 * Note: Odoo tools are handled separately using the native Google SDK wrapper
 * due to compatibility issues with the Vercel AI SDK's Zod-to-Gemini conversion.
 * See lib/tools/odoo/wrapper.ts for Odoo tool implementation.
 */
export async function getToolsForAgent(tenantId: string, agentTools: string[]) {
    const tools: Record<string, any> = {}

    // Web Search Unificado - Tavily + Google Grounding
    if (agentTools.includes('web_search')) {
        tools.web_search = webSearchTool
    }

    // Odoo Tools - Handled separately via native Google SDK wrapper
    // See app/api/chat/route.ts for Odoo-specific handling

    return tools
}
