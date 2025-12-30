/**
 * Script para pre-cargar documentos fiscales y legales en el RAG
 * 
 * Ejecutar: npx tsx scripts/seed-rag-docs.ts
 */

import { createClient } from '@supabase/supabase-js'
import { google } from '@ai-sdk/google'
import { embedMany } from 'ai'
import * as fs from 'fs'
import * as path from 'path'

// TENANT CONFIG - Cambiar por el tenant correcto
const TENANT_SUPABASE_URL = 'https://ancgbbzvfhoqqxiueyoz.supabase.co'
const TENANT_SUPABASE_KEY = process.env.TENANT_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuY2diYnp2ZmhvcXF4aXVleW96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjI2ODcxMywiZXhwIjoyMDgxODQ0NzEzfQ.vF_zWhqGNHrEp1Vpv4GI7hAALCNvyNgJrKfEWPAOeXw'

// Agent slugs to link docs to
const CONTADOR_SLUG = 'tuqui-contador'
const LEGAL_SLUG = 'tuqui-legal'

// Documents to seed
const DOCS_TO_SEED = [
    // Fiscal documents
    {
        path: 'rag-docs/fiscal/monotributo_categorias_2024.md',
        title: 'Monotributo - Categorías y Límites 2024',
        category: 'fiscal',
        agents: [CONTADOR_SLUG]
    },
    {
        path: 'rag-docs/fiscal/impuesto_ganancias_2024.md',
        title: 'Impuesto a las Ganancias - Guía Completa',
        category: 'fiscal',
        agents: [CONTADOR_SLUG]
    },
    {
        path: 'rag-docs/fiscal/iva_guia_completa.md',
        title: 'IVA - Guía Completa Argentina',
        category: 'fiscal',
        agents: [CONTADOR_SLUG]
    },
    // Legal documents
    {
        path: 'rag-docs/legal/ley_contrato_trabajo_20744.md',
        title: 'Ley de Contrato de Trabajo 20.744',
        category: 'legal',
        agents: [LEGAL_SLUG]
    },
    {
        path: 'rag-docs/legal/ley_sociedades_19550.md',
        title: 'Ley General de Sociedades 19.550',
        category: 'legal',
        agents: [LEGAL_SLUG]
    },
    {
        path: 'rag-docs/legal/ley_consumidor_24240.md',
        title: 'Ley de Defensa del Consumidor 24.240',
        category: 'legal',
        agents: [LEGAL_SLUG]
    },
]

// Chunking function
function chunkDocument(content: string, chunkSize = 1000, chunkOverlap = 200): string[] {
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

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const { embeddings } = await embedMany({
        model: google.textEmbeddingModel('text-embedding-004'),
        values: texts,
    })
    return embeddings
}

async function main() {
    console.log('🚀 Starting RAG document seeding...\n')
    
    const db = createClient(TENANT_SUPABASE_URL, TENANT_SUPABASE_KEY)
    
    // Get agent IDs
    const { data: agents, error: agentErr } = await db
        .from('agents')
        .select('id, slug')
        .in('slug', [CONTADOR_SLUG, LEGAL_SLUG])
    
    if (agentErr || !agents) {
        console.error('❌ Error fetching agents:', agentErr)
        return
    }
    
    const agentMap = new Map(agents.map(a => [a.slug, a.id]))
    console.log(`📋 Found agents: ${agents.map(a => a.slug).join(', ')}\n`)
    
    let totalDocs = 0
    let totalChunks = 0
    
    for (const docConfig of DOCS_TO_SEED) {
        const filePath = path.join(process.cwd(), docConfig.path)
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  Skipping ${docConfig.path} - file not found`)
            continue
        }
        
        console.log(`📄 Processing: ${docConfig.title}`)
        
        // Read content
        const content = fs.readFileSync(filePath, 'utf-8')
        console.log(`   Content: ${content.length} chars`)
        
        // Check if document already exists
        const { data: existing } = await db
            .from('documents')
            .select('id')
            .eq('title', docConfig.title)
            .single()
        
        if (existing) {
            console.log(`   ⏭️  Already exists, skipping`)
            continue
        }
        
        // Insert document
        const { data: doc, error: docErr } = await db
            .from('documents')
            .insert({
                title: docConfig.title,
                content: content,
                source_type: 'seed',
                metadata: {
                    filename: path.basename(docConfig.path),
                    category: docConfig.category,
                    seeded: true,
                    seedDate: new Date().toISOString()
                }
            })
            .select()
            .single()
        
        if (docErr || !doc) {
            console.error(`   ❌ Error inserting document:`, docErr)
            continue
        }
        
        console.log(`   ✅ Document created: ${doc.id}`)
        totalDocs++
        
        // Chunk the document
        const chunks = chunkDocument(content)
        console.log(`   📦 Created ${chunks.length} chunks`)
        
        // Generate embeddings
        console.log(`   🧠 Generating embeddings...`)
        const embeddings = await generateEmbeddings(chunks)
        
        // Insert chunks
        const chunksToInsert = chunks.map((chunk, i) => ({
            document_id: doc.id,
            content: chunk,
            embedding: embeddings[i],
            metadata: { 
                chunk_index: i,
                category: docConfig.category
            }
        }))
        
        const { error: chunkErr } = await db
            .from('document_chunks')
            .insert(chunksToInsert)
        
        if (chunkErr) {
            console.error(`   ❌ Error inserting chunks:`, chunkErr)
            // Rollback
            await db.from('documents').delete().eq('id', doc.id)
            continue
        }
        
        console.log(`   ✅ Inserted ${chunks.length} chunks`)
        totalChunks += chunks.length
        
        // Link to agents
        for (const agentSlug of docConfig.agents) {
            const agentId = agentMap.get(agentSlug)
            if (!agentId) {
                console.log(`   ⚠️  Agent ${agentSlug} not found`)
                continue
            }
            
            const { error: linkErr } = await db
                .from('agent_documents')
                .insert({
                    agent_id: agentId,
                    document_id: doc.id
                })
            
            if (linkErr) {
                console.error(`   ❌ Error linking to ${agentSlug}:`, linkErr)
            } else {
                console.log(`   🔗 Linked to ${agentSlug}`)
            }
        }
        
        console.log('')
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`✅ Seeding complete!`)
    console.log(`   📄 Documents: ${totalDocs}`)
    console.log(`   📦 Chunks: ${totalChunks}`)
}

main().catch(console.error)
