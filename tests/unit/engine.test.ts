/**
 * Unit Tests for Unified Chat Engine
 * 
 * Verifies that processChatRequest:
 * 1. Uses buildSystemPrompt (shared prompt builder)
 * 2. Calls orchestrator for routing
 * 3. Uses Gemini V2 (not V1) for all channels
 * 4. Validates responses with ResponseGuard
 * 5. Tracks usage
 * 6. Passes correct thinking config per channel
 * 7. Maps tool calls to history format
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock all dependencies
vi.mock('@/lib/billing/tracker', () => ({
    checkUsageLimit: vi.fn(),
    trackUsage: vi.fn()
}))

vi.mock('@/lib/agents/orchestrator', () => ({
    orchestrate: vi.fn()
}))

vi.mock('@/lib/chat/build-system-prompt', () => ({
    buildSystemPrompt: vi.fn()
}))

vi.mock('@/lib/tools/executor', () => ({
    getToolsForAgent: vi.fn()
}))

vi.mock('@/lib/tools/llm-engine', () => ({
    generateTextWithThinking: vi.fn()
}))

vi.mock('@/lib/validation/response-guard', () => ({
    ResponseGuard: {
        validateResponse: vi.fn().mockReturnValue({ valid: true, score: 95, warnings: [] })
    }
}))

const { processChatRequest } = await import('@/lib/chat/engine')
const { orchestrate } = await import('@/lib/agents/orchestrator')
const { buildSystemPrompt } = await import('@/lib/chat/build-system-prompt')
const { getToolsForAgent } = await import('@/lib/tools/executor')
const { generateTextWithThinking } = await import('@/lib/tools/llm-engine')
const { checkUsageLimit, trackUsage } = await import('@/lib/billing/tracker')
const { ResponseGuard } = await import('@/lib/validation/response-guard')

const mockedOrchestrate = vi.mocked(orchestrate)
const mockedBuildPrompt = vi.mocked(buildSystemPrompt)
const mockedGetTools = vi.mocked(getToolsForAgent)
const mockedGenerate = vi.mocked(generateTextWithThinking)
const mockedCheckUsage = vi.mocked(checkUsageLimit)
const mockedTrackUsage = vi.mocked(trackUsage)
const mockedValidate = vi.mocked(ResponseGuard.validateResponse)

const baseAgent = {
    id: 'agent-1',
    slug: 'tuqui',
    name: 'Tuqui',
    description: 'Asistente general',
    icon: '🤖',
    color: '#000',
    is_active: true,
    rag_enabled: false,
    system_prompt: 'Sos Tuqui.',
    merged_system_prompt: 'Sos Tuqui. INSTRUCCIONES: Sé amable.',
    welcome_message: null,
    placeholder_text: null,
    tools: ['odoo']
}

const baseMessages = [{ role: 'user' as const, content: '¿Cuánto vendimos?' }]

describe('processChatRequest (Unified Engine)', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Default mocks
        mockedOrchestrate.mockResolvedValue({
            agent: { id: 'agent-1', slug: 'tuqui', name: 'Tuqui', description: null, tools: ['odoo'], rag_enabled: false },
            decision: { agentSlug: 'tuqui', confidence: 'high', reason: 'general' }
        })
        mockedBuildPrompt.mockResolvedValue('SYSTEM PROMPT BUILT')
        mockedGetTools.mockResolvedValue({ get_sales_total: { description: 'ventas', execute: vi.fn() } } as any)
        mockedGenerate.mockResolvedValue({
            text: 'Las ventas del mes son $1.500.000',
            usage: { totalTokens: 500, thinkingTokens: 100 },
            toolCalls: []
        })
    })

    test('calls billing check before processing', async () => {
        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages, channel: 'web'
        })

        expect(mockedCheckUsage).toHaveBeenCalledWith('tenant-1', 'user@test.com', expect.any(Number))
    })

    test('calls orchestrator with conversation history', async () => {
        const messages = [
            { role: 'user' as const, content: 'Hola' },
            { role: 'assistant' as const, content: 'Hola!' },
            { role: 'user' as const, content: '¿Cuánto vendimos?' }
        ]

        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages, channel: 'web'
        })

        expect(mockedOrchestrate).toHaveBeenCalledWith(
            'tenant-1',
            '¿Cuánto vendimos?',
            ['Hola', 'Hola!']
        )
    })

    test('uses buildSystemPrompt with merged_system_prompt', async () => {
        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages, channel: 'whatsapp'
        })

        expect(mockedBuildPrompt).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1',
            agentSystemPrompt: 'Sos Tuqui. INSTRUCCIONES: Sé amable.',
            channel: 'whatsapp',
            baseAgentSlug: 'tuqui'
        }))
    })

    test('falls back to system_prompt when no merged_system_prompt', async () => {
        const agentNoMerged = { ...baseAgent, merged_system_prompt: '' }

        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: agentNoMerged as any, messages: baseMessages, channel: 'web'
        })

        expect(mockedBuildPrompt).toHaveBeenCalledWith(expect.objectContaining({
            agentSystemPrompt: 'Sos Tuqui.'
        }))
    })

    test('uses Gemini V2 (generateTextWithThinking) for all channels', async () => {
        for (const channel of ['web', 'whatsapp', 'voice'] as const) {
            vi.clearAllMocks()
            mockedOrchestrate.mockResolvedValue({
                agent: { id: 'a1', slug: 'tuqui', name: 'Tuqui', description: null, tools: ['odoo'], rag_enabled: false },
                decision: { agentSlug: 'tuqui', confidence: 'high', reason: 'test' }
            })
            mockedBuildPrompt.mockResolvedValue('PROMPT')
            mockedGetTools.mockResolvedValue({} as any)
            mockedGenerate.mockResolvedValue({
                text: 'response', usage: { totalTokens: 100 }, toolCalls: []
            })

            await processChatRequest({
                tenantId: 'tenant-1', userEmail: 'user@test.com',
                agent: baseAgent as any, messages: baseMessages, channel
            })

            expect(mockedGenerate).toHaveBeenCalled()
        }
    })

    test('voice channel uses low thinking level', async () => {
        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages, channel: 'voice'
        })

        expect(mockedGenerate).toHaveBeenCalledWith(expect.objectContaining({
            thinkingLevel: 'low'
        }))
    })

    test('web/whatsapp channels use medium thinking level', async () => {
        for (const channel of ['web', 'whatsapp'] as const) {
            vi.clearAllMocks()
            mockedOrchestrate.mockResolvedValue({
                agent: { id: 'a1', slug: 'tuqui', name: 'Tuqui', description: null, tools: ['odoo'], rag_enabled: false },
                decision: { agentSlug: 'tuqui', confidence: 'high', reason: 'test' }
            })
            mockedBuildPrompt.mockResolvedValue('PROMPT')
            mockedGetTools.mockResolvedValue({} as any)
            mockedGenerate.mockResolvedValue({
                text: 'ok', usage: { totalTokens: 50 }, toolCalls: []
            })

            await processChatRequest({
                tenantId: 'tenant-1', userEmail: 'user@test.com',
                agent: baseAgent as any, messages: baseMessages, channel
            })

            expect(mockedGenerate).toHaveBeenCalledWith(expect.objectContaining({
                thinkingLevel: 'medium'
            }))
        }
    })

    test('streaming mode enables includeThoughts', async () => {
        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages,
            channel: 'web', streaming: true
        })

        expect(mockedGenerate).toHaveBeenCalledWith(expect.objectContaining({
            includeThoughts: true
        }))
    })

    test('non-streaming mode disables includeThoughts', async () => {
        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages,
            channel: 'whatsapp'
        })

        expect(mockedGenerate).toHaveBeenCalledWith(expect.objectContaining({
            includeThoughts: false
        }))
    })

    test('validates response with ResponseGuard', async () => {
        mockedGenerate.mockResolvedValue({
            text: 'Las ventas totales son $2.000.000',
            usage: { totalTokens: 300 },
            toolCalls: []
        })

        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages, channel: 'web'
        })

        expect(mockedValidate).toHaveBeenCalledWith('Las ventas totales son $2.000.000')
    })

    test('tracks usage after response', async () => {
        mockedGenerate.mockResolvedValue({
            text: 'ok', usage: { totalTokens: 750 }, toolCalls: []
        })

        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages, channel: 'web'
        })

        expect(mockedTrackUsage).toHaveBeenCalledWith('tenant-1', 'user@test.com', 750)
    })

    test('maps V2 tool calls to history format', async () => {
        mockedGenerate.mockResolvedValue({
            text: 'Ventas: $1M',
            usage: { totalTokens: 500 },
            toolCalls: [
                { toolName: 'get_sales_total', args: { period: 'this_month' }, result: { total: 1000000 }, durationMs: 200 },
                { toolName: 'get_top_products', args: { limit: 5 }, result: { items: [] }, durationMs: 150 }
            ]
        })

        const result = await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages, channel: 'web'
        })

        expect(result.toolCalls).toHaveLength(2)
        expect(result.toolCalls![0]).toEqual({
            name: 'get_sales_total',
            args: { period: 'this_month' },
            result_summary: expect.stringContaining('1000000')
        })
    })

    test('returns undefined toolCalls when no tools used', async () => {
        mockedGenerate.mockResolvedValue({
            text: 'Hola!', usage: { totalTokens: 50 }, toolCalls: []
        })

        const result = await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages, channel: 'web'
        })

        expect(result.toolCalls).toBeUndefined()
    })

    test('passes tools=undefined when no tools available', async () => {
        mockedGetTools.mockResolvedValue({} as any)

        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages, channel: 'web'
        })

        expect(mockedGenerate).toHaveBeenCalledWith(expect.objectContaining({
            tools: undefined
        }))
    })

    test('passes maxSteps: 10 always', async () => {
        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages, channel: 'web'
        })

        expect(mockedGenerate).toHaveBeenCalledWith(expect.objectContaining({
            maxSteps: 10
        }))
    })

    test('uses gemini-3-flash-preview model', async () => {
        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages, channel: 'web'
        })

        expect(mockedGenerate).toHaveBeenCalledWith(expect.objectContaining({
            model: 'gemini-3-flash-preview'
        }))
    })

    test('passes thinking callbacks for streaming mode', async () => {
        const onStep = vi.fn()
        const onSummary = vi.fn()

        await processChatRequest({
            tenantId: 'tenant-1', userEmail: 'user@test.com',
            agent: baseAgent as any, messages: baseMessages,
            channel: 'web', streaming: true,
            onThinkingStep: onStep, onThinkingSummary: onSummary
        })

        expect(mockedGenerate).toHaveBeenCalledWith(expect.objectContaining({
            onThinkingStep: onStep,
            onThinkingSummary: onSummary
        }))
    })
})
