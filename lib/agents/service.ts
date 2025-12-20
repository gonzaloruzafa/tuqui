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

export async function getAgentsForTenant(tenantId: string): Promise<Agent[]> {
    const db = await getTenantClient(tenantId)

    // 1. Get custom agents from DB
    const { data: dbAgents, error } = await db
        .from('agents')
        .select('*')
        .eq('is_active', true)

    if (error) throw error

    // 2. Map DB agents to Agent interface
    const customAgents: Agent[] = dbAgents.map((a: any) => ({
        ...a,
        features: [], // Load features if needed
        tools: [] // Load tools if needed
    }))

    // 3. For the MVP, we might want to return built-in agents as well 
    // IF they are not already in the DB (or merge them)
    // For now, let's assume built-in agents are conceptually "templates" 
    // that are instantiated in the DB, OR they are virtual.
    // Given the requirement "Agents out-of-the-box", typically these are available to everyone.

    // Let's treat BUILTIN_AGENTS as "virtual" agents always available unless disabled in DB
    // For this alpha, let's start simple: Return hardcoded builtins + DB agents.

    const builtinAgents: Agent[] = Object.entries(BUILTIN_AGENTS).map(([slug, config]) => ({
        id: slug, // Use slug as ID for builtins
        slug: slug,
        name: config.name,
        description: config.description,
        icon: config.icon,
        color: 'adhoc-violet', // Default color
        is_active: true,
        rag_enabled: config.ragEnabled,
        system_prompt: config.systemPrompt,
        welcome_message: `Hola, soy ${config.name}. ¿En qué puedo ayudarte?`,
        placeholder_text: 'Escribí tu consulta...',
        features: [],
        tools: [...(config.tools || [])]
    }))

    return [...builtinAgents, ...customAgents]
}

export async function getAgentBySlug(tenantId: string, slug: string): Promise<Agent | null> {
    const agents = await getAgentsForTenant(tenantId)
    return agents.find(a => a.slug === slug) || null
}
