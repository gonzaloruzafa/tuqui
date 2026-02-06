import { generateText } from 'ai'
import { google } from '@ai-sdk/google'

interface ScrapeResult {
  success: boolean
  summary?: string
  pagesScanned?: number
  error?: string
}

const MAX_DEPTH = 2
const MAX_PAGES = 10
const TIMEOUT_MS = 10_000
const USER_AGENT = 'TuquiBot/1.0 (company-context-scanner)'

/**
 * Extrae texto limpio de HTML, removiendo scripts, styles y tags.
 */
function extractText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extrae links internos (mismo dominio) de HTML.
 */
function extractInternalLinks(html: string, baseUrl: URL): string[] {
  const linkRegex = /href=["']([^"']+)["']/gi
  const links: Set<string> = new Set()
  let match: RegExpExecArray | null

  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl.origin)
      if (resolved.hostname === baseUrl.hostname
        && !resolved.pathname.match(/\.(pdf|jpg|jpeg|png|gif|svg|css|js|ico|woff|zip)$/i)
        && !resolved.hash
        && resolved.pathname !== baseUrl.pathname
      ) {
        links.add(resolved.origin + resolved.pathname)
      }
    } catch { /* URL inválida, ignorar */ }
  }

  return [...links].slice(0, 20) // Pre-filter: max 20 candidates
}

/**
 * Fetcha una URL y retorna { html, text }. Null si falla.
 */
async function fetchPage(url: string): Promise<{ html: string; text: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!res.ok || !res.headers.get('content-type')?.includes('text/html')) return null
    const html = await res.text()
    const text = extractText(html)
    return text.length > 50 ? { html, text } : null
  } catch {
    return null
  }
}

/**
 * Crawlea un sitio hasta 2 niveles de profundidad (max 10 páginas).
 * Retorna todo el texto concatenado.
 */
export async function crawlSite(startUrl: string): Promise<{ texts: string[]; urls: string[] }> {
  const baseUrl = new URL(startUrl)
  const visited = new Set<string>()
  const texts: string[] = []
  const urls: string[] = []

  // Nivel 0: página principal
  const mainPage = await fetchPage(startUrl)
  if (!mainPage) return { texts: [], urls: [] }

  visited.add(baseUrl.origin + baseUrl.pathname)
  texts.push(mainPage.text)
  urls.push(startUrl)

  // Extraer links para nivel 1
  const level1Links = extractInternalLinks(mainPage.html, baseUrl)

  for (const link of level1Links) {
    if (visited.size >= MAX_PAGES) break
    if (visited.has(link)) continue
    visited.add(link)

    const page = await fetchPage(link)
    if (!page) continue

    texts.push(page.text)
    urls.push(link)

    // Nivel 2: links desde páginas de nivel 1
    if (visited.size < MAX_PAGES) {
      const level2Links = extractInternalLinks(page.html, baseUrl)
      for (const l2 of level2Links) {
        if (visited.size >= MAX_PAGES) break
        if (visited.has(l2)) continue
        visited.add(l2)

        const p2 = await fetchPage(l2)
        if (!p2) continue
        texts.push(p2.text)
        urls.push(l2)
      }
    }
  }

  return { texts, urls }
}

/**
 * Escanea un sitio web (2 niveles) y genera resumen con Gemini.
 */
export async function scrapeAndSummarize(url: string): Promise<ScrapeResult> {
  try {
    // Validar URL
    new URL(url)
  } catch {
    return { success: false, error: 'URL inválida' }
  }

  try {
    const { texts, urls } = await crawlSite(url)

    if (texts.length === 0) {
      return { success: false, error: 'No se pudo acceder al sitio' }
    }

    // Concatenar y limitar texto para el prompt
    const allText = texts.join('\n\n---\n\n').slice(0, 15_000)

    const { text: summary } = await generateText({
      model: google('gemini-2.0-flash'),
      prompt: `Analizá el siguiente contenido de un sitio web empresarial (${urls.length} páginas escaneadas) y generá un resumen conciso (máximo 200 palabras) que incluya:
- Qué hace la empresa (productos/servicios)
- A quién le vende (clientes objetivo)
- Qué la diferencia (propuesta de valor)
- Cualquier dato relevante (años en el mercado, ubicación, etc.)

Escribí en tercera persona, como una ficha de la empresa.
NO incluyas información que no esté en el texto.
NO incluyas URLs ni datos de navegación.

CONTENIDO DEL SITIO:
${allText}`,
      temperature: 0.3,
    })

    return {
      success: true,
      summary: summary.trim(),
      pagesScanned: urls.length,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
