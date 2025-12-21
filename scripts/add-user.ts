import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
    const email = process.argv[2]
    if (!email) {
        console.error('Usage: npx tsx scripts/add-user.ts <your-email>')
        process.exit(1)
    }

    console.log(`🔍 Adding user ${email} to "Cliente Adhoc"...`)

    const { getMasterClient } = await import('../lib/supabase/master')
    const master = getMasterClient()

    // 1. Find the Tenant
    const { data: tenant, error: tenantError } = await master
        .from('tenants')
        .select('id, name')
        .eq('slug', 'demo-company') // Was it demo-company or custom-slug? setup.ts used 'demo-company' initially then changed to 'demo-company' variable?? Wait, let me check setup.ts content.
        // Checking previous view_file of setup.ts... 
        // line 17: const tenantSlug = 'demo-company'
        // line 28: slug: tenantSlug
        .single()

    if (tenantError || !tenant) {
        console.error('❌ Tenant "demo-company" not found. Did you run setup.ts?', tenantError)
        process.exit(1)
    }

    // 2. Add User
    const { error: userError } = await master.from('users').upsert({
        tenant_id: tenant.id,
        email: email,
        name: 'New Admin',
        is_admin: true
    }, { onConflict: 'tenant_id, email' })

    if (userError) {
        console.error('❌ Failed to add user:', userError.message)
    } else {
        console.log(`✅ Success! User ${email} added to tenant "${tenant.name}".`)
        console.log('👉 Go to http://localhost:3000/login and try again.')
    }
}

main().catch(console.error)
