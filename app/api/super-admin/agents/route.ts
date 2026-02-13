import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isPlatformAdmin } from '@/lib/platform/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    const session = await auth()

    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const supabase = supabaseAdmin()

        const { data: agents, error } = await supabase
            .from('master_agents')
            .select('id, slug, name, icon, is_published, tools')
            .order('sort_order', { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Get doc counts per agent
        const { data: docLinks } = await supabase
            .from('master_agent_documents')
            .select('master_agent_id')

        const docCounts: Record<string, number> = {}
        for (const link of docLinks || []) {
            docCounts[link.master_agent_id] = (docCounts[link.master_agent_id] || 0) + 1
        }

        const enriched = (agents || []).map(a => ({
            ...a,
            doc_count: docCounts[a.id] || 0
        }))

        return NextResponse.json(enriched)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
