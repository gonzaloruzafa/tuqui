'use server'

import { auth } from '@/lib/auth/config'
import { getClient } from '@/lib/supabase/client'
import { getCompanyContext } from '@/lib/company/context-injector'
import { revalidatePath } from 'next/cache'

interface SaveResult {
  success: boolean
  error?: string
  preview?: { context: string; tokenEstimate: number; sources: string[] }
}

export async function saveCompanyContext(formData: FormData): Promise<SaveResult> {
  const session = await auth()
  if (!session?.tenant?.id || !session.isAdmin) {
    return { success: false, error: 'No autorizado' }
  }

  const tenantId = session.tenant.id
  const db = getClient()

  try {
    // 1. Update tenant basics
    const { error: tenantError } = await db.from('tenants').update({
      name: formData.get('name') as string,
      website: formData.get('website') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
    }).eq('id', tenantId)

    if (tenantError) throw tenantError

    // 2. Upsert company_contexts
    const basics = {
      industry: formData.get('industry') as string || '',
      description: formData.get('description') as string || '',
      location: formData.get('address') as string || '',
    }

    const keyCustomers = safeParseJSON(formData.get('key_customers') as string, [])
    const keyProducts = safeParseJSON(formData.get('key_products') as string, [])
    const businessRules = safeParseJSON(formData.get('business_rules') as string, [])
    const toneOfVoice = formData.get('tone_of_voice') as string || ''
    const webSummary = formData.get('web_summary') as string || ''
    const scanUrl = formData.get('scan_url') as string || ''
    const linkedDocs = formData.getAll('linked_documents') as string[]

    const { error: ctxError } = await db.from('company_contexts').upsert({
      tenant_id: tenantId,
      basics,
      key_customers: keyCustomers,
      key_products: keyProducts,
      business_rules: businessRules,
      tone_of_voice: toneOfVoice,
      web_summary: webSummary || null,
      source_urls: scanUrl ? [scanUrl] : [],
      linked_documents: linkedDocs,
      updated_by: session.user?.id || null,
    }, { onConflict: 'tenant_id' })

    if (ctxError) throw ctxError

    // 3. Get fresh preview
    const preview = await getCompanyContext(tenantId)

    revalidatePath('/admin/company')
    return { success: true, preview }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error al guardar' }
  }
}

function safeParseJSON(str: string | null, fallback: any): any {
  if (!str) return fallback
  try { return JSON.parse(str) } catch { return fallback }
}
