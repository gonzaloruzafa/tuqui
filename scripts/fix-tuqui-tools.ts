import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fix() {
  // Fix tuqui to have odoo tools
  const { error } = await supabase
    .from('agents')
    .update({ 
      tools: ['odoo', 'web_search', 'knowledge_base']
    })
    .eq('slug', 'tuqui')
    .eq('tenant_id', 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2')
  
  if (error) console.error('Error:', error)
  else console.log('✅ Fixed tuqui tools: odoo, web_search, knowledge_base')

  // Also fix master_agents
  const { error: error2 } = await supabase
    .from('master_agents')
    .update({ 
      tools: ['odoo', 'web_search', 'knowledge_base']
    })
    .eq('slug', 'tuqui')
  
  if (error2) console.error('Error master:', error2)
  else console.log('✅ Fixed master tuqui tools too')

  // Verify
  const { data } = await supabase
    .from('agents')
    .select('slug, tools')
    .eq('tenant_id', 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2')
  
  console.log('\nCurrent agents:')
  for (const a of data || []) {
    console.log(`  ${a.slug}: ${a.tools?.join(', ')}`)
  }
}

fix()
