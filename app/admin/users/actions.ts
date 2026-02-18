'use server'

import { auth } from '@/lib/auth/config'
import { getClient } from '@/lib/supabase/client'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { saveUserProfile, getUserProfile } from '@/lib/user/profile'

// Get Supabase Admin client for auth operations
function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

/** Check if session.user (auth UUID) matches the users table row */
async function checkIsSelf(tenantId: string, authUserId: string, tableUserId: string): Promise<boolean> {
    const db = getClient()
    const { data } = await db
        .from('users')
        .select('id')
        .eq('id', tableUserId)
        .eq('auth_user_id', authUserId)
        .eq('tenant_id', tenantId)
        .single()
    return !!data
}

export async function createUser(formData: FormData) {
    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) {
        throw new Error('No autorizado')
    }

    const email = (formData.get('email') as string)?.toLowerCase().trim()
    const name = formData.get('name') as string
    const whatsapp_phone = formData.get('whatsapp_phone') as string
    const is_admin = formData.get('is_admin') === 'on'
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirm_password') as string

    if (!email) throw new Error('Email es requerido')

    // Validate passwords if provided
    if (password) {
        if (password.length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres')
        }
        if (password !== confirmPassword) {
            throw new Error('Las contraseñas no coinciden')
        }
    }

    const db = getClient()
    let authUserId: string | null = null

    // If password provided, create auth account first
    if (password) {
        const supabaseAdmin = getSupabaseAdmin()
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })

        if (authError) {
            console.error('Error creating auth user:', authError)
            throw new Error('Error al crear cuenta: ' + authError.message)
        }

        authUserId = authUser.user?.id || null
    }

    // Create user in our table
    const { error } = await db
        .from('users')
        .insert({
            email,
            name: name || null,
            whatsapp_phone: whatsapp_phone || null,
            is_admin,
            tenant_id: session.tenant.id,
            auth_user_id: authUserId
        })

    if (error) {
        console.error('Error creating user:', error)
        throw new Error('Error al crear usuario: ' + error.message)
    }

    revalidatePath('/admin/users')
    redirect('/admin/users')
}

export async function addUser(formData: FormData) {
    console.log('🚀 Starting addUser action')
    try {
        const session = await auth()
        if (!session?.tenant?.id || !session.isAdmin) {
            console.error('❌ Unauthorized attempt to add user')
            throw new Error('No autorizado')
        }

        const email = (formData.get('email') as string)?.toLowerCase().trim()
        const is_admin = formData.get('role') === 'admin'

        if (!email) throw new Error('Email es requerido')

        console.log(`👤 Adding user ${email} to tenant ${session.tenant.id}`)

        const db = getClient()
        const { error } = await db
            .from('users')
            .upsert({
                email,
                tenant_id: session.tenant.id,
                is_admin
            }, { onConflict: 'tenant_id, email' })

        if (error) {
            console.error('❌ Supabase error adding user:', error)
            throw new Error('Error al agregar usuario: ' + error.message)
        }

        console.log('✅ User added successfully')
        revalidatePath('/admin/users')
    } catch (e: any) {
        console.error('🔥 Server Action Error (addUser):', e)
        throw e // Re-throw to be caught by the action handler, but now we have logs
    }
}

export async function deleteUser(userId: string) {
    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) {
        throw new Error('No autorizado')
    }

    const db = getClient()

    // Safety check: Don't let users delete themselves
    if (userId === session.user?.id) {
        throw new Error('No puedes eliminarte a ti mismo')
    }

    const { error } = await db
        .from('users')
        .delete()
        .eq('id', userId)
        .eq('tenant_id', session.tenant.id) // Security: only delete from own tenant

    if (error) {
        console.error('Error deleting user:', error)
        throw new Error('Error al eliminar usuario')
    }

    revalidatePath('/admin/users')
}

export async function updateUserRole(userId: string, isAdmin: boolean) {
    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) {
        throw new Error('No autorizado')
    }

    const db = getClient()
    const { error } = await db
        .from('users')
        .update({ is_admin: isAdmin })
        .eq('id', userId)
        .eq('tenant_id', session.tenant.id)

    if (error) {
        console.error('Error updating user role:', error)
        throw new Error('Error al actualizar rol')
    }

    revalidatePath('/admin/users')
}

