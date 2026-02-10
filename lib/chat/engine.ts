import { getToolsForAgent } from '@/lib/tools/executor'
import { checkUsageLimit, trackUsage } from '@/lib/billing/tracker'
import { AgentWithMergedPrompt } from '@/lib/agents/service'
import { orchestrate } from '@/lib/agents/orchestrator'
import { buildSystemPrompt } from '@/lib/chat/build-system-prompt'
import { ResponseGuard } from '@/lib/validation/response-guard'
import type { ToolCallRecord as V2ToolCallRecord } from '@/lib/tools/llm-engine'
import type { ToolCallRecord as HistoryToolCallRecord } from '@/lib/supabase/chat-history'

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
    tool_calls?: HistoryToolCallRecord[]
}

export interface ChatEngineParams {
    tenantId: string
    userEmail: string
    /** Auth UUID — used for memory and other user-scoped tools */
    userId?: string
    agent: AgentWithMergedPrompt
    messages: ChatMessage[]
    channel: 'web' | 'whatsapp' | 'voice'
    /** Web uses streaming with thinking events; WhatsApp/voice get batch text */
    streaming?: boolean
    onThinkingStep?: (step: any) => void
    onThinkingSummary?: (summary: string) => void
}

export interface ChatEngineResponse {
    text: string
    toolCalls?: HistoryToolCallRecord[]
    usage?: { totalTokens: number; thinkingTokens?: number }
}

/**
 * Unified Chat Engine — single pipeline for web, WhatsApp, voice.
 * Uses Gemini V2 (thinking + retry + force-text) for all channels.
 */
export async function processChatRequest(params: ChatEngineParams): Promise<ChatEngineResponse> {
    const { tenantId, userEmail, userId, agent, messages, channel } = params
    const lastMessage = messages[messages.length - 1]
    const inputContent = lastMessage?.content || ''

    console.log(`[ChatEngine] Processing ${channel} request for tenant ${tenantId}, agent ${agent.slug}`)

    // 1. Billing Check
    const estimatedInputTokens = Math.ceil(inputContent.length / 3)
    await checkUsageLimit(tenantId, userEmail, estimatedInputTokens)

    // 2. Orchestrator — route to best agent
    const conversationHistory = messages.slice(0, -1).map(m => m.content)
    const { agent: selectedAgent, decision } = await orchestrate(tenantId, inputContent, conversationHistory)
    console.log(`[ChatEngine] Orchestrator: ${selectedAgent.slug} (${decision.confidence}) - ${decision.reason}`)

    // 3. Build system prompt (shared builder — company context + agent prompt + rules)
    const systemPrompt = await buildSystemPrompt({
        tenantId,
        agentSystemPrompt: agent.merged_system_prompt || agent.system_prompt || '',
        routedAgent: selectedAgent.slug !== agent.slug ? selectedAgent : undefined,
        routingDecision: decision,
        baseAgentSlug: agent.slug,
        channel
    })

    // 4. Load tools
    const effectiveTools = selectedAgent.tools.length > 0 ? selectedAgent.tools : (agent.tools || [])
    const agentToolConfig = {
        id: selectedAgent.id,
        tools: effectiveTools
    }
    const tools = await getToolsForAgent(tenantId, agentToolConfig, userEmail, userId)
    const hasTools = Object.keys(tools).length > 0
    console.log(`[ChatEngine] Tools loaded: ${Object.keys(tools).join(', ') || 'none'}`)

    // 5. Execute with Gemini V2 (thinking + retry + force-text fallback)
    const { generateTextWithThinking } = await import('@/lib/tools/llm-engine')
    const result = await generateTextWithThinking({
        model: 'gemini-3-flash-preview',
        system: systemPrompt,
        messages: messages as any,
        tools: hasTools ? tools : undefined,
        maxSteps: 10,
        thinkingLevel: channel === 'voice' ? 'low' : 'medium',
        includeThoughts: params.streaming === true,
        onThinkingStep: params.onThinkingStep,
        onThinkingSummary: params.onThinkingSummary
    })

    // 6. Validate response (detect hallucinations, low confidence)
    if (!result.text?.trim()) {
        console.error('[ChatEngine] Empty response from LLM engine')
        result.text = 'Perdón, no pude generar una respuesta. ¿Podés intentar de nuevo?'
    } else {
        const validation = ResponseGuard.validateResponse(result.text)
        if (!validation.valid) {
            console.warn(`[ChatEngine] Response validation warnings:`, validation.warnings)
            if (validation.score < 50) {
                console.error(`[ChatEngine] Low confidence response (score: ${validation.score})`)
            }
        }
    }

    // 7. Track usage
    try {
        await trackUsage(tenantId, userEmail, Math.ceil(result.usage.totalTokens))
    } catch (e) {
        console.error('[ChatEngine] Failed to track usage:', e)
    }

    if (result.usage.thinkingTokens) {
        console.log(`[ChatEngine] Thinking tokens: ${result.usage.thinkingTokens}`)
    }

    // Map V2 tool call records to history format
    const historyToolCalls: HistoryToolCallRecord[] | undefined = result.toolCalls.length > 0
        ? result.toolCalls.map(tc => ({ name: tc.toolName, args: tc.args, result_summary: JSON.stringify(tc.result)?.slice(0, 500) }))
        : undefined

    return {
        text: result.text,
        toolCalls: historyToolCalls,
        usage: { totalTokens: result.usage.totalTokens, thinkingTokens: result.usage.thinkingTokens }
    }
}
