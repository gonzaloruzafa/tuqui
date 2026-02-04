import { webSearchTool } from './web-search'
import { loadSkillsForAgent, hasOdooTools, shouldUseSkills } from '@/lib/skills/loader'
import { createRagTool } from './definitions/rag-tool'

/**
 * Agent configuration subset needed for tool loading
 */
export interface AgentToolConfig {
    id: string
    tools: string[]
    rag_enabled?: boolean  // Deprecated: use tools.includes('knowledge_base')
}

/**
 * Get tools for an agent based on its configured tool list.
 *
 * Tool Categories:
 * - web_search: Búsqueda web unificada (Tavily + Google Grounding)
 *   Handles: búsquedas generales, precios ecommerce, noticias, info actualizada
 * - knowledge_base: RAG tool - búsqueda en documentos cargados
 *   Activated when tools.includes('knowledge_base') OR agent.rag_enabled (legacy)
 * - odoo_*: Skills-based Odoo queries (NEW: atomic, typed, testable)
 *   Replaces the monolithic "odoo_intelligent_query" God Tool
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param agentOrTools - Agent config object OR array of tool slugs (backwards compatible)
 * @param userId - User ID (email) for audit trail
 * @returns Record of tools keyed by tool name
 */
export async function getToolsForAgent(
    tenantId: string,
    agentOrTools: AgentToolConfig | string[],
    userId?: string
) {
    // Backwards compatibility: accept array of tools (legacy) or agent config (new)
    const agent: AgentToolConfig = Array.isArray(agentOrTools)
        ? { id: 'legacy', tools: agentOrTools, rag_enabled: false }
        : agentOrTools
    
    const tools: Record<string, any> = {}
    const agentTools = agent.tools || []

    // Web Search Unificado - Tavily + Google Grounding
    if (agentTools.includes('web_search')) {
        tools.web_search = webSearchTool
    }

    // Knowledge Base (RAG) - On-demand document search
    // Activated by: tools.includes('knowledge_base') OR legacy rag_enabled flag
    const hasKnowledgeBase = agentTools.includes('knowledge_base') || agent.rag_enabled
    if (hasKnowledgeBase) {
        tools.search_knowledge_base = createRagTool(tenantId, agent.id)
        console.log('[Tools/Executor] Knowledge Base tool loaded for agent:', agent.id)
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
