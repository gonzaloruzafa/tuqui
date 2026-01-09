
import { getTenantClient } from '../lib/supabase/client'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const TEST_TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

async function inspectMeliAgent() {
    const db = await getTenantClient(TEST_TENANT_ID)
    const { data: meli } = await db.from('agents').select('*').eq('slug', 'meli').single()
    
    if (meli) {
        console.log('--- MELI AGENT INFO ---')
        console.log('Slug:', meli.slug)
        console.log('System Prompt:', meli.system_prompt)
        console.log('Tools:', meli.tools)
    } else {
        console.log('Meli agent not found')
    }
}

inspectMeliAgent().catch(console.error)
