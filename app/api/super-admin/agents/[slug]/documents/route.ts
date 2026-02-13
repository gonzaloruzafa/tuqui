import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isPlatformAdmin } from '@/lib/platform/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { processMasterDocument, linkDocumentToAgent, deleteMasterDocument } from '@/lib/rag/master-documents'

async function getMasterAgentBySlug(slug: string) {
    const supabase = supabaseAdmin()
    const { data } = await supabase
        .from('master_agents')
        .select('id')
        .eq('slug', slug)
        .single()
    return data
}

/**
 * GET — list master documents for an agent
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { slug } = await params
    const agent = await getMasterAgentBySlug(slug)
    if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const supabase = supabaseAdmin()
    const { data, error } = await supabase
        .from('master_agent_documents')
        .select('document_id, master_documents(id, title, file_name, source_type, created_at)')
        .eq('master_agent_id', agent.id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const docs = (data || []).map((row: any) => ({
        id: row.master_documents.id,
        title: row.master_documents.title,
        file_name: row.master_documents.file_name,
        source_type: row.master_documents.source_type,
        created_at: row.master_documents.created_at
    }))

    return NextResponse.json(docs)
}

/**
 * POST — upload a PDF and link it to this agent
 * Expects FormData with 'file' (PDF) and optional 'title'
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { slug } = await params
    const agent = await getMasterAgentBySlug(slug)
    if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const title = (formData.get('title') as string) || file?.name || 'Sin título'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Extract text from PDF
        const buffer = Buffer.from(await file.arrayBuffer())
        const text = await extractPdfText(buffer)

        if (!text || text.length < 50) {
            return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 })
        }

        // Process: chunk → embed → store
        const docId = await processMasterDocument({
            title,
            content: text,
            sourceType: 'file',
            fileName: file.name,
            metadata: { size: file.size, uploadedBy: session?.user?.email }
        })

        // Link to agent
        await linkDocumentToAgent(docId, agent.id)

        return NextResponse.json({ id: docId, title, file_name: file.name })
    } catch (err: any) {
        console.error('[MasterDocs API] Upload error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

/**
 * DELETE — unlink and delete a master document
 * Expects JSON body with { documentId }
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { slug } = await params
    const agent = await getMasterAgentBySlug(slug)
    if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    try {
        const { documentId } = await req.json()
        if (!documentId) {
            return NextResponse.json({ error: 'documentId required' }, { status: 400 })
        }

        await deleteMasterDocument(documentId)
        return NextResponse.json({ ok: true })
    } catch (err: any) {
        console.error('[MasterDocs API] Delete error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// --- PDF text extraction (reused from admin/rag/actions.ts) ---

function cleanText(text: string): string {
    return text
        .replace(/\u0000/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

async function extractPdfText(buffer: Buffer): Promise<string> {
    try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
        pdfjsLib.GlobalWorkerOptions.workerSrc = ''

        const uint8Array = new Uint8Array(buffer)
        const pdf = await pdfjsLib.getDocument({
            data: uint8Array,
            useSystemFonts: true,
            disableFontFace: true
        }).promise

        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items.map((item: any) => item.str).join(' ')
            fullText += pageText + '\n'
        }

        return cleanText(fullText)
    } catch (e: any) {
        console.error('[MasterDocs] pdfjs-dist error:', e.message)
    }

    try {
        const pdfParse = require('pdf-parse')
        const data = await pdfParse(buffer)
        return cleanText(data.text)
    } catch (e: any) {
        console.error('[MasterDocs] pdf-parse error:', e.message)
    }

    throw new Error('Could not extract text from PDF')
}
