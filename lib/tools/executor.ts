import { webSearchTool } from './web-search'
import { loadSkillsForAgent, hasOdooTools, shouldUseSkills } from '@/lib/skills/loader'
import { createRagTool } from './definitions/rag-tool'
import { createMemoryTools } from '@/lib/skills/memory'

/**
 * Agent configuration subset needed for tool loading
 */
export interface AgentToolConfig {
    id: string
    tools: string[]
}

/**
 * Get tools for an agent based on its configured tool list.
 *
 * Tool Categories:
 * - web_search: Búsqueda web unificada (Tavily + Google Grounding)
 *   Handles: búsquedas generales, precios ecommerce, noticias, info actualizada
 * - knowledge_base: RAG tool - búsqueda en documentos cargados
 *   Activated when tools.includes('knowledge_base')
 * - odoo_*: Skills-based Odoo queries (NEW: atomic, typed, testable)
 *   Replaces the monolithic "odoo_intelligent_query" God Tool
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param agentOrTools - Agent config object OR array of tool slugs (backwards compatible)
 * @param userEmail - User email for audit trail / Odoo skills
 * @param userId - Auth UUID for user-scoped tools (memory)
 * @returns Record of tools keyed by tool name
 */
export async function getToolsForAgent(
    tenantId: string,
    agentOrTools: AgentToolConfig | string[],
    userEmail?: string,
    userId?: string
) {
    // Backwards compatibility: accept array of tools (legacy) or agent config (new)
    const agent: AgentToolConfig = Array.isArray(agentOrTools)
        ? { id: 'legacy', tools: agentOrTools }
        : agentOrTools
    
    if (agent.id === 'legacy') {
        console.warn('[Tools/Executor] ⚠️ DEPRECATED: getToolsForAgent called with string[] instead of AgentToolConfig. Pass { id, tools } instead.')
    }
    
    const tools: Record<string, any> = {}
    const agentTools = agent.tools || []

    // Web Search Unificado - Tavily + Google Grounding
    if (agentTools.includes('web_search')) {
        tools.web_search = webSearchTool
    }

    // Knowledge Base (RAG) - On-demand document search
    // Requires a valid agent UUID to scope the search
    const hasKnowledgeBase = agentTools.includes('knowledge_base')
    const hasValidAgentId = agent.id !== 'legacy' && agent.id !== 'test'
    if (hasKnowledgeBase && hasValidAgentId) {
        tools.search_knowledge_base = createRagTool(tenantId, agent.id)
        console.log('[Tools/Executor] Knowledge Base tool loaded for agent:', agent.id)
    } else if (hasKnowledgeBase && !hasValidAgentId) {
        console.warn('[Tools/Executor] Skipping RAG tool: agent.id is not a valid UUID:', agent.id)
    }

    // Memory - User-scoped notes (recall + save)
    if (agentTools.includes('memory') && userId) {
        const memoryTools = createMemoryTools(tenantId, userId)
        Object.assign(tools, memoryTools)
        console.log('[Tools/Executor] Memory tools loaded (recall_memory, save_memory)')
    }

    // Odoo Skills - New atomic skills architecture
    if (hasOdooTools(agentTools) && userEmail) {
        const useSkills = await shouldUseSkills(tenantId)

        if (useSkills) {
            console.log('[Tools/Executor] Loading Odoo Skills for tenant:', tenantId)
            try {
                const skillTools = await loadSkillsForAgent(tenantId, userEmail, agentTools)
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
