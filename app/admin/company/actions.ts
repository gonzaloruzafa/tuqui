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
    // Look up real user UUID from users table
    const userEmail = session.user?.email
    let userId: string | null = null
    if (userEmail) {
      const { data: userData } = await db
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .eq('tenant_id', tenantId)
        .single()
      userId = userData?.id || null
    }

    // 1. Update tenant name
    const { error: tenantError } = await db.from('tenants').update({
      name: formData.get('name') as string,
    }).eq('id', tenantId)

    if (tenantError) throw tenantError

    // 2. Upsert company_contexts
    const basics = {
      industry: formData.get('industry') as string || '',
      description: formData.get('description') as string || '',
    }

    const keyCustomers = safeParseJSON(formData.get('key_customers') as string, [])
    const keyProducts = safeParseJSON(formData.get('key_products') as string, [])
    const keySuppliers = safeParseJSON(formData.get('key_suppliers') as string, [])
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
      key_suppliers: keySuppliers,
      business_rules: businessRules,
      tone_of_voice: toneOfVoice,
      web_summary: webSummary || null,
      source_urls: scanUrl ? [scanUrl] : [],
      linked_documents: linkedDocs,
      updated_by: userId,
    }, { onConflict: 'tenant_id' })

    if (ctxError) throw ctxError

    // 3. Generate narrative briefing from all structured data
    try {
      const { generateCompanyBriefing } = await import('@/lib/company/briefing')
      const briefing = await generateCompanyBriefing({
        name: formData.get('name') as string || '',
        industry: basics.industry,
        description: basics.description,
        toneOfVoice,
        keyCustomers,
        keyProducts,
        keySuppliers,
        businessRules,
        webSummary: webSummary || '',
      })
      if (briefing) {
        await db.from('company_contexts').update({ company_briefing: briefing }).eq('tenant_id', tenantId)
      }
    } catch (e) {
      console.warn('[saveCompanyContext] Briefing generation failed:', e)
      // Non-blocking — form still saves successfully
    }

    // 4. Get fresh preview
    const preview = await getCompanyContext(tenantId)

    revalidatePath('/admin/company')
    return { success: true, preview }
  } catch (error: any) {
    const message = error?.message || error?.details || error?.hint || 'Error desconocido'
    const code = error?.code || ''
    console.error('[saveCompanyContext] Error:', { message, code, details: error?.details, hint: error?.hint, error })
    return { success: false, error: `${message}${code ? ` (${code})` : ''}` }
  }
}

function safeParseJSON(str: string | null, fallback: any): any {
  if (!str) return fallback
  try { return JSON.parse(str) } catch { return fallback }
}

// Note: runCompanyDiscovery server action removed — discovery now uses SSE via /api/admin/discover
