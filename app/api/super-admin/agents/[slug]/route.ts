import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isPlatformAdmin } from '@/lib/platform/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { slug } = await params
    const supabase = supabaseAdmin()

    const { data: agent, error } = await supabase
        .from('master_agents')
        .select('id, slug, name, description, icon, color, system_prompt, welcome_message, placeholder_text, tools, is_published, sort_order')
        .eq('slug', slug)
        .single()

    if (error || !agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json(agent)
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { slug } = await params
    const body = await req.json()

    const supabase = supabaseAdmin()

    // Only allow updating safe fields
    const allowed = ['name', 'description', 'system_prompt', 'welcome_message', 'placeholder_text', 'tools', 'is_published', 'icon', 'slug', 'color', 'sort_order']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
        if (key in body) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Validate slug format if changing
    if (updates.slug && !/^[a-z][a-z0-9_-]{1,48}$/.test(updates.slug)) {
        return NextResponse.json({ error: 'Slug inválido (lowercase, hyphens, 2-49 chars)' }, { status: 400 })
    }

    // Check slug uniqueness if changing
    if (updates.slug && updates.slug !== slug) {
        const { data: existing } = await supabase.from('master_agents').select('id').eq('slug', updates.slug).single()
        if (existing) {
            return NextResponse.json({ error: `El slug "${updates.slug}" ya existe` }, { status: 409 })
        }
    }

    updates.updated_at = new Date().toISOString()

    // Get current agent by slug (need id for WHERE in case slug changes)
    const { data: current } = await supabase
        .from('master_agents')
        .select('id, version')
        .eq('slug', slug)
        .single()

    if (!current) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    updates.version = (current.version || 1) + 1

    const { data, error } = await supabase
        .from('master_agents')
        .update(updates)
        .eq('id', current.id)
        .select('id, slug, name')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { slug } = await params
    const supabase = supabaseAdmin()

    const { data: agent } = await supabase
        .from('master_agents')
        .select('id')
        .eq('slug', slug)
        .single()

    if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Delete linked docs first (M2M + master_documents + chunks cascade)
    const { data: docLinks } = await supabase
        .from('master_agent_documents')
        .select('document_id')
        .eq('master_agent_id', agent.id)

    if (docLinks?.length) {
        const docIds = docLinks.map(d => d.document_id)
        await supabase.from('master_agent_documents').delete().eq('master_agent_id', agent.id)
        await supabase.from('master_document_chunks').delete().in('document_id', docIds)
        await supabase.from('master_documents').delete().in('id', docIds)
    }

    // Delete tenant agents that reference this master
    await supabase
        .from('agents')
        .delete()
        .eq('master_agent_id', agent.id)

    // Delete the master agent
    const { error } = await supabase
        .from('master_agents')
        .delete()
        .eq('id', agent.id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
