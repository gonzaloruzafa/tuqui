import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'

const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS || 'gr@adhoc.inc')
  .split(',')
  .map(e => e.trim().toLowerCase())

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return PLATFORM_ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function requirePlatformAdmin() {
  const session = await auth()
  if (!session?.user?.email || !isPlatformAdmin(session.user.email)) {
    redirect('/')
  }
  return session
}
