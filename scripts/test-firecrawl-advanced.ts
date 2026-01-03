/**
 * Test avanzado de Firecrawl con MercadoLibre
 * Probando diferentes configuraciones para saltear el login wall
 */

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY

if (!FIRECRAWL_API_KEY) {
    console.error('❌ FIRECRAWL_API_KEY not set')
    process.exit(1)
}

interface ScrapeConfig {
    name: string
    url: string
    options: Record<string, any>
}

const testConfigs: ScrapeConfig[] = [
    // Test 1: Producto específico con stealth proxy
    {
        name: 'Producto MLA con STEALTH proxy',
        url: 'https://articulo.mercadolibre.com.ar/MLA-1114427244-sillon-odontologico-x3-colgante-cingol-con-banqueta-y-foco-_JM',
        options: {
            formats: ['markdown'],
            onlyMainContent: true,
            proxy: 'stealth',  // KEY: Usar stealth proxy
            location: { country: 'AR', languages: ['es-AR'] },
            waitFor: 3000,
            timeout: 60000,
            blockAds: true,
        }
    },
    // Test 2: Listado con stealth + actions
    {
        name: 'Listado con STEALTH + scroll',
        url: 'https://listado.mercadolibre.com.ar/sillon-odontologico',
        options: {
            formats: ['markdown'],
            onlyMainContent: true,
            proxy: 'stealth',
            location: { country: 'AR', languages: ['es-AR'] },
            waitFor: 2000,
            timeout: 60000,
            actions: [
                { type: 'wait', milliseconds: 2000 },
                { type: 'scroll', direction: 'down', amount: 800 },
                { type: 'wait', milliseconds: 1000 },
            ]
        }
    },
    // Test 3: Extracción JSON estructurada
    {
        name: 'Producto con extracción JSON',
        url: 'https://articulo.mercadolibre.com.ar/MLA-1114427244-sillon-odontologico-x3-colgante-cingol-con-banqueta-y-foco-_JM',
        options: {
            formats: [
                'markdown',
                {
                    type: 'json',
                    prompt: 'Extraé el precio del producto (número con formato argentino), el nombre completo del producto, el vendedor, y las características principales. Si hay precio con descuento, extraé ambos.'
                }
            ],
            onlyMainContent: true,
            proxy: 'stealth',
            location: { country: 'AR', languages: ['es-AR'] },
            waitFor: 3000,
            timeout: 60000
        }
    },
    // Test 4: Con mobile = true (a veces MeLi muestra menos bloqueos en mobile)
    {
        name: 'Producto en modo MOBILE',
        url: 'https://articulo.mercadolibre.com.ar/MLA-1114427244-sillon-odontologico-x3-colgante-cingol-con-banqueta-y-foco-_JM',
        options: {
            formats: ['markdown'],
            onlyMainContent: true,
            proxy: 'stealth',
            mobile: true,  // KEY: Simular dispositivo móvil
            location: { country: 'AR', languages: ['es-AR'] },
            waitFor: 2000,
            timeout: 60000
        }
    },
    // Test 5: Buscar en MeLi search (no listado ni artículo)
    {
        name: 'Search URL directa',
        url: 'https://www.mercadolibre.com.ar/sillon-odontologico-x3',
        options: {
            formats: ['markdown'],
            onlyMainContent: false,  // Traer todo el contenido
            proxy: 'stealth',
            location: { country: 'AR', languages: ['es-AR'] },
            waitFor: 3000,
            timeout: 60000
        }
    }
]

async function scrapeWithFirecrawl(config: ScrapeConfig) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🧪 Test: ${config.name}`)
    console.log(`📍 URL: ${config.url}`)
    console.log(`⚙️  Options: proxy=${config.options.proxy}, mobile=${config.options.mobile || false}`)
    
    const startTime = Date.now()
    
    try {
        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
            },
            body: JSON.stringify({
                url: config.url,
                ...config.options
            })
        })
        
        const elapsed = Date.now() - startTime
        
        if (!res.ok) {
            const error = await res.text()
            console.log(`❌ HTTP Error ${res.status}: ${error.substring(0, 200)}`)
            return null
        }
        
        const data = await res.json()
        
        if (!data.success) {
            console.log(`❌ Scrape failed: ${data.error}`)
            return null
        }
        
        const markdown = data.data?.markdown || ''
        const json = data.data?.json
        const title = data.data?.metadata?.title || 'No title'
        
        console.log(`✅ Success in ${elapsed}ms`)
        console.log(`📄 Title: ${title}`)
        console.log(`📏 Content length: ${markdown.length} chars`)
        
        // Check for login wall
        const hasLoginWall = markdown.includes('Ingresá tu e-mail') || 
                            markdown.includes('Iniciá sesión') ||
                            markdown.includes('Ingresa tu e-mail') ||
                            markdown.includes('Inicia sesión')
        
        if (hasLoginWall) {
            console.log(`🚫 LOGIN WALL DETECTED`)
        } else {
            console.log(`✅ NO login wall detected`)
        }
        
        // Try to find price
        const priceMatch = markdown.match(/\$\s?([\d.,]+)/g)
        if (priceMatch && priceMatch.length > 0) {
            console.log(`💰 Precios encontrados: ${priceMatch.slice(0, 5).join(', ')}`)
        } else {
            console.log(`❌ No se encontraron precios en el markdown`)
        }
        
        // Show JSON extraction if available
        if (json) {
            console.log(`📊 JSON extraído:`, JSON.stringify(json, null, 2))
        }
        
        // Show first 500 chars of markdown
        console.log(`\n📝 Preview del contenido:`)
        console.log(markdown.substring(0, 800))
        console.log('...')
        
        return { success: true, hasLoginWall, markdown, json, elapsed }
        
    } catch (error: any) {
        console.log(`❌ Exception: ${error.message}`)
        return null
    }
}

async function main() {
    console.log('🔥 Firecrawl MercadoLibre Advanced Test')
    console.log(`API Key: ${FIRECRAWL_API_KEY.substring(0, 10)}...`)
    console.log(`\nProbando ${testConfigs.length} configuraciones diferentes...\n`)
    
    const results: Record<string, any> = {}
    
    for (const config of testConfigs) {
        results[config.name] = await scrapeWithFirecrawl(config)
        // Wait between requests to avoid rate limiting
        await new Promise(r => setTimeout(r, 2000))
    }
    
    // Summary
    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 RESUMEN DE RESULTADOS')
    console.log('='.repeat(60))
    
    for (const [name, result] of Object.entries(results)) {
        if (!result) {
            console.log(`❌ ${name}: FAILED`)
        } else if (result.hasLoginWall) {
            console.log(`🚫 ${name}: Login wall (${result.elapsed}ms)`)
        } else {
            console.log(`✅ ${name}: SUCCESS (${result.elapsed}ms, ${result.markdown?.length || 0} chars)`)
        }
    }
}

main().catch(console.error)
