import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isPlatformAdmin } from '@/lib/platform/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { processMasterDocument, linkDocumentToAgent, deleteMasterDocument } from '@/lib/rag/master-documents'

// PDF processing + embeddings can take 30s+
export const maxDuration = 60

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
 * POST — two actions:
 *   { action: 'get_upload_url', fileName } → returns signed URL for Storage
 *   { action: 'process_from_storage', storagePath, fileName, fileSize, title } → process uploaded file
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
        const body = await req.json()
        const { action } = body

        if (action === 'get_upload_url') {
            return handleGetUploadUrl(body.fileName)
        }

        if (action === 'process_from_storage') {
            return handleProcessFromStorage(body, agent.id, session?.user?.email)
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (err: any) {
        console.error('[MasterDocs API] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

/**
 * DELETE — unlink and delete a master document
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

// --- Action handlers ---

async function handleGetUploadUrl(fileName: string) {
    const supabase = supabaseAdmin()
    const timestamp = Date.now()
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = `master-docs/${timestamp}_${safeName}`

    const { data, error } = await supabase.storage
        .from('rag-documents')
        .createSignedUploadUrl(path)

    if (error) {
        console.error('[MasterDocs] Signed URL error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: data.signedUrl, path, token: data.token })
}

async function handleProcessFromStorage(
    body: { storagePath: string; fileName: string; fileSize: number; title: string },
    agentId: string,
    email?: string | null
) {
    const { storagePath, fileName, fileSize, title } = body
    const supabase = supabaseAdmin()

    // 1. Download from Storage
    const { data: fileData, error: downloadError } = await supabase.storage
        .from('rag-documents')
        .download(storagePath)

    if (downloadError || !fileData) {
        return NextResponse.json({ error: `Download failed: ${downloadError?.message}` }, { status: 500 })
    }

    // 2. Extract text
    const buffer = Buffer.from(await fileData.arrayBuffer())
    const text = await extractPdfText(buffer)

    // 3. Clean up Storage file (content now lives in DB)
    await supabase.storage.from('rag-documents').remove([storagePath])

    if (!text || text.length < 50) {
        return NextResponse.json({ error: 'Could not extract text from PDF (content too short)' }, { status: 400 })
    }

    // 4. Process: chunk → embed → store
    const docId = await processMasterDocument({
        title: title || fileName,
        content: text,
        sourceType: 'file',
        fileName,
        metadata: { size: fileSize, uploadedBy: email }
    })

    // 5. Link to agent
    await linkDocumentToAgent(docId, agentId)

    return NextResponse.json({ id: docId, title: title || fileName, file_name: fileName })
}

// --- PDF text extraction ---

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
