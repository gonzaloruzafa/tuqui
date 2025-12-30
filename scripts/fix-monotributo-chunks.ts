/**
 * Script para regenerar chunks del documento de monotributo
 * 
 * Ejecutar con las variables de .env.prod:
 * export $(cat .env.prod | grep -v "^#" | xargs) && npx tsx scripts/fix-monotributo-chunks.ts
 */

import { createClient } from '@supabase/supabase-js'
import { google } from '@ai-sdk/google'
import { embedMany } from 'ai'
import * as fs from 'fs'
import * as path from 'path'

// Chunking function
function chunkDocument(content: string, chunkSize = 800, chunkOverlap = 150): string[] {
    const chunks: string[] = []
    let start = 0
    
    while (start < content.length) {
        let end = start + chunkSize
        
        // Try to break at a paragraph or sentence
        if (end < content.length) {
            const lastParagraph = content.lastIndexOf('\n\n', end)
            const lastSentence = content.lastIndexOf('. ', end)
            
            if (lastParagraph > start + chunkSize / 2) {
                end = lastParagraph + 2
            } else if (lastSentence > start + chunkSize / 2) {
                end = lastSentence + 2
            }
        }
        
        chunks.push(content.slice(start, end).trim())
        start = end - chunkOverlap
    }
    
    return chunks.filter(c => c.length > 50)
}

async function main() {
    console.log('🔧 Fixing Monotributo document chunks...\n')
    
    // Connect to master
    const master = createClient(
        process.env.NEXT_PUBLIC_MASTER_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Get tenant
    const { data: tenant } = await master.from('tenants').select('*').eq('slug', 'demo-company').single()
    if (!tenant) { console.log('Tenant not found'); return }
    
    const db = createClient(tenant.supabase_url, tenant.supabase_service_key)
    
    // Get monotributo doc
    const { data: doc } = await db.from('documents').select('*').ilike('title', '%monotributo%').single()
    if (!doc) { console.log('Document not found'); return }
    
    console.log('Document:', doc.title)
    console.log('ID:', doc.id)
    
    // Delete existing chunks
    const { error: delErr } = await db.from('document_chunks').delete().eq('document_id', doc.id)
    if (delErr) console.log('Error deleting old chunks:', delErr)
    else console.log('Deleted old chunks')
    
    // Read fresh content from file
    const filePath = path.join(process.cwd(), 'rag-docs/fiscal/monotributo_categorias_2024.md')
    const content = fs.readFileSync(filePath, 'utf-8')
    console.log('Content length:', content.length)
    
    // Create chunks
    const chunks = chunkDocument(content)
    console.log('Created', chunks.length, 'chunks')
    
    // Generate embeddings
    console.log('Generating embeddings...')
    const { embeddings } = await embedMany({
        model: google.textEmbeddingModel('text-embedding-004'),
        values: chunks,
    })
    console.log('Generated', embeddings.length, 'embeddings')
    
    // Insert chunks
    const chunksToInsert = chunks.map((chunk, i) => ({
        document_id: doc.id,
        content: chunk,
        embedding: embeddings[i],
        metadata: { 
            chunk_index: i,
            category: 'fiscal'
        }
    }))
    
    const { error: insertErr } = await db.from('document_chunks').insert(chunksToInsert)
    if (insertErr) {
        console.log('❌ Error inserting chunks:', insertErr)
    } else {
        console.log('✅ Inserted', chunks.length, 'chunks')
    }
    
    // Verify
    const { count } = await db.from('document_chunks').select('*', { count: 'exact', head: true }).eq('document_id', doc.id)
    console.log('\nVerification - chunks in DB:', count)
}

main().catch(console.error)