export async function updateUserPhone(userId: string, whatsappPhone: string) {
    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) {
        throw new Error('No autorizado')
    }

    const db = getClient()
    const { error } = await db
        .from('users')
        .update({ whatsapp_phone: whatsappPhone || null })
        .eq('id', userId)
        .eq('tenant_id', session.tenant.id)

    if (error) {
        console.error('Error updating user phone:', error)
        throw new Error('Error al actualizar teléfono')
    }

    revalidatePath('/admin/users')
}

export async function getUserById(userId: string) {
    const session = await auth()
    if (!session?.tenant?.id) {
        throw new Error('No autorizado')
    }

    // Allow non-admins to view their own profile
    // session.user.id is the auth UUID, userId is the users table UUID — compare via DB
    const isSelf = !session.isAdmin && session.user?.id
        ? await checkIsSelf(session.tenant.id, session.user.id, userId)
        : false
    if (!session.isAdmin && !isSelf) {
        throw new Error('No autorizado')
    }

    const db = getClient()
    const { data, error } = await db
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('tenant_id', session.tenant.id)
        .single()

    if (error) {
        console.error('Error fetching user:', error)
        throw new Error('Usuario no encontrado')
    }

    return data
}

/** Get user profile data (display_name, role_title, area, bio, interests) */
export async function getUserProfileData(userId: string) {
    const session = await auth()
    if (!session?.tenant?.id) return null

    const isSelf = session.user?.id ? await checkIsSelf(session.tenant.id, session.user.id, userId) : false
    if (!session.isAdmin && !isSelf) return null

    return getUserProfile(session.tenant.id, userId)
}

/** Save profile section (accessible by owner or admin) */
export async function saveProfileAction(userId: string, formData: FormData) {
    const session = await auth()
    if (!session?.tenant?.id) throw new Error('No autorizado')

    const isSelf = session.user?.id ? await checkIsSelf(session.tenant.id, session.user.id, userId) : false
    if (!session.isAdmin && !isSelf) throw new Error('No autorizado')

    const result = await saveUserProfile(session.tenant.id, userId, {
        display_name: formData.get('display_name') as string || undefined,
        role_title: formData.get('role_title') as string || undefined,
        area: formData.get('area') as string || undefined,
        bio: formData.get('bio') as string || undefined,
        interests: formData.get('interests') as string || undefined,
    })

    if (!result) throw new Error('Error al guardar perfil')

    revalidatePath(`/admin/users/${userId}`)
    revalidatePath('/admin/users')
}

export async function updateUser(userId: string, formData: FormData) {
    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) {
        throw new Error('No autorizado')
    }

    const name = formData.get('name') as string
    const whatsapp_phone = formData.get('whatsapp_phone') as string
    const is_admin = formData.get('is_admin') === 'on'

    const db = getClient()
    const { error } = await db
        .from('users')
        .update({ 
            name: name || null,
            whatsapp_phone: whatsapp_phone || null,
            is_admin 
        })
        .eq('id', userId)
        .eq('tenant_id', session.tenant.id)

    if (error) {
        console.error('Error updating user:', error)
        throw new Error('Error al actualizar usuario')
    }

    revalidatePath(`/admin/users/${userId}`)
    revalidatePath('/admin/users')
}

export async function adminSetPassword(userId: string, formData: FormData) {
    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) {
        throw new Error('No autorizado')
    }

    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirm_password') as string

    // Validation
    if (!password || password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres')
    }

    if (password !== confirmPassword) {
        throw new Error('Las contraseñas no coinciden')
    }

    // Get user to find auth_user_id
    const db = getClient()
    const { data: user, error: userError } = await db
        .from('users')
        .select('auth_user_id, email')
        .eq('id', userId)
        .eq('tenant_id', session.tenant.id)
        .single()

    if (userError || !user) {
        throw new Error('Usuario no encontrado')
    }

    const supabaseAdmin = getSupabaseAdmin()

    // If user has auth_user_id, update their password
    if (user.auth_user_id) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
            user.auth_user_id,
            { password }
        )

        if (error) {
            console.error('Error setting password:', error)
            throw new Error('Error al cambiar contraseña: ' + error.message)
        }
    } else {
        // User doesn't have auth account yet - create one
        const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: user.email,
            password,
            email_confirm: true, // Auto-confirm email
        })

        if (createError) {
            console.error('Error creating auth user:', createError)
            throw new Error('Error al crear cuenta: ' + createError.message)
        }

        // Link the auth user to our users table
        if (authUser.user) {
            await db
                .from('users')
                .update({ auth_user_id: authUser.user.id })
                .eq('id', userId)
                .eq('tenant_id', session.tenant.id)
        }
    }

    revalidatePath(`/admin/users/${userId}`)
}