import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { slug, name, system_prompt } = body

    if (!slug || !name || !system_prompt) {
        return NextResponse.json({ error: 'slug, name y system_prompt son requeridos' }, { status: 400 })
    }

    if (!/^[a-z][a-z0-9_-]{1,48}$/.test(slug)) {
        return NextResponse.json({ error: 'Slug inválido (lowercase, hyphens, 2-49 chars, empieza con letra)' }, { status: 400 })
    }

    const supabase = supabaseAdmin()

    const { data: existing } = await supabase.from('master_agents').select('id').eq('slug', slug).single()
    if (existing) {
        return NextResponse.json({ error: `El slug "${slug}" ya existe` }, { status: 409 })
    }

    const insert: Record<string, any> = { slug, name, system_prompt }
    const optional = ['description', 'icon', 'color', 'welcome_message', 'placeholder_text', 'tools', 'is_published', 'sort_order']
    for (const key of optional) {
        if (key in body) insert[key] = body[key]
    }

    const { data, error } = await supabase
        .from('master_agents')
        .insert(insert)
        .select('id, slug, name')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}
