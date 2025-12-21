import puppeteer from 'puppeteer-extra'
import type { Browser, Page } from 'puppeteer'
import { MELI_SITES } from './schema'

// StealthPlugin has compatibility issues in this environment
// Using vanilla puppeteer-extra for now
try {
    const StealthPlugin = require('puppeteer-extra-plugin-stealth')
    puppeteer.use(StealthPlugin())
} catch (e) {
    console.warn('[MeliBrowser] StealthPlugin not available, using vanilla puppeteer')
}

export interface ProductResult {
    title: string
    price: number
    currency: string
    permalink: string
    imageUrl: string
    condition?: string
    freeShipping?: boolean
}

export interface SearchResult {
    success: boolean
    query: string
    site: string
    products: ProductResult[]
    totalFound: number
    error?: string
    executionTime: number
}

class MeliBrowserClient {
    private browser: Browser | null = null

    async launch() {
        if (this.browser) return
        this.browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        })
    }

    async close() {
        if (this.browser) {
            await this.browser.close()
            this.browser = null
        }
    }

    async search(query: string, site: string = 'MLA', maxResults: number = 5): Promise<SearchResult> {
        const startTime = Date.now()
        const baseUrl = MELI_SITES[site as keyof typeof MELI_SITES]?.domain
            ? `https://www.${MELI_SITES[site as keyof typeof MELI_SITES].domain}`
            : 'https://www.mercadolibre.com.ar'

        try {
            await this.launch()
            if (!this.browser) throw new Error('Browser failed to launch')

            const page = await this.browser.newPage()
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

            console.log(`Searching ${query} on ${baseUrl}`)
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })

            // Type and search
            const inputSelector = 'input.nav-search-input'
            await page.waitForSelector(inputSelector)
            await page.type(inputSelector, query)
            await page.keyboard.press('Enter')
            await page.waitForNavigation()

            // Extract results
            const products = await page.evaluate((max) => {
                const items = Array.from(document.querySelectorAll('.ui-search-layout__item')).slice(0, max)
                return items.map(item => {
                    const title = item.querySelector('.ui-search-item__title')?.textContent?.trim() || ''
                    const priceText = item.querySelector('.andes-money-amount__fraction')?.textContent?.replace(/\D/g, '') || '0'
                    const link = item.querySelector('a.ui-search-item__group__element')?.getAttribute('href') || ''
                    const img = item.querySelector('img.ui-search-result-image__element')?.getAttribute('src') || ''

                    return {
                        title,
                        price: parseInt(priceText),
                        currency: 'ARS', // Simplified for now
                        permalink: link,
                        imageUrl: img,
                        freeShipping: !!item.querySelector('.ui-search-item__shipping--free')
                    }
                })
            }, maxResults)

            await page.close()

            return {
                success: true,
                query,
                site,
                products,
                totalFound: products.length,
                executionTime: Date.now() - startTime
            }
        } catch (error: any) {
            console.error('Meli Search Error:', error)
            return {
                success: false,
                query,
                site,
                products: [],
                totalFound: 0,
                error: error.message,
                executionTime: Date.now() - startTime
            }
        }
    }
}

// Singleton for simpler usage
let instance: MeliBrowserClient | null = null

export function getMeliBrowserClient() {
    if (!instance) instance = new MeliBrowserClient()
    return instance
}

export async function searchProducts(query: string, site: string, maxResults: number) {
    const client = getMeliBrowserClient()
    try {
        return await client.search(query, site, maxResults)
    } finally {
        await client.close()
        instance = null // Reset to force fresh browser next time (safer for long running)
    }
}
