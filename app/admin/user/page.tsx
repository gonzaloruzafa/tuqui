import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'

/**
 * Legacy route — redirects to unified user detail page.
 * Profile editing now lives in /admin/users/[id].
 */
export default async function AdminUserPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  redirect(`/admin/users/${session.user.id}`)
}
