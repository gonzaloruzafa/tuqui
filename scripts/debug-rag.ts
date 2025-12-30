/**
 * Script para debuggear el RAG
 * 
 * Ejecutar: GEMINI_API_KEY=xxx npx tsx scripts/debug-rag.ts
 */

import { createClient } from '@supabase/supabase-js'
import { google } from '@ai-sdk/google'
import { embed } from 'ai'

// TENANT CONFIG
const TENANT_URL = 'https://ancgbbzvfhoqqxiueyoz.supabase.co'
const TENANT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuY2diYnp2ZmhvcXF4aXVleW96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODMwMDE4NywiZXhwIjoyMDYzODc2MTg3fQ.Qd6Ibn56bYrp3UxkP-vUj1BSzehKjU-u2rF40sQyeXw'

async function main() {
    const db = createClient(TENANT_URL, TENANT_KEY)
    
    console.log('🔍 Debugging RAG setup...\n')
    
    // 1. Get tuqui-contador agent
    console.log('1. Checking agent...')
    const { data: agent, error: agentErr } = await db
        .from('agents')
        .select('id, slug, name, rag_enabled, rag_strict')
        .eq('slug', 'tuqui-contador')
        .single()
    
    if (agentErr || !agent) {
        console.log('❌ Agent not found:', agentErr)
        return
    }
    console.log('   Agent:', agent)
    
    // 2. Check linked documents
    console.log('\n2. Checking linked documents...')
    const { data: links } = await db
        .from('agent_documents')
        .select('document_id')
        .eq('agent_id', agent.id)
    console.log('   Linked doc IDs:', links?.map(l => l.document_id) || [])
    
    // 3. Check all documents
    console.log('\n3. All documents in system...')
    const { data: docs } = await db
        .from('documents')
        .select('id, title, agent_id, is_global, metadata')
    console.log('   Documents:')
    docs?.forEach(d => {
        const linked = links?.some(l => l.document_id === d.id) ? '✓ LINKED' : ''
        console.log(`   - ${d.title || d.metadata?.filename} (id: ${d.id.slice(0,8)}...) ${linked}`)
    })
    
    // 4. Check chunks
    console.log('\n4. Checking chunks...')
    const { data: chunks, count } = await db
        .from('document_chunks')
        .select('id, document_id, content', { count: 'exact' })
        .limit(5)
    console.log(`   Total chunks: ${count}`)
    console.log(`   Sample:`, chunks?.[0]?.content?.slice(0, 100) + '...')
    
    // 5. Test embedding generation
    console.log('\n5. Testing embedding...')
    const testQuery = 'categoria f monotributo facturar'
    try {
        const { embedding } = await embed({
            model: google.textEmbeddingModel('text-embedding-004'),
            value: testQuery,
        })
        console.log(`   Query: "${testQuery}"`)
        console.log(`   Embedding dimension: ${embedding.length}`)
        console.log(`   First 5 values: [${embedding.slice(0, 5).join(', ')}]`)
        
        // 6. Test match_documents RPC
        console.log('\n6. Testing match_documents RPC...')
        const { data: matches, error: matchErr } = await db.rpc('match_documents', {
            query_embedding: embedding,
            match_agent_id: agent.id,
            match_threshold: 0.2,  // Very low threshold for testing
            match_count: 10
        })
        
        if (matchErr) {
            console.log('   ❌ RPC Error:', matchErr)
        } else {
            console.log(`   Found ${matches?.length || 0} matches:`)
            matches?.forEach((m: any) => {
                console.log(`   - Similarity: ${m.similarity.toFixed(3)} | ${m.content?.slice(0, 80)}...`)
            })
        }
        
    } catch (e) {
        console.log('   ❌ Embedding error:', e)
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Debug complete!')
}

main().catch(console.error)
