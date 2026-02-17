import { auth } from '@/lib/auth/config'
import { discoverCompanyProfile, type DiscoveryProgress } from '@/lib/company/discovery'
import { getClient } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET() {
  const session = await auth()
  if (!session?.tenant?.id || !session.isAdmin || !session.user?.email) {
    return new Response('No autorizado', { status: 401 })
  }

  const tenantId = session.tenant.id
  const userEmail = session.user.email

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const onProgress = (p: DiscoveryProgress) => {
          send('progress', p)
        }

        const result = await discoverCompanyProfile(tenantId, userEmail, onProgress)

        if (result) {
          // Save directly to DB — no more client-side auto-fill
          const db = getClient()

          // Get user id for updated_by
          const { data: userData } = await db
            .from('users')
            .select('id')
            .eq('email', userEmail)
            .eq('tenant_id', tenantId)
            .single()

          await db.from('company_contexts').upsert({
            tenant_id: tenantId,
            basics: {
              industry: result.industry || '',
              description: result.description || '',
            },
            key_customers: result.topCustomers || [],
            key_products: result.topProducts || [],
            key_suppliers: result.topSuppliers || [],
            tone_of_voice: result.toneOfVoice || '',
            updated_by: userData?.id || null,
          }, { onConflict: 'tenant_id' })

          // Generate briefing
          try {
            const { generateCompanyBriefing } = await import('@/lib/company/briefing')
            const briefing = await generateCompanyBriefing({
              name: session.tenant?.name || '',
              industry: result.industry || '',
              description: result.description || '',
              toneOfVoice: result.toneOfVoice || '',
              keyCustomers: result.topCustomers || [],
              keyProducts: result.topProducts || [],
              keySuppliers: result.topSuppliers || [],
              businessRules: [],
              webSummary: '',
            })
            if (briefing) {
              await db.from('company_contexts').update({ company_briefing: briefing }).eq('tenant_id', tenantId)
            }
          } catch (briefErr) {
            console.error('[Discovery SSE] Briefing generation error:', briefErr)
          }

          send('result', { success: true })
        } else {
          send('result', { success: false, error: 'No se pudo detectar el perfil. ¿Está conectado Odoo?' })
        }
      } catch (e) {
        console.error('[Discovery SSE] Error:', e)
        send('result', { success: false, error: 'Error al conectar con Odoo' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
