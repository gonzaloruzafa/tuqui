/**
 * Get master documents inherited by a tenant agent
 * 
 * Flujo: tenant agent → master_agent_id → master_agent_documents → master_documents
 * El tenant no puede modificar estos docs, solo verlos.
 */

import { getClient, getTenantClient } from '@/lib/supabase/client'

export interface InheritedDocument {
  id: string
  title: string
  file_name: string | null
  source_type: string
  created_at: string
}

/**
 * Lista los documentos master que un agent del tenant hereda
 * Retorna [] si el agent no tiene master_agent_id o no hay docs
 */
export async function getInheritedDocuments(
  tenantId: string,
  agentId: string
): Promise<InheritedDocument[]> {
  // 1. Get the master_agent_id from tenant agent
  const tenantDb = await getTenantClient(tenantId)
  const { data: agent } = await tenantDb
    .from('agents')
    .select('master_agent_id')
    .eq('id', agentId)
    .eq('tenant_id', tenantId)
    .single()

  if (!agent?.master_agent_id) return []

  // 2. Query master docs via M2M (service role — no tenant context)
  const db = getClient()
  const { data, error } = await db
    .from('master_agent_documents')
    .select('master_documents(id, title, file_name, source_type, created_at)')
    .eq('master_agent_id', agent.master_agent_id)

  if (error) {
    console.error('[InheritedDocs] Error:', error)
    return []
  }

  return (data || []).map((row: any) => ({
    id: row.master_documents.id,
    title: row.master_documents.title,
    file_name: row.master_documents.file_name,
    source_type: row.master_documents.source_type,
    created_at: row.master_documents.created_at
  }))
}
