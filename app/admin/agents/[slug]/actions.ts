'use server'

import { auth } from '@/lib/auth/config'
import { getTenantClient } from '@/lib/supabase/client'
import { revalidatePath } from 'next/cache'

export async function deleteAgent(agentId: string) {
    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) {
        return { error: 'No autorizado' }
    }

    const tenantId = session.tenant.id
    const db = await getTenantClient(tenantId)

    // Verify agent exists and belongs to tenant
    const { data: agent } = await db
        .from('agents')
        .select('id, name, master_agent_id')
        .eq('tenant_id', tenantId)
        .eq('id', agentId)
        .single()

    if (!agent) {
        return { error: 'Agente no encontrado' }
    }

    // Don't allow deleting base agents (managed centrally)
    if (agent.master_agent_id) {
        return { error: 'No se pueden eliminar agentes base. Solo se pueden desactivar.' }
    }

    // Delete related data first
    await db.from('agent_documents').delete().eq('agent_id', agentId)
    await db.from('agent_tools').delete().eq('agent_id', agentId)

    // Delete the agent
    const { error } = await db
        .from('agents')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', agentId)

    if (error) {
        return { error: 'Error al eliminar el agente: ' + error.message }
    }

    revalidatePath('/admin/agents')
}
