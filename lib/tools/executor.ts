import { tavilySearchTool } from './tavily'
import { webInvestigatorTool } from './firecrawl'

/**
 * Get tools for an agent based on its configured tool list.
 * 
 * Note: Odoo tools are handled separately using the native Google SDK wrapper
 * due to compatibility issues with the Vercel AI SDK's Zod-to-Gemini conversion.
 * See lib/tools/odoo/wrapper.ts for Odoo tool implementation.
 */
export async function getToolsForAgent(tenantId: string, agentTools: string[]) {
    const tools: Record<string, any> = {}

    // 1. Tavily - Navegador Web
    if (agentTools.includes('web_search') || agentTools.includes('tavily')) {
        tools.web_search = tavilySearchTool
    }

    // 2. Firecrawl - Investigador Web
    if (agentTools.includes('firecrawl') || agentTools.includes('web_investigator')) {
        tools.web_investigator = webInvestigatorTool
    }

    // 3. Odoo Tools - Handled separately via native Google SDK wrapper
    // See app/api/chat/route.ts for Odoo-specific handling

    return tools
}
