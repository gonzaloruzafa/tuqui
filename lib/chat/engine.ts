import { getClient } from '@/lib/supabase/client'
// RAG search moved to tool - see lib/tools/definitions/rag-tool.ts
import { getToolsForAgent } from '@/lib/tools/executor'
import { checkUsageLimit, trackUsage } from '@/lib/billing/tracker'
// God Tool removed - now using atomic Skills architecture
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { Agent } from '@/lib/agents/service'
// OLD: import { routeMessage, buildCombinedPrompt } from '@/lib/agents/router'
import { orchestrate, type AvailableAgent } from '@/lib/agents/orchestrator'
import { ToolCallRecord } from '@/lib/supabase/chat-history'

const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY
})

/**
 * Format tool result into a detailed summary for history persistence.
 * This ensures the LLM has access to REAL data in subsequent turns.
 */
function formatToolResultSummary(toolResult: any): string {
    const parts: string[] = []
    
    // Include grouped data (most important for preventing hallucination)
    if (toolResult.grouped && Object.keys(toolResult.grouped).length > 0) {
        const entries = Object.entries(toolResult.grouped)
            .sort((a: any, b: any) => (b[1].total || 0) - (a[1].total || 0))
            .slice(0, 15) // Top 15 to keep context reasonable
        
        const dataLines = entries.map(([name, data]: [string, any]) => 
            `${name}: $${Math.round(data.total || 0).toLocaleString('es-AR')}`
        )
        parts.push(`DATOS: ${dataLines.join(' | ')}`)
    }
    
    // Include totals
    if (toolResult.total) {
        parts.push(`TOTAL: $${Math.round(toolResult.total).toLocaleString('es-AR')}`)
    }
    
    if (toolResult.count) {
        parts.push(`(${toolResult.count} registros)`)
    }
    
    return parts.join(' - ') || 'sin datos'
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
    tool_calls?: ToolCallRecord[]  // Tool calls for context persistence
}

export interface ChatEngineParams {
    tenantId: string
    userEmail: string
    agent: Agent
    messages: ChatMessage[]
    channel: 'web' | 'whatsapp'
}

export interface ChatEngineResponse {
    text: string
    toolCalls?: ToolCallRecord[]  // Tool calls from this response
    usage?: {
        totalTokens: number
    }
}

async function getCompanyContext(tenantId: string): Promise<string | null> {
    try {
        const db = getClient()
        const { data, error } = await db
            .from('tenants')
            .select('company_context')
            .eq('id', tenantId)
            .single()

        if (error || !data?.company_context) return null
        return data.company_context
    } catch (e) {
        console.error('[ChatEngine] Error fetching company context:', e)
        return null
    }
}

/**
 * Unified Chat Engine
 * Process a chat request from any channel (Web, WhatsApp, etc.)
 */
