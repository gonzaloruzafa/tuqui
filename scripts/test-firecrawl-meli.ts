/**
 * Test Firecrawl with MercadoLibre URLs
 */

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY

if (!FIRECRAWL_API_KEY) {
    console.error('❌ FIRECRAWL_API_KEY not set')
    process.exit(1)
}

// Test URLs - specific product pages (not listings)
const testUrls = [
    'https://articulo.mercadolibre.com.ar/MLA-1384847691-sillon-odontologico-hidraulico-profesional-consultorio-_JM',
    'https://articulo.mercadolibre.com.ar/MLA-1114158055-sillon-dental-odontologico-electrico-con-lampara-y-taburete-_JM'
]

async function testFirecrawl(url: string) {
    console.log(`\n🔍 Testing: ${url.slice(0, 80)}...`)
    console.log('-'.repeat(60))

    const startTime = Date.now()
    
    try {
        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
            },
            body: JSON.stringify({
                url,
                formats: ['markdown'],
                onlyMainContent: true,
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8'
                }
            })
        })

        const elapsed = Date.now() - startTime

        if (!res.ok) {
            const error = await res.text()
            console.log(`❌ HTTP Error: ${res.status}`)
            console.log(`   ${error.slice(0, 200)}`)
            return { success: false, error: res.status }
        }

        const data = await res.json()

        if (!data.success) {
            console.log(`❌ Scrape failed: ${data.error}`)
            return { success: false, error: data.error }
        }

        const markdown = data.data?.markdown || ''
        const title = data.data?.metadata?.title || 'No title'

        // Check for login wall
        const isBlocked = markdown.includes('Ingresá tu e-mail') || 
                          markdown.includes('Iniciá sesión') ||
                          markdown.includes('Inicia sesión') ||
                          markdown.includes('Para continuar, ingresa')

        // Try to extract price
        const priceMatch = markdown.match(/\$\s?([\d.,]+)/)
        const price = priceMatch ? `$${priceMatch[1]}` : 'No price found'

        console.log(`✅ Success in ${elapsed}ms`)
        console.log(`   Title: ${title.slice(0, 80)}`)
        console.log(`   Content length: ${markdown.length} chars`)
        console.log(`   Login blocked: ${isBlocked ? '⚠️ YES' : '✓ NO'}`)
        console.log(`   Price extracted: ${price}`)
        
        // Show content preview if not blocked
        if (!isBlocked && markdown.length > 500) {
            console.log(`\n   Preview (first 1000 chars):`)
            console.log(`   ${markdown.slice(0, 1000).replace(/\n/g, '\n   ')}`)
        }

        return { 
            success: true, 
            blocked: isBlocked, 
            price, 
            contentLength: markdown.length,
            elapsed 
        }

    } catch (error: any) {
        console.log(`❌ Exception: ${error.message}`)
        return { success: false, error: error.message }
    }
}

async function main() {
    console.log('🧪 Firecrawl MercadoLibre Test')
    console.log('='.repeat(60))
    console.log(`API Key: ${FIRECRAWL_API_KEY?.slice(0, 10)}...`)

    const results = []

    for (const url of testUrls) {
        const result = await testFirecrawl(url)
        results.push({ url, ...result })
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 SUMMARY')
    console.log('='.repeat(60))
    
    const successful = results.filter(r => r.success && !r.blocked)
    const blocked = results.filter(r => r.success && r.blocked)
    const failed = results.filter(r => !r.success)

    console.log(`✅ Successful (with content): ${successful.length}/${results.length}`)
    console.log(`⚠️ Blocked by login: ${blocked.length}/${results.length}`)
    console.log(`❌ Failed: ${failed.length}/${results.length}`)

    if (successful.length > 0) {
        console.log('\n✅ Working URLs with prices:')
        successful.forEach(r => console.log(`   ${r.price} - ${r.url.slice(0, 60)}...`))
    }
}

main().catch(console.error)
