import { auth } from '@/lib/auth/config'
import { discoverUserProfile } from '@/lib/user/discovery'
import { getClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.tenant?.id || !session.user?.email) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const targetUserId = req.nextUrl.searchParams.get('userId')
  if (!targetUserId) {
    return NextResponse.json({ success: false, error: 'userId requerido' }, { status: 400 })
  }

  // Check permission: admin can discover any user, non-admin only self
  // session.user.id is the auth UUID, targetUserId is the users table UUID
  const db = getClient()
  const { data: targetUser } = await db
    .from('users')
    .select('name, email, auth_user_id')
    .eq('id', targetUserId)
    .eq('tenant_id', session.tenant.id)
    .single()

  const isSelf = targetUser?.auth_user_id === session.user.id
  if (!session.isAdmin && !isSelf) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
  }

  // Use explicit odooName override if provided, otherwise fallback chain
  const odooNameOverride = req.nextUrl.searchParams.get('odooName')
  let searchName = odooNameOverride || targetUser?.name
  if (!searchName) {
    const { data: profile } = await db
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', targetUserId)
      .eq('tenant_id', session.tenant.id)
      .single()
    searchName = profile?.display_name
  }
  if (!searchName && targetUser?.email) {
    searchName = targetUser.email.split('@')[0].replace(/[._-]/g, ' ')
  }
  if (!searchName) {
    return NextResponse.json({ success: false, error: 'No se pudo determinar el nombre del usuario' })
  }

  const result = await discoverUserProfile(
    session.tenant.id,
    session.user.email,
    searchName
  )

  if (!result) {
    return NextResponse.json({
      success: false,
      notFound: true,
      error: `No se encontró "${searchName}" en Odoo.`,
    })
  }

  return NextResponse.json({ success: true, data: result })
}
