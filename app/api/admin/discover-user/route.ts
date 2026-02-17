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
  const isSelf = session.user.id === targetUserId
  if (!session.isAdmin && !isSelf) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
  }

  // Get target user email
  const db = getClient()
  const { data: targetUser } = await db
    .from('users')
    .select('email')
    .eq('id', targetUserId)
    .eq('tenant_id', session.tenant.id)
    .single()

  if (!targetUser?.email) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
  }

  const result = await discoverUserProfile(
    session.tenant.id,
    session.user.email,
    targetUser.email
  )

  if (!result) {
    return NextResponse.json({
      success: false,
      error: 'No se encontró al usuario en Odoo. Verificá que el email coincida.',
    })
  }

  return NextResponse.json({ success: true, data: result })
}
