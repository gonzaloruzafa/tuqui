import { supabaseAdmin } from '@/lib/supabase'

interface CreateTenantParams {
    name: string
    adminEmail: string
    adminPassword: string
}

export async function createTenant(params: CreateTenantParams) {
    const supabase = supabaseAdmin()

    try {
        console.log(`[Tenants] Creating tenant: ${params.name}`)

        // 1. Create tenant
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .insert({ name: params.name })
            .select()
            .single()

        if (tenantError) throw tenantError

        console.log(`[Tenants] Tenant created: ${tenant.id}`)

        // 2. Clone master agents to this tenant
        const { data: masters, error: mastersError } = await supabase
            .from('master_agents')
            .select('*')

        if (mastersError) throw mastersError

        if (masters && masters.length > 0) {
            const agentsToInsert = masters.map(m => ({
                tenant_id: tenant.id,
                master_agent_id: m.id,
                slug: m.slug,
                name: m.name,
                icon: m.icon,
                system_prompt: m.system_prompt,
                tools: m.tools,
                placeholder_text: m.placeholder_text,
                welcome_message: m.welcome_message
            }))

            const { error: agentsError } = await supabase
                .from('agents')
                .insert(agentsToInsert)

            if (agentsError) throw agentsError

            console.log(`[Tenants] Cloned ${masters.length} agents from masters`)
        }

        // 3. Create admin user in Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: params.adminEmail,
            password: params.adminPassword,
            email_confirm: true,
            user_metadata: {
                tenant_id: tenant.id,
                is_admin: true
            }
        })

        if (authError) throw authError

        console.log(`[Tenants] Auth user created: ${authData.user.id}`)

        // 4. Insert user record
        const { error: userError } = await supabase.from('users').insert({
            id: authData.user.id,
            tenant_id: tenant.id,
            email: params.adminEmail,
            is_admin: true
        })

        if (userError) throw userError

        console.log(`[Tenants] User record created for ${params.adminEmail}`)

        return { success: true, tenant }

    } catch (error: any) {
        console.error('[Tenants] Error creating tenant:', error)
        throw new Error(`Failed to create tenant: ${error.message}`)
    }
}

export async function syncAgentsFromMasters() {
    const supabase = supabaseAdmin()

    console.log('[Tenants] Starting sync of agents from master_agents...')

    try {
        const { error } = await supabase.rpc('sync_agents_from_masters')

        if (error) {
            console.error('[Tenants] Sync error:', error)
            throw error
        }

        console.log('[Tenants] Sync completed successfully')
        return { success: true }
    } catch (error: any) {
        console.error('[Tenants] Sync failed:', error)
        throw new Error(`Sync failed: ${error.message}`)
    }
}
