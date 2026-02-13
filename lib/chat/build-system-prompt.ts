/**
 * buildSystemPrompt - Shared system prompt builder for all channels
 * 
 * Builds the complete system prompt with:
 * 1. Company context (FIRST — universal)
 * 2. Agent system prompt (merged with custom_instructions)
 * 3. Date injection
 * 4. Routed agent specialty (if orchestrator rerouted)
 * 5. Channel-specific rules (web, whatsapp, voice)
 * 6. Efficiency & tool usage rules
 * 7. Context persistence rule
 */

import { getCompanyContextString } from '@/lib/company/context-injector'
import { DateService } from '@/lib/date/service'
import type { AvailableAgent, RoutingDecision } from '@/lib/agents/orchestrator'

export interface BuildSystemPromptParams {
    tenantId: string
    /** merged_system_prompt || system_prompt from DB */
    agentSystemPrompt: string
    /** If orchestrator rerouted to a different agent */
    routedAgent?: { slug: string; name: string }
    routingDecision?: RoutingDecision
    /** Base agent slug (what the UI sent) */
    baseAgentSlug?: string
    channel: 'web' | 'whatsapp' | 'voice'
}

export async function buildSystemPrompt(params: BuildSystemPromptParams): Promise<string> {
    const { tenantId, agentSystemPrompt, routedAgent, routingDecision, baseAgentSlug, channel } = params

    const parts: string[] = []

    // 1. Company context goes FIRST (universal for all agents)
    const companyContext = await getCompanyContextString(tenantId)
    if (companyContext) {
        parts.push(`CONTEXTO DE LA EMPRESA:\n${companyContext}\nEl usuario que te habla es parte del equipo de esta empresa. Cuando dice "yo", "nosotros", "nuestro", se refiere a la empresa.\n---`)
    }

    // 2. Agent system prompt (already merged with custom_instructions)
    let prompt = agentSystemPrompt || 'Sos un asistente útil.'
    prompt = prompt.replace(/\{\{CURRENT_DATE\}\}/g, DateService.formatted())
    parts.push(prompt)

    // 3. Routed agent specialty
    if (routedAgent && baseAgentSlug && routedAgent.slug !== baseAgentSlug && routingDecision?.confidence !== 'low') {
        parts.push(`\n## 🎯 MODO ACTIVO: ${routedAgent.name}\nEspecialidad detectada por el sistema.`)
    }

    // 4. Channel-specific rules
    if (channel === 'whatsapp') {
        parts.push('REGLA PARA WHATSAPP: Sé conciso. Formato Markdown simple (negritas, listas). Máximo 1500 caracteres por mensaje.')
    } else if (channel === 'voice') {
        parts.push('REGLA PARA VOZ: Sé extremadamente conciso. Respuestas de máximo 2 oraciones, tipo telegrama elegante. No des rodeos ni explicaciones largas excepto que te lo pidan explícitamente.')
    }

    // 5. Efficiency rules (all channels)
    parts.push(
        'EFICIENCIA Y VELOCIDAD:\n' +
        '- Ejecutá las consultas directamente, no pidas confirmación innecesaria\n' +
        '- Si el usuario pregunta por "ventas", usá el período actual (este mes) como default\n' +
        '- Si no especifica detalles, usá defaults razonables y mostrá los datos\n' +
        '- Solo pedí clarificación cuando sea REALMENTE ambiguo o falte info crítica\n' +
        '- Preferí dar una respuesta útil rápida que una pregunta de vuelta'
    )

    // 6. Tool planning (all channels)
    parts.push(
        'PLANIFICACIÓN DE HERRAMIENTAS:\n' +
        '- Antes de ejecutar herramientas, pensá qué datos necesitás para responder\n' +
        '- Intentá resolver con la menor cantidad de llamadas posible\n' +
        '- Cuando tengas datos de distintas fuentes, sintetizá la respuesta vos — no sigas buscando\n' +
        '- Para comparaciones (ej: quién compra vs quién no), hacé consultas amplias y calculá la diferencia vos\n' +
        '- NUNCA busques datos uno por uno — usá consultas agrupadas'
    )

    // 7. Professional tool messaging (all channels)
    parts.push(
        'CUANDO USES HERRAMIENTAS: Comunicate profesionalmente. NO digas cosas como "🔍 Consultando: sale.report...". Sé directo:\n' +
        '- Respondé directamente con los datos\n' +
        '- Si necesitás un momento, decí algo breve como "Consultando..."\n' +
        'NUNCA menciones nombres técnicos de modelos, tablas o funciones.'
    )

    // 8. Context persistence (all channels)
    parts.push('IMPORTANTE: Estás en una conversación fluida. Usa siempre los mensajes anteriores para entender referencias como "él", "eso", "ahora", o "qué productos?". No pidas aclaraciones si el contexto ya está en el historial.')

    // 9. Anti-hallucination: data integrity (all channels)
    parts.push(
        'INTEGRIDAD DE DATOS (CRÍTICO):\n' +
        '- SOLO usá nombres, cifras y datos que vengan directamente del resultado de las herramientas\n' +
        '- Cada resultado de herramienta tiene un campo _context que te dice qué tipo de dato es (VENDEDORES, CLIENTES, PRODUCTOS, etc). Respetalo estrictamente\n' +
        '- NUNCA mezcles entidades de distintos dominios: un CLIENTE no es un VENDEDOR, un PROVEEDOR no es un CLIENTE\n' +
        '- NUNCA inventes nombres que no aparezcan EXACTAMENTE en los resultados de las herramientas\n' +
        '- Si no encontrás un dato, decí que no lo encontraste en vez de inventarlo\n' +
        '- Si necesitás cruzar datos de dos herramientas distintas, usá solamente los nombres exactos que aparecen en cada resultado'
    )

    return parts.join('\n\n')
}
