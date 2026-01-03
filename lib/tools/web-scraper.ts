import { tool } from 'ai'
import { z } from 'zod'

/**
 * Web Scraper Tool
 * 
 * Scraping genérico de URLs para obtener contenido de páginas web.
 * Optimizado para: artículos, documentación, blogs, noticias.
 * 
 * NO usar para: 
 * - Ecommerce/productos → usar ecommerceSearchTool
 * - Sitios con bloqueo de bots → considerar stealth mode
 */

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY

interface ScrapeResult {
    success: boolean
    url: string
    title: string
    content: string
    links?: string[]
    error?: string
    metadata?: {
        description?: string
        author?: string
        publishDate?: string
    }
}

/**
 * Detecta si una URL necesita configuración especial
 */
function needsSpecialHandling(url: string): boolean {
    const specialDomains = [
        'linkedin.com',
        'twitter.com',
        'x.com',
        'instagram.com',
        'facebook.com'
    ]
    return specialDomains.some(domain => url.includes(domain))
}

/**
 * Scrapea una URL usando Firecrawl
 */
export async function scrapeUrl(url: string, options?: {
    stealth?: boolean
    extractLinks?: boolean
    maxLength?: number
}): Promise<ScrapeResult> {
    if (!FIRECRAWL_API_KEY) {
        return {
            success: false,
            url,
            title: '',
            content: '',
            error: 'FIRECRAWL_API_KEY no configurada'
        }
    }

    console.log(`[WebScraper] Scraping: ${url}`)

    const requestBody: any = {
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 30000
    }

    // Modo stealth para sitios que bloquean
    if (options?.stealth || needsSpecialHandling(url)) {
        requestBody.mobile = true
        requestBody.proxy = 'stealth'
        requestBody.waitFor = 2000
    }

    // Extraer links si se solicita
    if (options?.extractLinks) {
        requestBody.formats = ['markdown', 'links']
    }

    try {
        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        })

        if (!res.ok) {
            const errorText = await res.text()
            console.error(`[WebScraper] Error ${res.status}:`, errorText)
            return {
                success: false,
                url,
                title: '',
                content: '',
                error: `HTTP ${res.status}: ${errorText.slice(0, 100)}`
            }
        }

        const data = await res.json()

        if (!data.success) {
            return {
                success: false,
                url,
                title: '',
                content: '',
                error: data.error || 'Scraping failed'
            }
        }

        const maxLength = options?.maxLength || 15000
        const content = data.data?.markdown?.slice(0, maxLength) || ''
        const title = data.data?.metadata?.title || ''

        return {
            success: true,
            url,
            title,
            content,
            links: data.data?.links?.slice(0, 20),
            metadata: {
                description: data.data?.metadata?.description,
                author: data.data?.metadata?.author,
                publishDate: data.data?.metadata?.publishedTime
            }
        }
    } catch (error: any) {
        console.error('[WebScraper] Exception:', error.message)
        return {
            success: false,
            url,
            title: '',
            content: '',
            error: error.message
        }
    }
}

/**
 * Web Scraper Tool - Extrae contenido de páginas web
 */
export const webScraperTool = tool({
    description: `Scraper Web: Extrae el contenido de una página web.

IDEAL PARA:
- Artículos y blogs
- Documentación técnica
- Noticias
- Páginas informativas

NO USAR PARA:
- Buscar productos/precios → usar ecommerce_search
- Redes sociales (limitado)

Ejemplo: "https://es.wikipedia.org/wiki/Buenos_Aires"`,
    parameters: z.object({
        url: z.string().url().describe('URL de la página a scrapear'),
        extractLinks: z.boolean().optional().default(false).describe('Extraer también los links de la página')
    }),
    execute: async ({ url, extractLinks }: { url: string; extractLinks?: boolean }) => {
        console.log(`[WebScraper] Processing: ${url}`)
        
        const result = await scrapeUrl(url, { extractLinks })
        
        if (!result.success) {
            return {
                error: result.error,
                url
            }
        }

        return {
            url: result.url,
            title: result.title,
            content: result.content,
            links: extractLinks ? result.links : undefined,
            metadata: result.metadata
        }
    }
} as any)
