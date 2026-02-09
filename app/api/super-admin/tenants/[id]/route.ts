import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isPlatformAdmin } from '@/lib/platform/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const supabase = supabaseAdmin()
    const currentMonth = new Date().toISOString().slice(0, 7)

    const [tenantRes, usersRes, agentsRes, usageRes] = await Promise.all([
        supabase.from('tenants').select('*').eq('id', id).single(),
        supabase.from('users').select('id, email, name, is_admin, created_at').eq('tenant_id', id),
        supabase.from('agents').select('slug, name, is_active, master_agent_id, master_version_synced, custom_instructions').eq('tenant_id', id),
        supabase.from('usage_stats').select('user_email, total_tokens, total_requests').eq('tenant_id', id).eq('year_month', currentMonth),
    ])

    if (tenantRes.error) {
        return NextResponse.json({ error: tenantRes.error.message }, { status: 404 })
    }

    return NextResponse.json({
        tenant: tenantRes.data,
        users: usersRes.data || [],
        agents: agentsRes.data || [],
        usage: usageRes.data || [],
    })
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const supabase = supabaseAdmin()

    // Only allow updating specific fields
    const allowedFields = ['name', 'is_active']
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
        if (field in body) updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

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
