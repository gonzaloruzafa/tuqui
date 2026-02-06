import { auth } from '@/lib/auth/config'
import { getClient } from '@/lib/supabase/client'
import { scrapeAndSummarize, type CrawlProgress } from '@/lib/company/web-scraper'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.tenant?.id || !session.isAdmin) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { url } = await req.json()
  if (!url) return Response.json({ error: 'URL requerida' }, { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const onProgress = (progress: CrawlProgress) => {
        send({ type: 'progress', ...progress })
      }

      const result = await scrapeAndSummarize(url, onProgress)

      if (result.success && result.summary) {
        const db = getClient()
        await db.from('company_contexts').upsert({
          tenant_id: session.tenant!.id,
          web_summary: result.summary,
          web_scanned_at: new Date().toISOString(),
          source_urls: [url],
        }, { onConflict: 'tenant_id' })
      }

      send({ type: 'result', ...result })
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
