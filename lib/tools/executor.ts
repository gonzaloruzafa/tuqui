import { webSearchTool } from './web-search'
import { loadSkillsForAgent, hasOdooTools, shouldUseSkills } from '@/lib/skills/loader'

/**
 * Get tools for an agent based on its configured tool list.
 *
 * Tool Categories:
 * - web_search: Búsqueda web unificada (Tavily + Google Grounding)
 *   Handles: búsquedas generales, precios ecommerce, noticias, info actualizada
 * - odoo_*: Skills-based Odoo queries (NEW: atomic, typed, testable)
 *   Replaces the monolithic "odoo_intelligent_query" God Tool
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param agentTools - Array of tool slugs configured for the agent
 * @param userId - User ID (email) for audit trail
 * @returns Record of tools keyed by tool name
 */
export async function getToolsForAgent(
    tenantId: string,
    agentTools: string[],
    userId?: string
) {
    const tools: Record<string, any> = {}

    // Web Search Unificado - Tavily + Google Grounding
    if (agentTools.includes('web_search')) {
        tools.web_search = webSearchTool
    }

    // Odoo Skills - New atomic skills architecture
    if (hasOdooTools(agentTools) && userId) {
        const useSkills = await shouldUseSkills(tenantId)

        if (useSkills) {
            console.log('[Tools/Executor] Loading Odoo Skills for tenant:', tenantId)
            try {
                const skillTools = await loadSkillsForAgent(tenantId, userId, agentTools)
                Object.assign(tools, skillTools)
                console.log('[Tools/Executor] Loaded', Object.keys(skillTools).length, 'skills')
            } catch (error) {
                console.error('[Tools/Executor] Error loading skills:', error)
                // Fallback: Skills will not be available, God Tool will be used
            }
        } else {
            console.log('[Tools/Executor] Skills disabled for tenant, will use God Tool fallback')
        }
    }

    return tools
}
