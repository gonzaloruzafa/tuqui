import { getClient } from '@/lib/supabase/client';
import { z } from 'zod';

/**
 * Tool: get_relevant_memory
 *
 * Allows the LLM to retrieve past notes and insights about specific business entities.
 */
export const memoryTool = {
  name: 'get_relevant_memory',
  description: `Busca notas y contexto de conversaciones anteriores sobre una entidad (cliente, producto o proveedor).

USAR CUANDO: El usuario menciona un cliente, producto o proveedor específico
y querés saber si hay notas previas relevantes o comportamientos históricos.

NO USAR: Para obtener datos transaccionales del ERP (ventas, stock, deuda).

PARÁMETROS:
- entity_name: Nombre del cliente, producto o proveedor a buscar.`,

  parameters: z.object({
    entity_name: z.string().describe('Nombre de la entidad a buscar'),
  }),

  execute: async ({ entity_name }: { entity_name: string }, context: { tenantId: string }) => {
    console.log(`[MemoryTool] Searching for: ${entity_name} in tenant ${context.tenantId}`);

    const db = getClient();
    const { data, error } = await db
      .from('conversation_insights')
      .select('entity_type, entity_name, insight, created_at')
      .eq('tenant_id', context.tenantId)
      .ilike('entity_name', `%${entity_name}%`)
      .order('use_count', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[MemoryTool] Error searching memory:', error);
      return { found: false, error: 'Error al buscar en la memoria' };
    }

    if (!data || data.length === 0) {
      return {
        found: false,
        message: `No hay notas previas registradas sobre "${entity_name}".`
      };
    }

    // Update use count asynchronously
    // In a real environment, we'd use a more robust way to do this
    // but for now we just log it.

    return {
      found: true,
      insights: data.map(d => ({
        type: d.entity_type,
        entity: d.entity_name,
        note: d.insight,
        date: d.created_at
      }))
    };
  }
};
