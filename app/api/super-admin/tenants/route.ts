import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isPlatformAdmin } from '@/lib/platform/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { createTenant, syncAgentsFromMasters } from '@/lib/tenants/service'

export async function GET() {
    const session = await auth()

    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const supabase = supabaseAdmin()
        const currentMonth = new Date().toISOString().slice(0, 7)

        const { data: tenants, error } = await supabase
            .from('tenants')
            .select(`
                id,
                name,
                slug,
                is_active,
                created_at
            `)
            .order('created_at', { ascending: false })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Fetch metrics in parallel
        const tenantIds = (tenants || []).map(t => t.id)

        const [usersResult, usageResult] = await Promise.all([
            supabase.from('users').select('tenant_id').in('tenant_id', tenantIds),
            supabase.from('usage_stats').select('tenant_id, total_tokens, total_requests').in('tenant_id', tenantIds).eq('year_month', currentMonth),
        ])

        const userCounts: Record<string, number> = {}
        for (const u of usersResult.data || []) {
            userCounts[u.tenant_id] = (userCounts[u.tenant_id] || 0) + 1
        }

        const tokenCounts: Record<string, number> = {}
        const messageCounts: Record<string, number> = {}
        for (const s of usageResult.data || []) {
            tokenCounts[s.tenant_id] = (tokenCounts[s.tenant_id] || 0) + s.total_tokens
            messageCounts[s.tenant_id] = (messageCounts[s.tenant_id] || 0) + s.total_requests
        }

        const enriched = (tenants || []).map(t => ({
            ...t,
            user_count: userCounts[t.id] || 0,
            tokens_this_month: tokenCounts[t.id] || 0,
            messages_this_month: messageCounts[t.id] || 0,
        }))

        return NextResponse.json(enriched)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await auth()

    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const { name, slug, adminEmail, adminPassword, selectedAgentSlugs, action } = body

        // Handle sync action
        if (action === 'sync_masters') {
            await syncAgentsFromMasters()
            return NextResponse.json({ success: true, message: 'Agents synced from masters' })
        }

        // Handle create tenant
        if (!name || !adminEmail || !adminPassword) {
            return NextResponse.json(
                { error: 'Missing required fields: name, adminEmail, adminPassword' },
                { status: 400 }
            )
        }

        const result = await createTenant({ name, slug, adminEmail, adminPassword, selectedAgentSlugs })
        return NextResponse.json(result)

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
