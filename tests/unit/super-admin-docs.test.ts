/**
 * Tests for Super Admin Master Documents API
 * 
 * Validates GET/POST/DELETE for /api/super-admin/agents/[slug]/documents
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// --- Mock data ---

const MOCK_AGENT = { id: 'master-agent-1', slug: 'odoo' }

const MOCK_DOCS = [
    {
        document_id: 'doc-1',
        master_documents: {
            id: 'doc-1',
            title: 'Ley de Monotributo',
            file_name: 'monotributo.pdf',
            source_type: 'file',
            created_at: '2025-01-01T00:00:00Z'
        }
    }
]

// --- Mock supabase ---

const mockFrom = vi.fn()
const supabaseMock = { from: mockFrom }

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => supabaseMock
}))

vi.mock('@/lib/auth/config', () => ({
    auth: vi.fn(async () => ({ user: { email: 'admin@tuqui.app' } }))
}))

vi.mock('@/lib/platform/auth', () => ({
    isPlatformAdmin: vi.fn(async (email: string) => email === 'admin@tuqui.app')
}))

vi.mock('@/lib/rag/master-documents', () => ({
    processMasterDocument: vi.fn(async () => 'new-doc-id'),
    linkDocumentToAgent: vi.fn(async () => {}),
    deleteMasterDocument: vi.fn(async () => {})
}))

// ============================================

beforeEach(() => {
    vi.clearAllMocks()

    // Default: agent lookup returns MOCK_AGENT
    mockFrom.mockImplementation((table: string) => {
        if (table === 'master_agents') {
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: MOCK_AGENT, error: null })
                    })
                })
            }
        }
        if (table === 'master_agent_documents') {
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ data: MOCK_DOCS, error: null })
                })
            }
        }
        return {}
    })
})

describe('Super Admin Documents API', () => {
    test('GET returns document list for agent', async () => {
        const { GET } = await import('@/app/api/super-admin/agents/[slug]/documents/route')

        const req = new Request('http://localhost/api/super-admin/agents/odoo/documents')
        const res = await GET(req as any, { params: Promise.resolve({ slug: 'odoo' }) })

        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toHaveLength(1)
        expect(data[0].title).toBe('Ley de Monotributo')
    })

    test('GET returns 404 for unknown agent', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'master_agents') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
                        })
                    })
                }
            }
            return {}
        })

        const { GET } = await import('@/app/api/super-admin/agents/[slug]/documents/route')

        const req = new Request('http://localhost/api/super-admin/agents/unknown/documents')
        const res = await GET(req as any, { params: Promise.resolve({ slug: 'unknown' }) })

        expect(res.status).toBe(404)
    })

    test('DELETE calls deleteMasterDocument', async () => {
        const { DELETE } = await import('@/app/api/super-admin/agents/[slug]/documents/route')
        const { deleteMasterDocument } = await import('@/lib/rag/master-documents')

        const req = new Request('http://localhost/api/super-admin/agents/odoo/documents', {
            method: 'DELETE',
            body: JSON.stringify({ documentId: 'doc-1' }),
            headers: { 'Content-Type': 'application/json' }
        })

        const res = await DELETE(req as any, { params: Promise.resolve({ slug: 'odoo' }) })

        expect(res.status).toBe(200)
        expect(deleteMasterDocument).toHaveBeenCalledWith('doc-1')
    })

    test('DELETE returns 400 without documentId', async () => {
        const { DELETE } = await import('@/app/api/super-admin/agents/[slug]/documents/route')

        const req = new Request('http://localhost/api/super-admin/agents/odoo/documents', {
            method: 'DELETE',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' }
        })

        const res = await DELETE(req as any, { params: Promise.resolve({ slug: 'odoo' }) })

        expect(res.status).toBe(400)
    })
})
