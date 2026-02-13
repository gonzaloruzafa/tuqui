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
        .select('id, slug, name, description, icon, system_prompt, welcome_message, placeholder_text, tools, is_published, sort_order')
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
    const allowed = ['name', 'description', 'system_prompt', 'welcome_message', 'placeholder_text', 'tools', 'is_published', 'icon']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
        if (key in body) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    // Get current version for manual bump
    const { data: current } = await supabase
        .from('master_agents')
        .select('version')
        .eq('slug', slug)
        .single()

    updates.version = (current?.version || 1) + 1

    const { data, error } = await supabase
        .from('master_agents')
        .update(updates)
        .eq('slug', slug)
        .select('id, slug, name')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}
