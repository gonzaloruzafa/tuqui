import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { supabaseAdmin } from '@/lib/supabase'
import { createTenant, syncAgentsFromMasters } from '@/lib/tenants/service'

// Platform admins - use env var or hardcode for now
const PLATFORM_ADMINS = (process.env.PLATFORM_ADMIN_EMAILS || 'gr@adhoc.inc').split(',')

function isPlatformAdmin(email?: string | null): boolean {
    return !!email && PLATFORM_ADMINS.includes(email)
}

export async function GET() {
    const session = await auth()

    if (!isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = supabaseAdmin()
    const { data: tenants, error } = await supabase
        .from('tenants')
        .select(`
            id,
            name,
            created_at,
            users!inner(email, is_admin)
        `)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(tenants || [])
}

export async function POST(req: Request) {
    const session = await auth()

    if (!isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const { name, adminEmail, adminPassword, action } = body

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

        const result = await createTenant({ name, adminEmail, adminPassword })
        return NextResponse.json(result)

    } catch (error: any) {
        console.error('[API] Tenant operation error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
