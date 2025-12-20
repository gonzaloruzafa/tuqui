import { auth } from '@/lib/auth/config'
import { getAgentBySlug, getAgentsForTenant } from '@/lib/agents/service'

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user || !session.tenant) {
        return new Response('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')
    const tenantId = session.tenant.id

    if (slug) {
        const agent = await getAgentBySlug(tenantId, slug)
        if (!agent) return new Response('Agent not found', { status: 404 })
        return Response.json(agent)
    }

    const agents = await getAgentsForTenant(tenantId)
    return Response.json(agents)
}
