import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'

/**
 * Legacy route — redirects to unified user detail page.
 * Profile editing now lives in /admin/users/[id].
 * Looks up users table by email since session.user.id is the auth UUID, not the users table id.
 */
export default async function AdminUserPage() {
  const session = await auth()
  if (!session?.user?.email || !session?.tenant?.id) redirect('/login')

  const db = getClient()
  const { data } = await db
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .eq('tenant_id', session.tenant.id)
    .single()

  if (!data?.id) redirect('/')
  redirect(`/admin/users/${data.id}`)
}
