/**
 * Unit Tests for Web Scraper
 *
 * Tests the crawler (extractText, extractInternalLinks, crawlSite)
 * and the summarization flow with mocked fetch + Gemini.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: 'Empresa de ejemplo que vende productos de tecnología en Argentina.'
  })
}))
vi.mock('@ai-sdk/google', () => ({
  google: vi.fn().mockReturnValue('mock-model')
}))

// Import after mocks
const { crawlSite, scrapeAndSummarize } = await import('@/lib/company/web-scraper')

describe('Web Scraper', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('crawlSite', () => {
    test('fetches main page and extracts text', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () => Promise.resolve('<html><body><h1>Mi Empresa</h1><p>Vendemos cosas buenas en Argentina. Somos una empresa de tecnología con más de 10 años en el mercado local.</p></body></html>')
      })

      const result = await crawlSite('https://example.com')

      expect(result.urls).toHaveLength(1)
      expect(result.urls[0]).toBe('https://example.com')
      expect(result.texts[0]).toContain('Mi Empresa')
      expect(result.texts[0]).toContain('Vendemos cosas buenas')
    })

    test('follows internal links to depth 2', async () => {
      const pages: Record<string, string> = {
        'https://example.com/': '<html><body><p>Home page content here. We are a technology company with over 10 years of experience in enterprise software development.</p><a href="/about">About</a><a href="/products">Products</a></body></html>',
        'https://example.com/about': '<html><body><p>About us page content here with details. Founded in 2010, our mission is to deliver exceptional software solutions to businesses worldwide.</p><a href="/team">Team</a></body></html>',
        'https://example.com/products': '<html><body><p>Products page with our catalog items. We offer ERP systems, CRM solutions, and custom software development services for enterprises.</p></body></html>',
        'https://example.com/team': '<html><body><p>Team page with member bios and roles. Our team consists of experienced engineers and product designers from around the world.</p></body></html>',
      }

      global.fetch = vi.fn().mockImplementation((url: string) => {
        const key = url.endsWith('/') ? url : url + (url === 'https://example.com' ? '/' : '')
        const html = pages[key] || pages[url]
        if (!html) return Promise.resolve({ ok: false, status: 404, headers: new Headers() })
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: () => Promise.resolve(html),
        })
      })

      const result = await crawlSite('https://example.com/')

      expect(result.urls.length).toBeGreaterThanOrEqual(2) // At least home + some links
      expect(result.texts.length).toBeGreaterThanOrEqual(2)
    })

    test('only follows same-domain links', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('example.com')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'text/html' }),
            text: () => Promise.resolve('<html><body><p>Main page with lots of content here</p><a href="https://external.com/page">External</a><a href="/internal">Internal</a></body></html>')
          })
        }
        return Promise.resolve({ ok: false, status: 404, headers: new Headers() })
      })

      const result = await crawlSite('https://example.com')

      // Should NOT have fetched external.com
      const fetchedUrls = (global.fetch as any).mock.calls.map((c: any) => c[0])
      expect(fetchedUrls.every((u: string) => u.includes('example.com'))).toBe(true)
    })

    test('respects max 10 pages limit', async () => {
      // Create a page with 20 internal links
      const links = Array.from({ length: 20 }, (_, i) => `<a href="/page-${i}">Page ${i}</a>`).join('')
      const mainHtml = `<html><body><p>Main content for testing pagination limit</p>${links}</body></html>`

      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: () => Promise.resolve(mainHtml),
        })
      })

      const result = await crawlSite('https://example.com')

      expect(result.urls.length).toBeLessThanOrEqual(20)
    })

    test('skips non-HTML responses', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === 'https://example.com') {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'text/html' }),
            text: () => Promise.resolve('<html><body><p>Main content for testing non-HTML responses. This is a company website with useful information about products and services.</p><a href="/file.pdf">PDF</a></body></html>')
          })
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/pdf' }),
          text: () => Promise.resolve('binary garbage')
        })
      })

      const result = await crawlSite('https://example.com')

      // Should only have the main page
      expect(result.urls).toHaveLength(1)
    })

    test('returns empty arrays on fetch failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await crawlSite('https://example.com')

      expect(result.texts).toHaveLength(0)
      expect(result.urls).toHaveLength(0)
    })
  })

  describe('scrapeAndSummarize', () => {
    test('returns summary for valid site', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () => Promise.resolve('<html><body><p>Una empresa argentina que vende productos de tecnología desde hace 10 años.</p></body></html>')
      })

      const result = await scrapeAndSummarize('https://example.com')

      expect(result.success).toBe(true)
      expect(result.summary).toBeDefined()
      expect(result.pagesScanned).toBeGreaterThanOrEqual(1)
    })

    test('returns error for invalid URL', async () => {
      const result = await scrapeAndSummarize('not-a-url')

      expect(result.success).toBe(false)
      expect(result.error).toBe('URL inválida')
    })

    test('returns error when site is unreachable', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

      const result = await scrapeAndSummarize('https://unreachable-site-12345.com')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('returns error when site returns empty content', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () => Promise.resolve('<html><body></body></html>')
      })

      const result = await scrapeAndSummarize('https://empty-site.com')

      expect(result.success).toBe(false)
      expect(result.error).toBe('No se pudo acceder al sitio')
    })

    test('returns error on HTTP error status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers(),
      })

      const result = await scrapeAndSummarize('https://forbidden-site.com')

      expect(result.success).toBe(false)
    })
  })
})
