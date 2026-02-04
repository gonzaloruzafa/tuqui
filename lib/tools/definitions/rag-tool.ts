/**
 * RAG Tool - Search Knowledge Base
 * 
 * Replaces automatic RAG injection with an on-demand tool.
 * The LLM decides when to search documents, saving tokens
 * when the query doesn't need knowledge base context.
 */

import { z } from 'zod'
import { searchDocuments, type SearchResult } from '@/lib/rag/search'

interface RagToolResult {
  found: boolean
  count: number
  documents: Array<{ content: string; relevance: string }>
  error?: string
}

const RagToolSchema = z.object({
  query: z.string().describe('Qué buscar en los documentos. Sé específico.')
})

type RagToolInput = z.infer<typeof RagToolSchema>

/**
 * Create a RAG tool for document search
 * Returns an AI SDK compatible tool object
 */
export function createRagTool(tenantId: string, agentId: string) {
  return {
    description: `Buscar en la base de conocimiento de la empresa.

USAR CUANDO el usuario pregunta sobre:
- Procesos internos, políticas, procedimientos
- Información de productos/servicios documentada
- Manuales, guías, instrucciones internas
- Cualquier cosa que mencione "según el documento", "manual", "procedimiento"

NO USAR PARA:
- Datos transaccionales (ventas, stock, facturas) → usar skills de Odoo
- Información que requiere cálculos en tiempo real
- Preguntas generales o conversacionales`,
    
    parameters: RagToolSchema,
    
    execute: async (input: RagToolInput): Promise<RagToolResult> => {
      const { query } = input
      console.log(`[RAG Tool] Searching for: "${query.substring(0, 50)}..."`)
      
      try {
        const docs = await searchDocuments(tenantId, agentId, query, 5)
        
        if (docs.length === 0) {
          console.log('[RAG Tool] No documents found')
          return {
            found: false,
            count: 0,
            documents: []
          }
        }
        
        console.log(`[RAG Tool] Found ${docs.length} documents`)
        return {
          found: true,
          count: docs.length,
          documents: docs.map((d: SearchResult) => ({
            content: d.content,
            relevance: `${Math.round(d.similarity * 100)}%`
          }))
        }
      } catch (error: any) {
        console.error('[RAG Tool] Error:', error.message)
        return { 
          found: false,
          count: 0,
          documents: [],
          error: 'Error al buscar en la base de conocimiento' 
        }
      }
    }
  }
}
