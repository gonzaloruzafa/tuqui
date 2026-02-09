import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getTenantClient } from '@/lib/supabase/client'

/**
 * GET /api/admin/agents/[id]
 * Get a specific agent by ID
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user || !session.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const tenantId = session.tenant?.id
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 })
        }

        const { id } = await params
        const db = await getTenantClient(tenantId)

        const { data: agent, error } = await db
            .from('agents')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .single()

        if (error || !agent) {
            return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })
        }

        return NextResponse.json({ agent })

    } catch (error: any) {
        console.error('[Admin Agents API] Error:', error)
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
    }
}

/**
 * PATCH /api/admin/agents/[id]
 * Update an agent's configuration
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user || !session.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const tenantId = session.tenant?.id
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 })
        }

        const { id } = await params
        const body = await request.json()

        console.log('[Admin Agents API] Updating agent:', id, 'with:', body)

        const db = await getTenantClient(tenantId)

        // Build update object with only provided fields
        const updateData: Record<string, any> = {
            updated_at: new Date().toISOString()
        }

        if (body.name !== undefined) updateData.name = body.name
        if (body.description !== undefined) updateData.description = body.description
        if (body.system_prompt !== undefined) updateData.system_prompt = body.system_prompt
        if (body.custom_instructions !== undefined) updateData.custom_instructions = body.custom_instructions
        if (body.is_active !== undefined) updateData.is_active = body.is_active
        if (body.tools !== undefined) updateData.tools = body.tools
        if (body.welcome_message !== undefined) updateData.welcome_message = body.welcome_message
        if (body.placeholder_text !== undefined) updateData.placeholder_text = body.placeholder_text

        const { data: agent, error } = await db
            .from('agents')
            .update(updateData)
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('[Admin Agents API] Error updating agent:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log('[Admin Agents API] Updated agent:', agent.id, 'tools:', agent.tools)

        return NextResponse.json({ agent })

    } catch (error: any) {
        console.error('[Admin Agents API] Error:', error)
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
    }
}

/**
 * DELETE /api/admin/agents/[id]
 * Delete a custom agent (cannot delete master-synced agents)
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user || !session.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const tenantId = session.tenant?.id
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 })
        }

        const { id } = await params
        const db = await getTenantClient(tenantId)

        // Check if it's a master-synced agent
        const { data: agent } = await db
            .from('agents')
            .select('master_agent_id, name')
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .single()

        if (agent?.master_agent_id) {
            return NextResponse.json({ 
                error: 'No se puede eliminar un agente del sistema. Solo se pueden desactivar.' 
            }, { status: 400 })
        }

        const { error } = await db
            .from('agents')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('id', id)

        if (error) {
            console.error('[Admin Agents API] Error deleting agent:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log('[Admin Agents API] Deleted agent:', id)

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('[Admin Agents API] Error:', error)
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
    }
}
