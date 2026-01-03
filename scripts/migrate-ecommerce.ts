/**
 * Migration script for ecommerce_search tool
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://krztsxhnolponajenjtz.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function migrate() {
    console.log('🔧 Migrating to ecommerce_search tool...')
    console.log(`URL: ${SUPABASE_URL}`)
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. Check current MeLi agent
    const { data: current, error: checkErr } = await supabase
        .from('master_agents')
        .select('slug, tools')
        .eq('slug', 'meli')
        .single()
    
    if (checkErr) {
        console.error('Error checking MeLi:', checkErr)
        return
    }
    console.log('Current MeLi config:', current)
    
    // 2. Update MeLi agent tools
    const { data: meli, error: meliErr } = await supabase
        .from('master_agents')
        .update({ 
            tools: ['ecommerce_search']
        })
        .eq('slug', 'meli')
        .select('slug, tools')
    
    if (meliErr) {
        console.error('Error updating MeLi:', meliErr)
        return
    }
    console.log('✅ MeLi agent updated:', meli)
    
    // 3. Sync to tenants
    const { error: syncErr } = await supabase.rpc('sync_agents_from_masters')
    if (syncErr) {
        console.error('Error syncing:', syncErr)
        // Continue anyway
    } else {
        console.log('✅ Agents synced to tenants')
    }
    
    // 4. Verify
    const { data: verify } = await supabase
        .from('agents')
        .select('slug, tools, tenant_id')
        .eq('slug', 'meli')
        .limit(3)
    
    console.log('Verification - tenant agents:', verify)
}

migrate().then(() => {
    console.log('✅ Migration complete')
    process.exit(0)
}).catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
})
