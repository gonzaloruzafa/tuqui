import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isPlatformAdmin } from '@/lib/platform/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/super-admin/tenants/[id]/users
 * Create a new user for a tenant (super-admin only)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id: tenantId } = await params
    const { email, password, is_admin = false } = await req.json()

    if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    if (!password || password.length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const supabase = supabaseAdmin()

    // Verify tenant exists
    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .single()

    if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Check if email already exists in this tenant
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', email)
        .single()

    if (existing) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese email en este tenant' }, { status: 409 })
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })

    if (authError) {
        return NextResponse.json({ error: `Error al crear cuenta: ${authError.message}` }, { status: 500 })
    }

    // Create in public.users
    const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
            email,
            tenant_id: tenantId,
            is_admin,
            auth_user_id: authUser.user?.id || null,
        })
        .select()
        .single()

    if (userError) {
        // Rollback: delete auth user if public.users insert fails
        if (authUser.user?.id) {
            await supabase.auth.admin.deleteUser(authUser.user.id)
        }
        return NextResponse.json({ error: `Error al crear usuario: ${userError.message}` }, { status: 500 })
    }

    return NextResponse.json(user, { status: 201 })
}