export async function processChatRequest(params: ChatEngineParams): Promise<ChatEngineResponse> {
    const { tenantId, userEmail, agent, messages, channel } = params
    const lastMessage = messages[messages.length - 1]
    const inputContent = lastMessage?.content || ''

    console.log(`[ChatEngine] Processing ${channel} request for tenant ${tenantId}, agent ${agent.slug}`)

    try {
        // 1. Billing Check
        const estimatedInputTokens = Math.ceil(inputContent.length / 3)
        await checkUsageLimit(tenantId, userEmail, estimatedInputTokens)

        // 2. Route to best agent using LLM Orchestrator
        const conversationHistory = messages.slice(0, -1).map(m => m.content)
        const { agent: selectedAgent, decision } = await orchestrate(tenantId, inputContent, conversationHistory)
        
        console.log(`[ChatEngine] Orchestrator: ${selectedAgent.slug} (${decision.confidence}) - ${decision.reason}`)

        // Use selected agent's config
        const effectiveAgent = {
            ...agent,
            id: selectedAgent.id,
            slug: selectedAgent.slug,
            tools: selectedAgent.tools.length > 0 ? selectedAgent.tools : agent.tools,
            rag_enabled: selectedAgent.rag_enabled || agent.rag_enabled
        }

        // 3. Build System Prompt & Context
        let systemPrompt = agent.system_prompt || 'Sos un asistente útil.'

        // Inject current date for temporal context (usando DateService)
        const { DateService } = await import('@/lib/date/service')
        const currentDate = DateService.formatted()
        systemPrompt = systemPrompt.replace('{{CURRENT_DATE}}', currentDate)
        
        // Fetch and use selected agent's system prompt if available
        if (selectedAgent.slug !== agent.slug && decision.confidence !== 'low') {
            const db = await getClient()
            const { data: agentData } = await db
                .from('agents')
                .select('system_prompt')
                .eq('id', selectedAgent.id)
                .single()
            
            if (agentData?.system_prompt) {
                systemPrompt = `${systemPrompt}\n\n--- ESPECIALIDAD: ${selectedAgent.name} ---\n${agentData.system_prompt}`
            }
        }

        const companyContext = await getCompanyContext(tenantId)

        if (companyContext) {
            systemPrompt += `\n\nCONTEXTO DE LA EMPRESA:\n${companyContext}`
        }

        if (channel === 'whatsapp') {
            systemPrompt += '\n\nREGLA PARA WHATSAPP: Sé conciso. Formato Markdown simple (negritas, listas). Máximo 1500 caracteres por mensaje.'
            systemPrompt += '\n\nIMPORTANTE: Estás en una conversación fluida. Usa siempre los mensajes anteriores para entender referencias como "él", "eso", "ahora", "Al reporte", "Diciembre 2025" o "qué productos?". No pidas aclaraciones si el contexto ya está en el historial.'
        }

        // Add professional tool usage messaging + efficiency rules
        systemPrompt += '\n\nEFICIENCIA Y VELOCIDAD:\n' +
            '- Ejecutá las consultas directamente, no pidas confirmación innecesaria\n' +
            '- Si el usuario pregunta por "ventas", usá el período actual (este mes) como default\n' +
            '- Si no especifica detalles, usá defaults razonables y mostrá los datos\n' +
            '- Solo pedí clarificación cuando sea REALMENTE ambiguo o falte info crítica\n' +
            '- Preferí dar una respuesta útil rápida que una pregunta de vuelta'
        
        systemPrompt += '\n\nCUANDO USES HERRAMIENTAS: Comunicate profesionalmente. NO digas cosas como "🔍 Consultando: sale.report...". Sé directo:\n' +
            '- Respondé directamente con los datos\n' +
            '- Si necesitás un momento, decí algo breve como "Consultando..."\n' +
            'NUNCA menciones nombres técnicos de modelos, tablas o funciones.'

        // 4. RAG Context - NOW HANDLED BY TOOL
        // The LLM calls search_knowledge_base when needed (saves tokens)
        // See lib/tools/definitions/rag-tool.ts
        // 
        // OLD CODE (automatic injection):
        // if (effectiveAgent.rag_enabled) {
        //     try {
        //         const agentId = routingResult.selectedAgent?.id || agent.id
        //         const docs = await searchDocuments(tenantId, agentId, inputContent)
        //         if (docs.length > 0) {
        //             systemPrompt += `\n\nCONTEXTO RELEVANTE:\n${docs.map(d => `- ${d.content}`).join('\n')}`
        //         }
        //     } catch (ragError) {
        //         console.error('[ChatEngine] RAG search failed:', ragError)
        //     }
        // }

        // 5. Execution Path (unified with Skills architecture)
        let responseText = ''
        let totalTokens = 0
        let responseToolCalls: ToolCallRecord[] = []

        console.log('[ChatEngine] Loading tools (including Skills if Odoo enabled)')
        const agentToolConfig = {
            id: selectedAgent.id,
            tools: effectiveAgent.tools || [],
            rag_enabled: effectiveAgent.rag_enabled
        }
        const tools = await getToolsForAgent(tenantId, agentToolConfig, userEmail)
        const hasTools = Object.keys(tools).length > 0

        if (hasTools) {
            const { generateTextNative } = await import('@/lib/tools/native-gemini')
            const result = await generateTextNative({
                system: systemPrompt,
                messages: messages as any,
                tools: tools as any,
                maxSteps: 5
            })
            responseText = result.text
            totalTokens = result.usage.totalTokens || 0
        } else {
            // No tools - use AI SDK (simpler, works fine without tools)
            const result = await generateText({
                model: google('gemini-2.0-flash'),
                system: systemPrompt,
                messages: messages as any
            } as any)
            responseText = result.text
            totalTokens = result.usage.totalTokens || 0
        }

        // 6. Track Usage
        try {
            await trackUsage(tenantId, userEmail, Math.ceil(totalTokens))
        } catch (e) {
            console.error('[ChatEngine] Failed to track usage:', e)
        }

        return {
            text: responseText,
            toolCalls: responseToolCalls.length > 0 ? responseToolCalls : undefined,
            usage: { totalTokens: Math.ceil(totalTokens) }
        }

    } catch (error: any) {
        console.error('[ChatEngine] Execution error:', error)
        throw error
    }
}
