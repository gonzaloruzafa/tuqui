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
    .select('auth_user_id')
    .eq('id', targetUserId)
    .eq('tenant_id', session.tenant.id)
    .single()

  const isSelf = targetUser?.auth_user_id === session.user.id
  if (!session.isAdmin && !isSelf) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
  }

  // odooName is always provided (user types it in the UI)
  const searchName = req.nextUrl.searchParams.get('odooName')
  if (!searchName?.trim()) {
    return NextResponse.json({ success: false, error: 'Nombre de Odoo requerido' })
  }

  const result = await discoverUserProfile(
    session.tenant.id,
    session.user.email,
    searchName
  )

  if (!result) {
    return NextResponse.json({
      success: false,
      error: `No se encontró "${searchName}" en Odoo. Revisá el nombre e intentá de nuevo.`,
    })
  }

  return NextResponse.json({ success: true, data: result })
}
