/**
 * Master Documents — procesamiento de docs centralizados para RAG
 * 
 * Docs a nivel plataforma (sin tenant_id): leyes, normativas, etc.
 * Compartidos entre todos los tenants via master_agent_documents M2M.
 * 
 * Reutiliza: chunker.ts (split), embeddings.ts (vectores)
 */

import { getClient } from '@/lib/supabase/client'
import { chunkText } from './chunker'
import { generateEmbeddings } from './embeddings'

export interface ProcessDocumentParams {
    title: string
    content: string
    sourceType?: 'file' | 'manual' | 'url'
    fileName?: string
    metadata?: Record<string, any>
}

export interface MasterDocument {
    id: string
    title: string
    file_name: string | null
    source_type: string
    created_at: string
    chunk_count?: number
}

/**
 * Procesa un documento: chunk → embed → insert a master_documents + chunks
 * Retorna el ID del documento creado
 */
export async function processMasterDocument(params: ProcessDocumentParams): Promise<string> {
    const { title, content, sourceType = 'file', fileName, metadata = {} } = params
    const db = getClient()

    // 1. Chunk the content
    const chunks = chunkText(content)
    const validChunks = chunks.filter(c => c.length >= 50)
    console.log(`[MasterDocs] Chunked "${title}": ${validChunks.length} chunks (${chunks.length - validChunks.length} filtered)`)

    if (validChunks.length === 0) {
        throw new Error(`No valid chunks generated for "${title}" (content too short?)`)
    }

    // 2. Generate embeddings for all chunks
    console.log(`[MasterDocs] Generating embeddings for ${validChunks.length} chunks...`)
    const embeddings = await generateEmbeddings(validChunks)

    // 3. Insert document
    const { data: doc, error: docError } = await db
        .from('master_documents')
        .insert({
            title,
            content,
            source_type: sourceType,
            file_name: fileName,
            metadata
        })
        .select('id')
        .single()

    if (docError || !doc) {
        throw new Error(`Failed to insert master document: ${docError?.message}`)
    }

    // 4. Insert chunks with embeddings
    const chunkRows = validChunks.map((chunk, i) => ({
        document_id: doc.id,
        content: chunk,
        embedding: JSON.stringify(embeddings[i]),
        chunk_index: i,
        metadata: { charCount: chunk.length, totalChunks: validChunks.length }
    }))

    const { error: chunksError } = await db
        .from('master_document_chunks')
        .insert(chunkRows)

    if (chunksError) {
        // Cleanup doc if chunks fail
        await db.from('master_documents').delete().eq('id', doc.id)
        throw new Error(`Failed to insert chunks: ${chunksError.message}`)
    }

    console.log(`[MasterDocs] ✅ Processed "${title}": ${validChunks.length} chunks stored`)
    return doc.id
}

/**
 * Vincula un documento a un master agent (M2M)
 */
export async function linkDocumentToAgent(documentId: string, masterAgentId: string): Promise<void> {
    const db = getClient()

    const { error } = await db
        .from('master_agent_documents')
        .upsert({
            master_agent_id: masterAgentId,
            document_id: documentId
        }, { onConflict: 'master_agent_id,document_id' })

    if (error) {
        throw new Error(`Failed to link document to agent: ${error.message}`)
    }
}

/**
 * Elimina un master document (cascade borra chunks y links)
 */
export async function deleteMasterDocument(documentId: string): Promise<void> {
    const db = getClient()

    const { error } = await db
        .from('master_documents')
        .delete()
        .eq('id', documentId)

    if (error) {
        throw new Error(`Failed to delete master document: ${error.message}`)
    }
}

/**
 * Lista documentos vinculados a un master agent
 */
export async function getMasterDocumentsForAgent(masterAgentId: string): Promise<MasterDocument[]> {
    const db = getClient()

    const { data, error } = await db
        .from('master_agent_documents')
        .select('document_id, master_documents(id, title, file_name, source_type, created_at)')
        .eq('master_agent_id', masterAgentId)

    if (error) {
        console.error('[MasterDocs] Error fetching documents:', error)
        return []
    }

    return (data || []).map((row: any) => ({
        id: row.master_documents.id,
        title: row.master_documents.title,
        file_name: row.master_documents.file_name,
        source_type: row.master_documents.source_type,
        created_at: row.master_documents.created_at
    }))
}
