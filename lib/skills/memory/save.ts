/**
 * save_memory - Save a note about an entity
 *
 * Stores a user note about a customer, product, supplier,
 * or general topic for future recall.
 */

import { z } from 'zod'
import { getClient } from '@/lib/supabase/client'

export const SaveMemoryInputSchema = z.object({
  entity_name: z.string().min(1).describe(
    'Name of the customer, product, or supplier'
  ),
  entity_type: z.enum(['customer', 'product', 'supplier', 'general']).default('general').describe(
    'Type of entity: customer, product, supplier, or general'
  ),
  content: z.string().min(1).max(500).describe(
    'The note to save (max 500 chars)'
  ),
})

export type SaveMemoryInput = z.infer<typeof SaveMemoryInputSchema>

export interface SaveMemoryOutput {
  saved: boolean
  message: string
}

export const saveMemoryDescription = `Guarda información relevante sobre un cliente, producto, proveedor o el propio usuario para futuras conversaciones.

USAR CUANDO:
- El usuario dice "recordá que...", "anotá que...", "tené en cuenta que..."
- El usuario revela su rol, área o responsabilidades ("soy el gerente de ventas")
- El usuario expresa preferencias ("me gusta ver datos en tabla", "no me mandes PDFs")
- El usuario menciona clientes o productos que le importan repetidamente
- El usuario comparte contexto de negocio relevante ("abrimos sucursal en Córdoba")
- El usuario corrige algo ("el período fiscal cierra en junio, no diciembre")
NO USAR: Para datos que ya están en Odoo/herramientas, preguntas casuales, o saludos.

PARÁMETROS:
- entity_name: Nombre del cliente/producto/proveedor, o '_preferencia' para preferencias del usuario
- entity_type: 'customer' | 'product' | 'supplier' | 'general'
- content: La nota a guardar (max 500 chars)
RETORNA: Confirmación`

export async function saveMemory(
  input: SaveMemoryInput,
  tenantId: string,
  userId: string
): Promise<SaveMemoryOutput> {
  const db = getClient()

  const { error } = await db.from('memories').insert({
    tenant_id: tenantId,
    created_by: userId,
    entity_name: input.entity_name,
    entity_type: input.entity_type || 'general',
    content: input.content.slice(0, 500),
  })

  if (error) {
    console.error('[Memory/Save] Error:', error)
    return { saved: false, message: 'Error al guardar la nota' }
  }

  return { saved: true, message: `Anotado sobre ${input.entity_name} ✅` }
}
