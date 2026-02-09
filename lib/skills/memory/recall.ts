/**
 * recall_memory - Search saved notes about entities
 *
 * Searches the user's personal memory for notes about
 * customers, products, suppliers, or general topics.
 */

import { z } from 'zod'
import { getClient } from '@/lib/supabase/client'

export const RecallMemoryInputSchema = z.object({
  entity_name: z.string().min(1).describe(
    'Name or partial name to search for (e.g. "MegaCorp", "adhesivo")'
  ),
})

export type RecallMemoryInput = z.infer<typeof RecallMemoryInputSchema>

export interface RecallMemoryOutput {
  found: boolean
  notes?: Array<{
    entity_name: string | null
    entity_type: string | null
    content: string
    created_at: string
  }>
}

export const recallMemoryDescription = `Busca notas y contexto guardado sobre un cliente, producto o proveedor.

USAR CUANDO: El usuario menciona un cliente, producto o proveedor específico
y querés saber si hay notas o contexto previo guardado.
NO USAR: Para datos de Odoo (ventas, stock, deudas) — usá los skills de Odoo.

PARÁMETROS:
- entity_name: Nombre o parte del nombre a buscar (ej: "MegaCorp", "adhesivo")
RETORNA: Lista de notas guardadas con fecha`

export async function recallMemory(
  input: RecallMemoryInput,
  tenantId: string,
  userId: string
): Promise<RecallMemoryOutput> {
  const db = getClient()

  const { data, error } = await db
    .from('memories')
    .select('entity_name, entity_type, content, created_at')
    .eq('tenant_id', tenantId)
    .eq('created_by', userId)
    .ilike('entity_name', `%${input.entity_name}%`)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('[Memory/Recall] Error:', error)
    return { found: false }
  }

  if (!data?.length) return { found: false }

  return { found: true, notes: data }
}
