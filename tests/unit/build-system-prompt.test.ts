/**
 * Unit Tests for buildSystemPrompt
 * 
 * Verifies the shared system prompt builder produces correct prompts
 * for all channels (web, whatsapp, voice) with proper:
 * - Company context injection
 * - Date placeholder replacement
 * - Channel-specific rules
 * - Routing specialty append
 * - Efficiency + tool usage rules
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock company context
vi.mock('@/lib/company/context-injector', () => ({
    getCompanyContextString: vi.fn()
}))

// Mock DateService
vi.mock('@/lib/date/service', () => ({
    DateService: {
        formatted: () => 'lunes, 7 de febrero de 2026'
    }
}))

const { getCompanyContextString } = await import('@/lib/company/context-injector')
const { buildSystemPrompt } = await import('@/lib/chat/build-system-prompt')

const mockedGetContext = vi.mocked(getCompanyContextString)

describe('buildSystemPrompt', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockedGetContext.mockResolvedValue('')
    })

    test('includes agent system prompt', async () => {
        const result = await buildSystemPrompt({
            tenantId: 'test-tenant',
            agentSystemPrompt: 'Sos Tuqui, un asistente de Adhoc.',
            channel: 'web'
        })

        expect(result).toContain('Sos Tuqui, un asistente de Adhoc.')
    })

    test('falls back to default when empty prompt', async () => {
        const result = await buildSystemPrompt({
            tenantId: 'test-tenant',
            agentSystemPrompt: '',
            channel: 'web'
        })

        expect(result).toContain('Sos un asistente útil.')
    })

    test('injects company context FIRST', async () => {
        mockedGetContext.mockResolvedValue('EMPRESA: Adhoc SA\nRUBRO: Software')

        const result = await buildSystemPrompt({
            tenantId: 'test-tenant',
            agentSystemPrompt: 'Sos Tuqui.',
            channel: 'web'
        })

        const contextPos = result.indexOf('CONTEXTO DE LA EMPRESA')
        const promptPos = result.indexOf('Sos Tuqui.')
        expect(contextPos).toBeLessThan(promptPos)
        expect(result).toContain('EMPRESA: Adhoc SA')
    })

    test('skips company context when empty', async () => {
        mockedGetContext.mockResolvedValue('')

        const result = await buildSystemPrompt({
            tenantId: 'test-tenant',
            agentSystemPrompt: 'Sos Tuqui.',
            channel: 'web'
        })

        expect(result).not.toContain('CONTEXTO DE LA EMPRESA')
    })

    test('replaces {{CURRENT_DATE}} placeholder', async () => {
        const result = await buildSystemPrompt({
            tenantId: 'test-tenant',
            agentSystemPrompt: 'Hoy es {{CURRENT_DATE}}.',
            channel: 'web'
        })

        expect(result).toContain('Hoy es lunes, 7 de febrero de 2026.')
        expect(result).not.toContain('{{CURRENT_DATE}}')
    })

    // Channel-specific rules
    const channelCases = [
        { channel: 'whatsapp' as const, expected: 'REGLA PARA WHATSAPP', notExpected: 'REGLA PARA VOZ' },
        { channel: 'voice' as const, expected: 'REGLA PARA VOZ', notExpected: 'REGLA PARA WHATSAPP' },
        { channel: 'web' as const, expected: null, notExpected: 'REGLA PARA WHATSAPP' },
    ]

    test.each(channelCases)('$channel channel includes correct rules', async ({ channel, expected, notExpected }) => {
        const result = await buildSystemPrompt({
            tenantId: 'test-tenant',
            agentSystemPrompt: 'Sos Tuqui.',
            channel
        })

        if (expected) expect(result).toContain(expected)
        expect(result).not.toContain(notExpected)
    })

    test('web channel has no channel-specific rule', async () => {
        const result = await buildSystemPrompt({
            tenantId: 'test-tenant',
            agentSystemPrompt: 'Sos Tuqui.',
            channel: 'web'
        })

        expect(result).not.toContain('REGLA PARA VOZ')
        expect(result).not.toContain('REGLA PARA WHATSAPP')
    })

    // All channels get these universal rules
    const universalRules = [
        'EFICIENCIA Y VELOCIDAD',
        'CUANDO USES HERRAMIENTAS',
        'conversación fluida',
        'No pidas aclaraciones si el contexto ya está en el historial'
    ]

    test.each(universalRules)('all channels include: %s', async (rule) => {
        for (const channel of ['web', 'whatsapp', 'voice'] as const) {
            const result = await buildSystemPrompt({
                tenantId: 'test-tenant',
                agentSystemPrompt: 'Sos Tuqui.',
                channel
            })
            expect(result).toContain(rule)
        }
    })

    test('adds routing specialty when routed to different agent', async () => {
        const result = await buildSystemPrompt({
            tenantId: 'test-tenant',
            agentSystemPrompt: 'Sos Tuqui.',
            routedAgent: { slug: 'odoo', name: 'Odoo Expert' },
            routingDecision: { agentSlug: 'odoo', confidence: 'high', reason: 'ventas' },
            baseAgentSlug: 'tuqui',
            channel: 'web'
        })

        expect(result).toContain('MODO ACTIVO: Odoo Expert')
    })

    test('skips routing specialty when same agent', async () => {
        const result = await buildSystemPrompt({
            tenantId: 'test-tenant',
            agentSystemPrompt: 'Sos Tuqui.',
            routedAgent: { slug: 'tuqui', name: 'Tuqui' },
            routingDecision: { agentSlug: 'tuqui', confidence: 'high', reason: 'general' },
            baseAgentSlug: 'tuqui',
            channel: 'web'
        })

        expect(result).not.toContain('MODO ACTIVO')
    })

    test('skips routing specialty when low confidence', async () => {
        const result = await buildSystemPrompt({
            tenantId: 'test-tenant',
            agentSystemPrompt: 'Sos Tuqui.',
            routedAgent: { slug: 'odoo', name: 'Odoo Expert' },
            routingDecision: { agentSlug: 'odoo', confidence: 'low', reason: 'maybe' },
            baseAgentSlug: 'tuqui',
            channel: 'web'
        })

        expect(result).not.toContain('MODO ACTIVO')
    })

    test('never mentions technical names in tool usage rules', async () => {
        const result = await buildSystemPrompt({
            tenantId: 'test-tenant',
            agentSystemPrompt: 'Sos Tuqui.',
            channel: 'web'
        })

        expect(result).toContain('NUNCA menciones nombres técnicos')
    })
})
