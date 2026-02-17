import { auth } from '@/lib/auth/config'
import { discoverCompanyProfile, type DiscoveryProgress } from '@/lib/company/discovery'

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
          send('result', { success: true, data: result })
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
