import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { User } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'
import { getUserProfile } from '@/lib/user/profile'
import { UserProfileForm } from './UserProfileForm'

export default async function AdminUserPage() {
  const session = await auth()
  if (!session?.user) redirect('/')

  const tenantId = session.tenant?.id
  const userId = session.user.id

  if (!tenantId || !userId) redirect('/')

  const profile = await getUserProfile(tenantId, userId)

  return (
    <div className="min-h-screen bg-[#FAFBFC] flex flex-col">
      <Header />
      <AdminSubHeader
        title="Mi Perfil"
        backHref="/admin"
        icon={User}
        tenantName={session.tenant?.name}
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <div className="mb-6">
          <p className="text-sm text-gray-500">
            {session.user.email}
          </p>
        </div>

        <UserProfileForm
          profile={profile ? {
            display_name: profile.display_name || '',
            role_title: profile.role_title || '',
            area: profile.area || '',
            bio: profile.bio || '',
          } : null}
        />
      </main>

      <Footer />
    </div>
  )
}
