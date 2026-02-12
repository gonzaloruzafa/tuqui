/**
 * Integration test: Master Documents RAG flow
 * 
 * Verifica el flujo completo:
 * 1. Procesar un documento master (chunk + embed)
 * 2. Linkear a un master agent
 * 3. Buscar desde un tenant agent que hereda del master
 * 4. Verificar que match_documents devuelve chunks del master
 * 
 * Requiere: SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 * Skip si no hay env vars
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'

const SKIP = !process.env.GEMINI_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL

describe('Master Documents RAG Integration', () => {
  if (SKIP) {
    test.skip('Skipped: missing GEMINI_API_KEY or SUPABASE_URL', () => {})
    return
  }

  let documentId: string
  let masterAgentId: string
  let tenantAgentId: string
  const TEST_TENANT_ID = process.env.TEST_TENANT_ID || 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

  beforeAll(async () => {
    const { getClient, getTenantClient } = await import('@/lib/supabase/client')

    // Get a master agent with knowledge_base
    const db = getClient()
    const { data: masterAgent } = await db
      .from('master_agents')
      .select('id, slug')
      .contains('tools', ['knowledge_base'])
      .limit(1)
      .single()

    if (!masterAgent) {
      console.warn('⚠️  No master agent with knowledge_base found')
      return
    }
    masterAgentId = masterAgent.id
    console.log(`Using master agent: ${masterAgent.slug} (${masterAgentId})`)

    // Get corresponding tenant agent
    const tenantDb = await getTenantClient(TEST_TENANT_ID)
    const { data: tenantAgent } = await tenantDb
      .from('agents')
      .select('id, slug')
      .eq('tenant_id', TEST_TENANT_ID)
      .eq('master_agent_id', masterAgentId)
      .limit(1)
      .single()

    if (!tenantAgent) {
      console.warn('⚠️  No tenant agent found for this master')
      return
    }
    tenantAgentId = tenantAgent.id
    console.log(`Using tenant agent: ${tenantAgent.slug} (${tenantAgentId})`)
  })

  afterAll(async () => {
    // Cleanup: delete test document
    if (documentId) {
      const { deleteMasterDocument } = await import('@/lib/rag/master-documents')
      await deleteMasterDocument(documentId)
      console.log(`🧹 Cleanup: deleted test document ${documentId}`)
    }
  })

  test('process master document, link to agent, search via tenant', async () => {
    if (!masterAgentId || !tenantAgentId) {
      console.warn('Skipping: no agents available')
      return
    }

    const { processMasterDocument, linkDocumentToAgent } = await import('@/lib/rag/master-documents')
    const { searchDocuments } = await import('@/lib/rag/search')

    // 1. Process a test document
    const testContent = `
      Artículo 1 de la Ley de Sociedades Comerciales 19.550:
      Habrá sociedad si una o más personas en forma organizada conforme a uno de los tipos 
      previstos en esta ley, se obliguen a realizar aportes para aplicarlos a la producción o 
      intercambio de bienes o servicios, participando de los beneficios y soportando las pérdidas.
      La sociedad unipersonal solo se podrá constituir como sociedad anónima.
      
      Artículo 11 - Contenido del instrumento constitutivo:
      El instrumento de constitución debe contener: 1) El nombre, edad, estado civil, nacionalidad, 
      profesión, domicilio y número de documento de identidad de los socios; 2) La razón social 
      o la denominación, y el domicilio de la sociedad; 3) La designación de su objeto que debe 
      ser preciso y determinado; 4) El capital social, que deberá ser expresado en moneda argentina.
    `.trim()

    documentId = await processMasterDocument({
      title: 'Test - Ley Sociedades (fragmento)',
      content: testContent,
      sourceType: 'manual',
      metadata: { isTest: true }
    })

    expect(documentId).toBeTruthy()
    console.log(`✅ Document processed: ${documentId}`)

    // 2. Link to master agent
    await linkDocumentToAgent(documentId, masterAgentId)
    console.log(`✅ Linked to master agent`)

    // 3. Search from tenant context
    const results = await searchDocuments(
      TEST_TENANT_ID,
      tenantAgentId,
      'requisitos para constituir una sociedad',
      5
    )

    console.log(`✅ Search returned ${results.length} results`)
    console.log(results.map(r => ({
      similarity: `${Math.round(r.similarity * 100)}%`,
      preview: r.content.substring(0, 80) + '...'
    })))

    // Should find our test document
    expect(results.length).toBeGreaterThan(0)
    
    // At least one result should contain society-related content
    const hasRelevant = results.some(r =>
      r.content.includes('sociedad') || r.content.includes('Ley') || r.content.includes('constitución')
    )
    expect(hasRelevant).toBe(true)
  }, 60000) // 60s timeout for embeddings
})
