/**
 * Tests for Master Documents
 * 
 * Validates processMasterDocument, linkDocumentToAgent, deleteMasterDocument
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
    processMasterDocument,
    linkDocumentToAgent,
    deleteMasterDocument,
    getMasterDocumentsForAgent
} from '../../lib/rag/master-documents'

// ============================================
// MOCKS
// ============================================

// Mock supabase client
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockDelete = vi.fn()
const mockUpsert = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

const mockFrom = vi.fn(() => ({
    insert: mockInsert.mockReturnValue({ select: mockSelect.mockReturnValue({ single: mockSingle }), error: null }),
    select: mockSelect,
    delete: mockDelete.mockReturnValue({ eq: mockEq.mockReturnValue({ error: null }) }),
    upsert: mockUpsert.mockReturnValue({ error: null })
}))

vi.mock('@/lib/supabase/client', () => ({
    getClient: () => ({ from: mockFrom })
}))

// Mock chunker
vi.mock('@/lib/rag/chunker', () => ({
    chunkText: vi.fn((text: string) => {
        // Simulate chunking: split into ~100 char pieces
        const chunks: string[] = []
        for (let i = 0; i < text.length; i += 100) {
            const chunk = text.slice(i, i + 100)
            if (chunk.length >= 50) chunks.push(chunk)
        }
        return chunks.length > 0 ? chunks : ['chunk too short']
    })
}))

// Mock embeddings
vi.mock('@/lib/rag/embeddings', () => ({
    generateEmbeddings: vi.fn(async (texts: string[]) => 
        texts.map(() => Array(768).fill(0.1))
    )
}))

// ============================================
// SETUP
// ============================================

beforeEach(() => {
    vi.clearAllMocks()

    // Default: insert returns doc with id
    mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
            single: mockSingle.mockResolvedValue({ data: { id: 'doc-123' }, error: null })
        }),
        error: null
    })
})

// ============================================
// TESTS: processMasterDocument
// ============================================

describe('processMasterDocument', () => {
    const longContent = 'A'.repeat(200) // 200 chars → will produce chunks ≥50

    test('inserts document and chunks into master tables', async () => {
        const id = await processMasterDocument({
            title: 'Ley de IVA',
            content: longContent,
            sourceType: 'file',
            fileName: 'ley-iva.pdf'
        })

        expect(id).toBe('doc-123')

        // Should insert into master_documents
        expect(mockFrom).toHaveBeenCalledWith('master_documents')
        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Ley de IVA',
                content: longContent,
                source_type: 'file',
                file_name: 'ley-iva.pdf'
            })
        )

        // Should insert chunks into master_document_chunks
        expect(mockFrom).toHaveBeenCalledWith('master_document_chunks')
    })

    test('generates embeddings for each chunk', async () => {
        const { generateEmbeddings } = await import('@/lib/rag/embeddings')

        await processMasterDocument({
            title: 'Test Doc',
            content: longContent
        })

        expect(generateEmbeddings).toHaveBeenCalled()
        const calledWith = vi.mocked(generateEmbeddings).mock.calls[0][0]
        expect(calledWith.length).toBeGreaterThan(0)
    })

    test('throws if content produces no valid chunks', async () => {
        const { chunkText } = await import('@/lib/rag/chunker')
        vi.mocked(chunkText).mockReturnValueOnce([]) // empty chunks

        await expect(
            processMasterDocument({ title: 'Empty', content: 'tiny' })
        ).rejects.toThrow('No valid chunks')
    })

    test('cleans up document if chunk insert fails', async () => {
        // First insert (doc) succeeds
        mockInsert
            .mockReturnValueOnce({
                select: mockSelect.mockReturnValue({
                    single: mockSingle.mockResolvedValue({ data: { id: 'doc-fail' }, error: null })
                }),
                error: null
            })
            // Second insert (chunks) fails
            .mockReturnValueOnce({ error: { message: 'chunk insert failed' } })

        await expect(
            processMasterDocument({ title: 'Fail Doc', content: longContent })
        ).rejects.toThrow('chunk insert failed')

        // Should attempt to delete the orphaned document
        expect(mockFrom).toHaveBeenCalledWith('master_documents')
        expect(mockDelete).toHaveBeenCalled()
    })

    test('defaults sourceType to file', async () => {
        await processMasterDocument({
            title: 'No Source Type',
            content: longContent
        })

        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({ source_type: 'file' })
        )
    })
})

// ============================================
// TESTS: linkDocumentToAgent
// ============================================

describe('linkDocumentToAgent', () => {
    test('upserts M2M relationship', async () => {
        mockFrom.mockReturnValue({
            upsert: mockUpsert.mockReturnValue({ error: null })
        })

        await linkDocumentToAgent('doc-123', 'agent-456')

        expect(mockFrom).toHaveBeenCalledWith('master_agent_documents')
        expect(mockUpsert).toHaveBeenCalledWith(
            { master_agent_id: 'agent-456', document_id: 'doc-123' },
            { onConflict: 'master_agent_id,document_id' }
        )
    })

    test('throws on error', async () => {
        mockFrom.mockReturnValue({
            upsert: mockUpsert.mockReturnValue({ error: { message: 'upsert failed' } })
        })

        await expect(
            linkDocumentToAgent('doc-123', 'agent-456')
        ).rejects.toThrow('upsert failed')
    })
})

// ============================================
// TESTS: deleteMasterDocument
// ============================================

describe('deleteMasterDocument', () => {
    test('deletes document (cascade removes chunks and links)', async () => {
        mockFrom.mockReturnValue({
            delete: mockDelete.mockReturnValue({
                eq: mockEq.mockReturnValue({ error: null })
            })
        })

        await deleteMasterDocument('doc-123')

        expect(mockFrom).toHaveBeenCalledWith('master_documents')
        expect(mockDelete).toHaveBeenCalled()
        expect(mockEq).toHaveBeenCalledWith('id', 'doc-123')
    })

    test('throws on error', async () => {
        mockFrom.mockReturnValue({
            delete: mockDelete.mockReturnValue({
                eq: mockEq.mockReturnValue({ error: { message: 'delete failed' } })
            })
        })

        await expect(
            deleteMasterDocument('doc-123')
        ).rejects.toThrow('delete failed')
    })
})

// ============================================
// TESTS: getMasterDocumentsForAgent
// ============================================

describe('getMasterDocumentsForAgent', () => {
    test('returns documents for agent', async () => {
        mockFrom.mockReturnValue({
            select: mockSelect.mockReturnValue({
                eq: mockEq.mockResolvedValue({
                    data: [{
                        document_id: 'doc-1',
                        master_documents: {
                            id: 'doc-1',
                            title: 'Ley IVA',
                            file_name: 'ley-iva.pdf',
                            source_type: 'file',
                            created_at: '2026-02-12T00:00:00Z'
                        }
                    }],
                    error: null
                })
            })
        })

        const docs = await getMasterDocumentsForAgent('agent-1')

        expect(docs).toHaveLength(1)
        expect(docs[0].title).toBe('Ley IVA')
        expect(docs[0].file_name).toBe('ley-iva.pdf')
    })

    test('returns empty array on error', async () => {
        mockFrom.mockReturnValue({
            select: mockSelect.mockReturnValue({
                eq: mockEq.mockResolvedValue({ data: null, error: { message: 'err' } })
            })
        })

        const docs = await getMasterDocumentsForAgent('agent-1')
        expect(docs).toEqual([])
    })
})
