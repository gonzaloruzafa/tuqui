import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createRagTool } from '@/lib/tools/definitions/rag-tool'

// Mock searchDocuments
vi.mock('@/lib/rag/search', () => ({
    searchDocuments: vi.fn()
}))

import { searchDocuments } from '@/lib/rag/search'
const mockedSearch = vi.mocked(searchDocuments)

const TENANT_ID = 'test-tenant'
const AGENT_ID = 'test-agent-uuid'

describe('RAG Tool - createRagTool', () => {
    let tool: ReturnType<typeof createRagTool>

    beforeEach(() => {
        vi.clearAllMocks()
        tool = createRagTool(TENANT_ID, AGENT_ID)
    })

    test('has descriptive description with USAR CUANDO / NO USAR', () => {
        expect(tool.description).toContain('USAR CUANDO')
        expect(tool.description).toContain('NO USAR')
        expect(tool.description).toContain('base de conocimiento')
    })

    test('returns documents when found', async () => {
        mockedSearch.mockResolvedValue([
            { content: 'El sillón Cingol tiene garantía de 2 años', similarity: 0.92 },
            { content: 'Posiciones: Trendelenburg, reclinado, sentado', similarity: 0.85 },
        ] as any)

        const result = await tool.execute({ query: 'garantía sillón Cingol' })

        expect(result.found).toBe(true)
        expect(result.count).toBe(2)
        expect(result.documents).toHaveLength(2)
        expect(result.documents[0].content).toContain('garantía')
        expect(result.documents[0].relevance).toBe('92%')
        expect(result.documents[1].relevance).toBe('85%')
    })

    test('returns empty when no documents match', async () => {
        mockedSearch.mockResolvedValue([])

        const result = await tool.execute({ query: 'algo inexistente' })

        expect(result.found).toBe(false)
        expect(result.count).toBe(0)
        expect(result.documents).toHaveLength(0)
    })

    test('handles errors gracefully', async () => {
        mockedSearch.mockRejectedValue(new Error('Supabase connection failed'))

        const result = await tool.execute({ query: 'test query' })

        expect(result.found).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.documents).toHaveLength(0)
    })

    test('passes tenantId and agentId to searchDocuments', async () => {
        mockedSearch.mockResolvedValue([])

        await tool.execute({ query: 'mi consulta' })

        expect(mockedSearch).toHaveBeenCalledWith(TENANT_ID, AGENT_ID, 'mi consulta', 5)
    })
})
