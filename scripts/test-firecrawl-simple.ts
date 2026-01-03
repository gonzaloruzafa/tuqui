/**
 * Simple test of the updated firecrawl.ts
 */
import 'dotenv/config'

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY

if (!FIRECRAWL_API_KEY) {
    console.error('❌ FIRECRAWL_API_KEY not found in .env.local')
    process.exit(1)
}

async function testFirecrawl() {
    const url = 'https://listado.mercadolibre.com.ar/termo-stanley'
    
    console.log('🔥 Testing Firecrawl with stealth+mobile config...')
    console.log('URL:', url)
    
    const requestBody = {
        url,
        formats: ['markdown'],
        timeout: 30000,
        mobile: true,
        proxy: 'stealth',
        waitFor: 2000,
        location: {
            country: 'AR',
            languages: ['es-AR']
        },
        actions: [
            { type: 'wait', milliseconds: 1000 },
            { type: 'scroll', direction: 'down', amount: 500 }
        ]
    }
    
    const start = Date.now()
    
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
        },
        body: JSON.stringify(requestBody)
    })
    
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    
    if (!res.ok) {
        console.error('❌ HTTP Error:', res.status, await res.text())
        return
    }
    
    const data = await res.json()
    
    if (!data.success) {
        console.error('❌ Scrape failed:', data.error)
        return
    }
    
    const markdown = data.data?.markdown || ''
    
    // Extract prices
    const pricePattern = /\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g
    const prices: string[] = []
    let match
    while ((match = pricePattern.exec(markdown)) !== null) {
        const price = `$${match[1]}`
        if (!prices.includes(price) && parseInt(match[1].replace(/\./g, '')) >= 1000) {
            prices.push(price)
        }
        if (prices.length >= 10) break
    }
    
    console.log(`\n✅ Success in ${elapsed}s`)
    console.log('📊 Content length:', markdown.length, 'chars')
    console.log('💰 Prices found:', prices.length > 0 ? prices.join(', ') : 'none')
    console.log('\n📄 Sample content:')
    console.log('─'.repeat(60))
    console.log(markdown.slice(0, 1500))
    console.log('─'.repeat(60))
    
    // Check for login wall
    if (markdown.includes('Ingresá tu e-mail') || markdown.includes('Iniciá sesión')) {
        console.log('\n⚠️ WARNING: Login wall detected!')
    } else {
        console.log('\n✅ No login wall detected')
    }
}

testFirecrawl().catch(console.error)
