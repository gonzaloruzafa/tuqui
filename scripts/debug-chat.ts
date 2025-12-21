import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
    console.log('🔍 Debugging Chat/DB...')

    // Dynamic import to ensure dotenv loaded
    const { getTenantClient, getTenantForUser } = await import('../lib/supabase/tenant')
    const { searchDocuments } = await import('../lib/rag/search')

    // 1. Check Tenant Connection
    const email = 'gonza@adhoc.inc' // or whatever user
    // We need a valid tenant ID. Let's guess 'Cliente Adhoc' from setup.
    // Or just use the one from getTenantForUser if the user added themselves.
    // I'll try to find the tenant for the user I just added 'gr@adhoc.inc'
    const tenants = await getTenantForUser('gr@adhoc.inc')

    if (!tenants || tenants.length === 0) {
        // Fallback to finding tenant by slug
        console.log('User gr@adhoc.inc validation failed or no tenant found. Trying lookup by slug...')
    }

    // Let's just lookup the tenant directly from Master to get ID
    const { getMasterClient } = await import('../lib/supabase/master')
    const master = getMasterClient()
    const { data: tenant } = await master.from('tenants').select('id').eq('slug', 'demo-company').single()

    if (!tenant) {
        console.error('❌ Tenant demo-company not found in Master DB.')
        return
    }

    console.log('✅ Tenant found:', tenant.id)
    const db = await getTenantClient(tenant.id)

    // 2. Check Agents Table
    console.log('Checking "agents" table...')
    const { data: agents, error: agentsError } = await db.from('agents').select('*').limit(1)
    if (agentsError) {
        console.error('❌ Error accessing agents table:', agentsError.message)
        console.error('👉 CAUSE: Likely missing "supabase/tenant-schema.sql" execution in Tenant DB.')
        return
    }
    console.log('✅ Agents table accessible.')

    // 3. Check RPC match_documents
    console.log('Checking "match_documents" RPC...')
    const { error: rpcError } = await db.rpc('match_documents', {
        query_embedding: [0.1, 0.2, 0.3], // Dummy vector
        match_agent_id: 'dummy',
        match_count: 1
    })

    // We expect an error about vector dimensions or invalid input, but NOT "function not found"
    if (rpcError) {
        if (rpcError.message.includes('function match_documents') && rpcError.message.includes('does not exist')) {
            console.error('❌ RPC match_documents missing:', rpcError.message)
            console.error('👉 CAUSE: Did not run "supabase/tenant-schema.sql".')
            return
        }
        console.log('⚠️ RPC call error (expected with dummy data):', rpcError.message)
        console.log('✅ RPC exists (otherwise error would be "function does not exist").')
    } else {
        console.log('✅ RPC match_documents exists.')
    }

    // 4. Check Gemini Key
    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY is missing in .env.local')
    } else {
        console.log('✅ GEMINI_API_KEY is present.')
    }

    console.log('🎉 Debug complete.')
}

main().catch(console.error)
