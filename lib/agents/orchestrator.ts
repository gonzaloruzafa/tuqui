/**
 * LLM Orchestrator - Lean Agent Routing
 * 
 * Reemplaza el router basado en keywords (~450 líneas) con un orchestrator
 * LLM que decide a qué agente delegar basándose en sus descripciones.
 * 
 * Filosofía: Descripciones ricas > prompts monstruosos
 * ~50 líneas vs ~450 líneas del router anterior
 */

import { getTenantClient } from '@/lib/supabase/client'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY
})

// ============================================
// TYPES
// ============================================

export interface AvailableAgent {
  id: string
  slug: string
  name: string
  description: string | null
  tools: string[]
}

export interface RoutingDecision {
  agentSlug: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

// ============================================
// FETCH AGENTS FROM DB
// ============================================

export async function getAvailableAgents(tenantId: string): Promise<AvailableAgent[]> {
  const db = await getTenantClient(tenantId)
  
  const { data: agents, error } = await db
    .from('agents')
    .select('id, slug, name, description, tools')
    .eq('is_active', true)
    .order('name')

  if (error || !agents) {
    console.error('[Orchestrator] Error fetching agents:', error)
    return []
  }

  return agents.map(a => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    description: a.description,
    tools: a.tools || []
  }))
}

// ============================================
// LLM ROUTING DECISION
// ============================================

const RoutingSchema = z.object({
  agentSlug: z.string().describe('Slug del agente seleccionado'),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string().describe('Razón breve de la selección')
})

export async function decideAgent(
  message: string,
  agents: AvailableAgent[],
  conversationContext?: string
): Promise<RoutingDecision> {
  // Fallback si solo hay un agente o ninguno
  if (agents.length === 0) {
    return { agentSlug: 'tuqui', confidence: 'low', reason: 'No hay agentes disponibles' }
  }
  if (agents.length === 1) {
    return { agentSlug: agents[0].slug, confidence: 'high', reason: 'Único agente disponible' }
  }

  // Construir lista de agentes para el prompt
  const agentList = agents.map(a => 
    `- **${a.slug}**: ${a.description || a.name}${a.tools.includes('knowledge_base') ? ' [tiene documentos internos]' : ''}`
  ).join('\n')

  const systemPrompt = `Sos un router de agentes. Analizá el mensaje y elegí el agente más apropiado.

AGENTES DISPONIBLES:
${agentList}

REGLAS:
- Elegí el agente cuya descripción mejor matchee la intención del usuario
- Si hay ambigüedad, preferí el agente más general (tuqui)
- confidence: high si es obvio, medium si hay duda, low si es fallback`

  try {
    const { object } = await generateObject({
      model: google('gemini-2.0-flash'),
      schema: RoutingSchema,
      system: systemPrompt,
      prompt: conversationContext 
        ? `Contexto previo: ${conversationContext}\n\nMensaje actual: ${message}`
        : message,
      temperature: 0.1, // Bajo para consistencia
    })

    // Validar que el agente existe
    const validAgent = agents.find(a => a.slug === object.agentSlug)
    if (!validAgent) {
      console.warn(`[Orchestrator] LLM returned invalid agent: ${object.agentSlug}`)
      return { agentSlug: 'tuqui', confidence: 'low', reason: 'Agente no encontrado, usando fallback' }
    }

    console.log(`[Orchestrator] Routing to ${object.agentSlug} (${object.confidence}): ${object.reason}`)
    return object
  } catch (error) {
    console.error('[Orchestrator] LLM routing failed:', error)
    return { agentSlug: 'tuqui', confidence: 'low', reason: 'Error en routing, usando fallback' }
  }
}

// ============================================
// MAIN ORCHESTRATION FUNCTION
// ============================================

export async function orchestrate(
  tenantId: string,
  message: string,
  conversationHistory: string[] = []
): Promise<{ agent: AvailableAgent; decision: RoutingDecision }> {
  // 1. Obtener agentes disponibles
  const agents = await getAvailableAgents(tenantId)
  
  // Fast path: skip LLM call if only 1 agent
  if (agents.length <= 1) {
    const agent = agents[0] || { id: '', slug: 'tuqui', name: 'Tuqui', description: null, tools: [], rag_enabled: false }
    return {
      agent,
      decision: { agentSlug: agent.slug, confidence: 'high', reason: 'Único agente activo' }
    }
  }

  // 2. Construir contexto de conversación (últimos 3 mensajes)
  const context = conversationHistory.slice(-3).join(' | ')
  
  // 3. Decidir agente
  const decision = await decideAgent(message, agents, context || undefined)
  
  // 4. Encontrar agente seleccionado
  const selectedAgent = agents.find(a => a.slug === decision.agentSlug) || agents[0]
  
  return { agent: selectedAgent, decision }
}
