'use server'

import { auth } from '@/lib/auth/config'
import { getClient } from '@/lib/supabase/client'
import { scrapeAndSummarize } from '@/lib/company/web-scraper'
import { revalidatePath } from 'next/cache'

export async function scanWebsite(formData: FormData) {
  const session = await auth()
  if (!session?.tenant?.id || !session.isAdmin) {
    return { success: false, error: 'No autorizado' }
  }

  const url = formData.get('url') as string
  if (!url) return { success: false, error: 'URL requerida' }

  const result = await scrapeAndSummarize(url)

  if (result.success && result.summary) {
    // Save immediately so it's persisted even before the form is saved
    const db = getClient()
    await db.from('company_contexts').upsert({
      tenant_id: session.tenant.id,
      web_summary: result.summary,
      web_scanned_at: new Date().toISOString(),
      source_urls: [url],
    }, { onConflict: 'tenant_id' })
  }

  return result
}

export async function saveCompanyContext(formData: FormData) {
  const session = await auth()
  if (!session?.tenant?.id || !session.isAdmin) return

  const tenantId = session.tenant.id
  const db = getClient()

  // 1. Update tenant basics (name, website, email, phone, address)
  await db.from('tenants').update({
    name: formData.get('name') as string,
    website: formData.get('website') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    address: formData.get('address') as string,
  }).eq('id', tenantId)

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

  // Collect linked document IDs
  const linkedDocs = formData.getAll('linked_documents') as string[]

  await db.from('company_contexts').upsert({
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

  revalidatePath('/admin/company')
}

function safeParseJSON(str: string | null, fallback: any): any {
  if (!str) return fallback
  try { return JSON.parse(str) } catch { return fallback }
}
