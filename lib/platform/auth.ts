import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'

/** Env var fallback — for bootstrap before first DB user exists */
const BOOTSTRAP_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS || 'gr@adhoc.inc')
  .split(',')
  .map(e => e.trim().toLowerCase())

/**
 * Checks if email is a platform admin.
 * Source of truth: `users.is_platform_admin` in DB.
 * Falls back to PLATFORM_ADMIN_EMAILS env var for bootstrap.
 */
export async function isPlatformAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false

  const supabase = supabaseAdmin()
  const { data } = await supabase
    .from('users')
    .select('is_platform_admin')
    .eq('email', email.toLowerCase())
    .eq('is_platform_admin', true)
    .limit(1)
    .maybeSingle()

  if (data?.is_platform_admin) return true

  // Fallback: env var (bootstrap / before migration runs)
  return BOOTSTRAP_ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function requirePlatformAdmin() {
  const session = await auth()
  const isAdmin = await isPlatformAdmin(session?.user?.email)
  if (!session?.user?.email || !isAdmin) {
    redirect('/')
  }
  return session
}
