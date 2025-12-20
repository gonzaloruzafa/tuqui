import { v4 as uuidv4 } from 'uuid'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
    console.log('🚀 Starting Tuqui Agents Setup...')

    // Dynamic imports to ensure dotenv is loaded before lib files read process.env
    const { getMasterClient } = await import('../lib/supabase/master')
    const { getTenantClient, getTenantConfig } = await import('../lib/supabase/tenant')

    const master = getMasterClient()

    // 1. Create Demo Tenant in Master
    console.log('Step 1: Creating Demo Tenant in Master DB...')

    const tenantId = uuidv4()
    const tenantSlug = 'demo-company'

    // NOTE: User must replace these with REAL Supabase credentials for the Tenant DB
    // For Alpha, we can reuse the Master DB credentials if we just want to test isolation logic 
    // (using same DB but different tables... wait, my design assumes different connection params)
    // If user has only one Supabase project, they can use same URL/Key for both Master and Tenant 
    // but logically treat them as separate.

    const { error } = await master.from('tenants').upsert({
        id: tenantId,
        name: 'Cliente Adhoc',
        slug: tenantSlug,
        supabase_url: process.env.INITIAL_TENANT_URL!,
        supabase_anon_key: process.env.INITIAL_TENANT_ANON_KEY!,
        supabase_service_key: process.env.INITIAL_TENANT_SERVICE_KEY!,
        is_active: true,
        twilio_phone: process.env.TWILIO_WHATSAPP_NUMBER
    }, { onConflict: 'slug' })

    if (error) {
        console.error('Failed to create tenant:', error)
        process.exit(1)
    }
    console.log('✅ Tenant created/updated')

    // 2. Create Admin User
    console.log('Step 2: Creating Admin User...')
    const email = 'demo@adhoc.inc' // Replace with your google email to login!

    const { error: userError } = await master.from('users').upsert({
        tenant_id: tenantId,
        email: email,
        name: 'Demo Admin',
        is_admin: true
    }, { onConflict: 'tenant_id, email' })

    if (userError) {
        console.error('Failed to create user:', userError)
    } else {
        console.log('✅ User created. Login with:', email)
    }

    // 3. Seed Tenant DB
    // Since we reused Master creds, we are connecting to same DB but logic flows through tenant client
    console.log('Step 3: Seeding Tenant DB (Agents)...')
    const tenantDB = await getTenantClient(tenantId)

    // Agents table should exist (need to run tenant-schema.sql manually or here)
    // We can't run SQL from client easily without postgres connection or SQL endpoint
    // Assuming user ran SQL migrations via Supabase Dashboard.

    // Insert a custom agent
    const { error: agentError } = await tenantDB.from('agents').upsert({
        slug: 'custom-hr',
        name: 'Tuqui HR',
        description: 'Asistente de Recursos Humanos',
        system_prompt: 'Sos un asistente de RRHH.',
        is_active: true
    }, { onConflict: 'slug' })

    if (agentError) {
        console.warn('⚠️ Could not seed agents (Maybe table missing? Run tenant-schema.sql):', agentError.message)
    } else {
        console.log('✅ Custom agent seeded')
    }

    console.log('\n🎉 Setup Complete!')
    console.log('IMPORTANT: Run SQL migrations from "supabase/master-schema.sql" and "supabase/tenant-schema.sql" in your Supabase Dashboard SQL Editor first.')
    console.log(`Add your Google Email to "users" table if you want to login with a different email.`)
}

main().catch(console.error)
