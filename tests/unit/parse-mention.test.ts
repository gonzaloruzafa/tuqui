import { describe, test, expect } from 'vitest'
import { parseMention } from '@/lib/chat/parse-mention'

const SLUGS = ['odoo', 'contador', 'legal1', 'meli', 'general']

const cases = [
    // Valid mentions
    { input: '@contador qué dice la ley de IVA', expected: { agentSlug: 'contador', cleanMessage: 'qué dice la ley de IVA' } },
    { input: '@odoo cuánto vendimos hoy', expected: { agentSlug: 'odoo', cleanMessage: 'cuánto vendimos hoy' } },
    { input: '@legal1 necesito info sobre sociedades', expected: { agentSlug: 'legal1', cleanMessage: 'necesito info sobre sociedades' } },
    { input: '@meli precio del iPhone 15', expected: { agentSlug: 'meli', cleanMessage: 'precio del iPhone 15' } },

    // No mention
    { input: 'cuánto vendimos ayer', expected: { agentSlug: null, cleanMessage: 'cuánto vendimos ayer' } },
    { input: 'hola', expected: { agentSlug: null, cleanMessage: 'hola' } },
    { input: '', expected: { agentSlug: null, cleanMessage: '' } },

    // Invalid slug (not in available list)
    { input: '@inexistente algo', expected: { agentSlug: null, cleanMessage: '@inexistente algo' } },

    // @ in middle of message (not at start)
    { input: 'hola @contador dame info', expected: { agentSlug: null, cleanMessage: 'hola @contador dame info' } },

    // @ without space after slug
    { input: '@contadorqué', expected: { agentSlug: null, cleanMessage: '@contadorqué' } },

    // Only @mention without message — should NOT match (regex requires space + text)
    { input: '@contador', expected: { agentSlug: null, cleanMessage: '@contador' } },

    // Mention with extra spaces
    { input: '@contador   hola mundo', expected: { agentSlug: 'contador', cleanMessage: 'hola mundo' } },
]

describe('parseMention', () => {
    test.each(cases)('$input → agentSlug=$expected.agentSlug', ({ input, expected }) => {
        const result = parseMention(input, SLUGS)
        expect(result.agentSlug).toBe(expected.agentSlug)
        expect(result.cleanMessage).toBe(expected.cleanMessage)
    })
})
