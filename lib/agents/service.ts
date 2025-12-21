import { getTenantClient } from '../supabase/tenant'
import { BUILTIN_AGENTS } from './registry'

export interface Agent {
    id: string
    slug: string
    name: string
    description: string | null
    icon: string
    color: string
    is_active: boolean
    rag_enabled: boolean
    system_prompt: string | null
    welcome_message: string | null
    placeholder_text: string | null
    features?: string[]
    tools?: string[]
}

/**
 * Get tools for an agent from agent_tools table
 */
async function getAgentTools(db: any, agentId: string): Promise<string[]> {
    const { data: toolRecords } = await db
        .from('agent_tools')
        .select('tool_slug')
        .eq('agent_id', agentId)
        .eq('enabled', true)

    return toolRecords?.map((t: any) => t.tool_slug) || []
}

/**
 * Ensure built-in agents exist in DB (auto-seed on first access)
 */
async function ensureBuiltinAgents(tenantId: string): Promise<void> {
    const db = await getTenantClient(tenantId)

    // Check if agents exist
    const { data: existingAgents } = await db
        .from('agents')
        .select('slug')

    const existingSlugs = new Set(existingAgents?.map(a => a.slug) || [])

    // Insert missing built-in agents
    const missingAgents = Object.entries(BUILTIN_AGENTS)
        .filter(([slug]) => !existingSlugs.has(slug))
        .map(([slug, config]) => ({
            slug,
            name: config.name,
            description: config.description,
            icon: config.icon,
            color: 'adhoc-violet',
            is_active: true,
            rag_enabled: config.ragEnabled,
            system_prompt: config.systemPrompt,
            welcome_message: `Hola, soy ${config.name}. ¿En qué puedo ayudarte?`,
            placeholder_text: 'Escribí tu consulta...'
        }))

    if (missingAgents.length > 0) {
        console.log(`[Agents] Auto-seeding ${missingAgents.length} built-in agents for tenant ${tenantId}`)
        const { data: insertedAgents, error } = await db
            .from('agents')
            .insert(missingAgents)
            .select('id, slug')

        if (error) {
            console.error('[Agents] Error seeding agents:', error)
            return
        }

        // Insert agent_tools for the seeded agents
        if (insertedAgents && insertedAgents.length > 0) {
            const toolsToInsert: { agent_id: string; tool_slug: string; enabled: boolean }[] = []

            for (const agent of insertedAgents) {
                const config = BUILTIN_AGENTS[agent.slug as keyof typeof BUILTIN_AGENTS]
                if (config?.tools && config.tools.length > 0) {
                    for (const toolSlug of config.tools) {
                        toolsToInsert.push({
                            agent_id: agent.id,
                            tool_slug: toolSlug,
                            enabled: true
                        })
                    }
                }
            }

            if (toolsToInsert.length > 0) {
                await db.from('agent_tools').insert(toolsToInsert)
            }
        }
    }
}

export async function getAgentsForTenant(tenantId: string): Promise<Agent[]> {
    const db = await getTenantClient(tenantId)

    // Ensure built-in agents are seeded
    await ensureBuiltinAgents(tenantId)

    // Get all active agents from DB
    const { data: dbAgents, error } = await db
        .from('agents')
        .select('*')
        .eq('is_active', true)
        .order('name')

    if (error) {
        console.error('[Agents] Error fetching agents:', error)
        throw error
    }

    // Map DB agents to Agent interface with their tools
    const agents: Agent[] = await Promise.all((dbAgents || []).map(async (a: any) => {
        const tools = await getAgentTools(db, a.id)
        return {
            id: a.id,
            slug: a.slug,
            name: a.name,
            description: a.description,
            icon: a.icon || 'Bot',
            color: a.color || 'adhoc-violet',
            is_active: a.is_active,
            rag_enabled: a.rag_enabled || false,
            system_prompt: a.system_prompt,
            welcome_message: a.welcome_message,
            placeholder_text: a.placeholder_text,
            features: [],
            tools
        }
    }))

    return agents
}

export async function getAgentBySlug(tenantId: string, slug: string): Promise<Agent | null> {
    const db = await getTenantClient(tenantId)

    // Ensure built-in agents are seeded
    await ensureBuiltinAgents(tenantId)

    // Get specific agent
    const { data: agent, error } = await db
        .from('agents')
        .select('*')
        .eq('slug', slug)
        .single()

    if (error || !agent) {
        console.error(`[Agents] Agent ${slug} not found`)
        return null
    }

    // Get tools for this agent
    const tools = await getAgentTools(db, agent.id)

    return {
        id: agent.id,
        slug: agent.slug,
        name: agent.name,
        description: agent.description,
        icon: agent.icon || 'Bot',
        color: agent.color || 'adhoc-violet',
        is_active: agent.is_active,
        rag_enabled: agent.rag_enabled || false,
        system_prompt: agent.system_prompt,
        welcome_message: agent.welcome_message,
        placeholder_text: agent.placeholder_text,
        features: [],
        tools
    }
}
