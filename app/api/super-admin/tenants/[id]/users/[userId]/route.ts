import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { isPlatformAdmin } from '@/lib/platform/auth'
import { supabaseAdmin } from '@/lib/supabase'

type Params = { params: Promise<{ id: string; userId: string }> }

/**
 * PATCH /api/super-admin/tenants/[id]/users/[userId]
 * Change user password (super-admin only)
 */
export async function PATCH(req: Request, { params }: Params) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id: tenantId, userId } = await params
    const { password } = await req.json()

    if (!password || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const supabase = supabaseAdmin()

    // Verify user belongs to this tenant
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, auth_user_id')
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .single()

    if (userError || !user) {
        return NextResponse.json({ error: 'User not found in this tenant' }, { status: 404 })
    }

    if (!user.auth_user_id) {
        return NextResponse.json({ error: 'User has no auth account (Google login only?)' }, { status: 400 })
    }

    // Update password in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(
        user.auth_user_id,
        { password }
    )

    if (authError) {
        return NextResponse.json({ error: `Failed to update password: ${authError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

/**
 * DELETE /api/super-admin/tenants/[id]/users/[userId]
 * Delete a user from tenant (super-admin only)
 */
export async function DELETE(req: Request, { params }: Params) {
    const session = await auth()
    if (!await isPlatformAdmin(session?.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id: tenantId, userId } = await params
    const supabase = supabaseAdmin()

    // Verify user belongs to this tenant
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, auth_user_id, is_admin')
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .single()

    if (userError || !user) {
        return NextResponse.json({ error: 'User not found in this tenant' }, { status: 404 })
    }

    // Don't allow deleting the last admin
    if (user.is_admin) {
        const { count } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('is_admin', true)

        if ((count || 0) <= 1) {
            return NextResponse.json({ error: 'Cannot delete the last admin of a tenant' }, { status: 400 })
        }
    }

    // Delete user's data: conversations, memories, notifications, etc.
    const userEmail = user.email
    const tablesToClean = [
        { table: 'chat_sessions', column: 'user_email', value: userEmail },
        { table: 'usage_stats', column: 'user_email', value: userEmail },
        { table: 'push_subscriptions', column: 'user_email', value: userEmail },
        { table: 'notifications', column: 'user_email', value: userEmail },
    ]

    for (const { table, column, value } of tablesToClean) {
        const { error } = await supabase.from(table).delete().eq(column, value).eq('tenant_id', tenantId)
        if (error) console.error(`[SuperAdmin] Failed to clean ${table} for user ${userEmail}:`, error)
    }

    // Delete memories (uses created_by UUID, not email)
    if (user.auth_user_id) {
        const { error } = await supabase.from('memories').delete().eq('created_by', user.auth_user_id).eq('tenant_id', tenantId)
        if (error) console.error(`[SuperAdmin] Failed to clean memories for user ${userEmail}:`, error)
    }

    // Delete from public.users first
    const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)
        .eq('tenant_id', tenantId)

    if (deleteError) {
        return NextResponse.json({ error: `Failed to delete user: ${deleteError.message}` }, { status: 500 })
    }

    // Delete from auth.users if they have an auth account
    if (user.auth_user_id) {
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.auth_user_id)
        if (authDeleteError) {
            console.error(`[SuperAdmin] Failed to delete auth user ${user.auth_user_id}:`, authDeleteError)
            // Don't fail the request — public.users is already deleted
        }
    }

    return NextResponse.json({ success: true })
}
