'use server'

import { auth } from '@/lib/auth/config'
import { saveUserProfile } from '@/lib/user/profile'
import { revalidatePath } from 'next/cache'

interface SaveResult {
  success: boolean
  error?: string
}

export async function saveProfile(formData: FormData): Promise<SaveResult> {
  const session = await auth()
  if (!session?.tenant?.id || !session?.user?.id) {
    return { success: false, error: 'No autorizado' }
  }

  const result = await saveUserProfile(
    session.tenant.id,
    session.user.id,
    {
      display_name: formData.get('display_name') as string || undefined,
      role_title: formData.get('role_title') as string || undefined,
      area: formData.get('area') as string || undefined,
      bio: formData.get('bio') as string || undefined,
    }
  )

  if (!result) {
    return { success: false, error: 'Error al guardar el perfil' }
  }

  revalidatePath('/admin/user')
  return { success: true }
}
