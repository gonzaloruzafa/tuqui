import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isPlatformAdmin } from '@/lib/platform/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const supabase = supabaseAdmin()
    const currentMonth = new Date().toISOString().slice(0, 7)

    try {
        const [tenantResult, usersResult, agentsResult, usageResult] = await Promise.all([
            supabase.from('tenants').select('*').eq('id', id).single(),
            supabase.from('users').select('id, email, name, is_admin, auth_user_id, created_at').eq('tenant_id', id).order('is_admin', { ascending: false }),
            supabase.from('agents').select('slug, name, is_active, master_agent_id, custom_instructions, master_version_synced, last_synced_at').eq('tenant_id', id).order('name'),
            supabase.from('usage_stats').select('user_email, total_tokens, total_requests').eq('tenant_id', id).eq('year_month', currentMonth),
        ])

        if (tenantResult.error || !tenantResult.data) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
        }

        // Build usage lookup by email
        const usageByEmail: Record<string, { tokens: number; requests: number }> = {}
        for (const u of usageResult.data || []) {
            usageByEmail[u.user_email] = {
                tokens: (usageByEmail[u.user_email]?.tokens || 0) + u.total_tokens,
                requests: (usageByEmail[u.user_email]?.requests || 0) + u.total_requests,
            }
        }

        const totalTokens = Object.values(usageByEmail).reduce((sum, u) => sum + u.tokens, 0)
        const totalRequests = Object.values(usageByEmail).reduce((sum, u) => sum + u.requests, 0)

        return NextResponse.json({
            tenant: tenantResult.data,
            users: (usersResult.data || []).map(u => ({
                ...u,
                tokens_this_month: usageByEmail[u.email]?.tokens || 0,
                requests_this_month: usageByEmail[u.email]?.requests || 0,
            })),
            agents: agentsResult.data || [],
            usage: { totalTokens, totalRequests },
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const supabase = supabaseAdmin()

    // Only allow updating name and is_active
    const updates: Record<string, any> = {}
    if (typeof body.name === 'string') updates.name = body.name
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

/**
 * DELETE /api/super-admin/tenants/[id]
 * Delete a tenant and all its data (super-admin only)
 * Cascade: auth users → public.users → agents → conversations → tenant
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const supabase = supabaseAdmin()

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('id', id)
        .single()

    if (tenantError || !tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Get all users to delete from auth
    const { data: users } = await supabase
        .from('users')
        .select('auth_user_id')
        .eq('tenant_id', id)

    // Delete auth users (best-effort, don't fail if some fail)
    for (const user of users || []) {
        if (user.auth_user_id) {
            const { error } = await supabase.auth.admin.deleteUser(user.auth_user_id)
            if (error) console.error(`[SuperAdmin] Failed to delete auth user ${user.auth_user_id}:`, error)
        }
    }

    // Delete tenant data in order (FK constraints)
    // Conversations/messages, usage_stats, documents, integrations, push_subscriptions, users, agents, tenant
    const tablesToClean = [
        'conversation_messages', 'conversations', 'usage_stats',
        'documents', 'integrations', 'push_subscriptions',
        'notifications', 'users', 'agents',
    ]

    for (const table of tablesToClean) {
        const { error } = await supabase.from(table).delete().eq('tenant_id', id)
        if (error) console.error(`[SuperAdmin] Failed to clean ${table} for tenant ${id}:`, error)
    }

    // Finally delete the tenant itself
    const { error: deleteError } = await supabase.from('tenants').delete().eq('id', id)

    if (deleteError) {
        return NextResponse.json({ error: `Failed to delete tenant: ${deleteError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: tenant.name })
}
