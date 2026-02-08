import { supabaseAdmin } from '@/lib/supabase'
import { generateSlug } from '@/lib/platform/slugs'

interface CreateTenantParams {
    name: string
    slug?: string
    adminEmail: string
    adminPassword: string
    selectedAgentSlugs?: string[]
}

export async function createTenant(params: CreateTenantParams) {
    const supabase = supabaseAdmin()
    const slug = params.slug || generateSlug(params.name)

    // 1. Create tenant
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({ name: params.name, slug })
        .select()
        .single()

    if (tenantError) throw new Error(`Failed to create tenant: ${tenantError.message}`)

    // 2. Clone master agents to this tenant
    let masterQuery = supabase.from('master_agents').select('*')

    if (params.selectedAgentSlugs?.length) {
        masterQuery = masterQuery.in('slug', params.selectedAgentSlugs)
    }

    const { data: masters, error: mastersError } = await masterQuery
    if (mastersError) throw new Error(`Failed to fetch masters: ${mastersError.message}`)

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

        if (agentsError) throw new Error(`Failed to clone agents: ${agentsError.message}`)
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

    if (authError) throw new Error(`Failed to create auth user: ${authError.message}`)

    // 4. Insert user record
    const { error: userError } = await supabase.from('users').insert({
        id: authData.user.id,
        tenant_id: tenant.id,
        email: params.adminEmail,
        is_admin: true
    })

    if (userError) throw new Error(`Failed to create user record: ${userError.message}`)

    return { success: true, tenant }
}

export async function syncAgentsFromMasters() {
    const supabase = supabaseAdmin()

    const { error } = await supabase.rpc('sync_agents_from_masters')
    if (error) throw new Error(`Sync failed: ${error.message}`)

    return { success: true }
}
