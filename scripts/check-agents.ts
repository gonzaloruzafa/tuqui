import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  const { data } = await supabase
    .from('agents')
    .select('slug, tools, system_prompt')
    .eq('tenant_id', 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2')
  
  for (const a of data || []) {
    console.log(`${a.slug}: ${JSON.stringify(a.tools)}`)
    if (a.system_prompt?.includes('odoo_intelligent_query')) {
      console.log('  ⚠️  System prompt mentions odoo_intelligent_query!')
    }
  }
}

check()
