/**
 * Apply migration 130 to fix tool names and RAG config
 * 
 * Run with: npx tsx scripts/apply-migration-130.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  console.log('🔧 Applying migration 130: Fix tools and RAG...\n')

  // 1. Get all master_agents with meli_search
  const { data: masterAgents, error: maError } = await supabase
    .from('master_agents')
    .select('id, slug, tools, rag_enabled')
  
  if (maError) {
    console.error('Error fetching master_agents:', maError)
    return
  }

  console.log(`Found ${masterAgents?.length} master agents`)

  for (const agent of masterAgents || []) {
    let tools = agent.tools || []
    let needsUpdate = false

    // Replace meli_search with web_search
    if (tools.includes('meli_search')) {
      tools = tools.map((t: string) => t === 'meli_search' ? 'web_search' : t)
      needsUpdate = true
      console.log(`  ✏️  ${agent.slug}: meli_search → web_search`)
    }

    // Add knowledge_base if rag_enabled but not in tools
    if (agent.rag_enabled && !tools.includes('knowledge_base')) {
      tools.push('knowledge_base')
      needsUpdate = true
      console.log(`  ✏️  ${agent.slug}: +knowledge_base (rag_enabled)`)
    }

    // Remove duplicates
    tools = [...new Set(tools)]

    if (needsUpdate) {
      const { error } = await supabase
        .from('master_agents')
        .update({ tools })
        .eq('id', agent.id)
      
      if (error) {
        console.error(`  ❌ Error updating ${agent.slug}:`, error)
      } else {
        console.log(`  ✅ Updated ${agent.slug}: ${tools.join(', ')}`)
      }
    }
  }

  // 2. Do the same for agents table
  console.log('\n📋 Updating tenant agents...')
  
  const { data: agents, error: aError } = await supabase
    .from('agents')
    .select('id, slug, tools, rag_enabled, tenant_id')
  
  if (aError) {
    console.error('Error fetching agents:', aError)
    return
  }

  console.log(`Found ${agents?.length} tenant agents`)

  for (const agent of agents || []) {
    let tools = agent.tools || []
    let needsUpdate = false

    // Replace meli_search with web_search
    if (tools.includes('meli_search')) {
      tools = tools.map((t: string) => t === 'meli_search' ? 'web_search' : t)
      needsUpdate = true
      console.log(`  ✏️  ${agent.slug}: meli_search → web_search`)
    }

    // Add knowledge_base if rag_enabled but not in tools
    if (agent.rag_enabled && !tools.includes('knowledge_base')) {
      tools.push('knowledge_base')
      needsUpdate = true
      console.log(`  ✏️  ${agent.slug}: +knowledge_base (rag_enabled)`)
    }

    // Remove duplicates
    tools = [...new Set(tools)]

    if (needsUpdate) {
      const { error } = await supabase
        .from('agents')
        .update({ tools })
        .eq('id', agent.id)
      
      if (error) {
        console.error(`  ❌ Error updating ${agent.slug}:`, error)
      } else {
        console.log(`  ✅ Updated ${agent.slug}: ${tools.join(', ')}`)
      }
    }
  }

  // 3. Verify
  console.log('\n🔍 Verification...')
  
  const { data: verify } = await supabase
    .from('agents')
    .select('slug, tools, rag_enabled')
    .eq('tenant_id', 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2')
  
  for (const a of verify || []) {
    const hasKB = a.tools?.includes('knowledge_base') ? '✅' : '❌'
    const hasMeli = a.tools?.includes('meli_search') ? '⚠️ meli_search!' : '✅'
    console.log(`  ${a.slug}: rag=${a.rag_enabled ? 'Y' : 'N'} kb=${hasKB} ${hasMeli}`)
    console.log(`    tools: ${a.tools?.join(', ')}`)
  }

  console.log('\n✅ Migration 130 complete!')
}

applyMigration().catch(console.error)
