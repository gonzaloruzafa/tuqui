import { tool } from 'ai'
import { z } from 'zod'

/**
 * Scrape a single URL using Firecrawl
 */
async function scrapeUrl(url: string) {
    const apiKey = process.env.FIRECRAWL_API_KEY

    if (!apiKey) {
        return { error: 'FIRECRAWL_API_KEY no configurada' }
    }

    try {
        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                url,
                formats: ['markdown'],
                onlyMainContent: true
            })
        })

        if (!res.ok) {
            const error = await res.text()
            return { error: `Error ${res.status}: ${error}` }
        }

        const data = await res.json()

        if (!data.success) {
            return { error: data.error || 'Error al extraer contenido' }
        }

        return {
            url,
            title: data.data?.metadata?.title || 'Sin título',
            content: data.data?.markdown?.slice(0, 8000) || '', // Limit to 8K chars
            description: data.data?.metadata?.description
        }
    } catch (error: any) {
        return { error: error.message }
    }
}

/**
 * Firecrawl Web Investigator tool for AI SDK
 */
export const webInvestigatorTool = tool({
    description: 'Investigador Web: Extrae contenido completo de una página específica. Usa esto cuando necesites leer artículos, documentación, precios de productos, información detallada de un sitio.',
    parameters: z.object({
        url: z.string().describe('URL completa a investigar (debe incluir https://)')
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async ({ url }: any) => {
        return await scrapeUrl(url)
    }
} as any)
