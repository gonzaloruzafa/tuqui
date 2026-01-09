
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

puppeteer.use(StealthPlugin())

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

async function verifyMeliProduct(query: string) {
    if (!GEMINI_API_KEY) throw new Error('No API Key')
    
    console.log(`\n🔍 Simulando búsqueda del agente para: "${query}"`)
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        tools: [{ googleSearch: {} } as any]
    })

    const prompt = `Buscá en MercadoLibre Argentina el precio de: ${query}. Dame el primer resultado exacto con Título, Precio y URL.`
    
    const result = await model.generateContent(prompt)
    const response = result.response
    
    // Buscar groundingMetadata en varios lugares posibles
    const groundingMetadata = (response as any).groundingMetadata || 
                             (result as any).groundingMetadata ||
                             (response.candidates?.[0] as any)?.groundingMetadata;

    console.log(`\nDEBUG: groundingMetadata keys:`, groundingMetadata ? Object.keys(groundingMetadata) : 'null')
    
    const sourceLink = groundingMetadata?.groundingChunks?.[0]?.web?.uri || 
                      groundingMetadata?.retrievalMetadata?.sources?.[0]?.uri;
    const sourceTitle = groundingMetadata?.groundingChunks?.[0]?.web?.title
    const agentText = response.text()

    console.log(`🤖 El Agente dice:\n${agentText}`)
    console.log(`🔗 Link detectado por Grounding: ${sourceLink}`)

    if (!sourceLink) {
        console.log('❌ No se encontró link de grounding.')
        return
    }

    console.log(`\n🌐 Abriendo navegador para verificar link real...`)
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    try {
        const page = await browser.newPage()
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        await page.goto(sourceLink, { waitUntil: 'networkidle2' })
        const finalUrl = page.url()
        console.log(`📍 URL Final después de redirección: ${finalUrl}`)

        // Extraer datos reales de la página de MeLi con selectores más robustos
        const realData = await page.evaluate(() => {
            const title = document.querySelector('h1.ui-pdp-title')?.textContent?.trim() || 
                         document.querySelector('.ui-pdp-title')?.textContent?.trim()
            
            const priceContainer = document.querySelector('.ui-pdp-price__main-container')
            const priceInteger = priceContainer?.querySelector('.andes-money-amount__fraction')?.textContent?.trim()
            
            const seller = document.querySelector('.ui-pdp-seller__link-trigger')?.textContent?.trim() || 
                          document.querySelector('.ui-pdp-seller__name-link')?.textContent?.trim() ||
                          'No detectable'
            
            return { title, price: priceInteger, seller }
        })

        console.log(`\n✅ DATOS REALES EN LA WEB:`)
        console.log(`📝 Título: ${realData.title}`)
        console.log(`💰 Precio: $ ${realData.price}`)
        console.log(`📦 Vendedor: ${realData.seller}`)

        const cleanPrice = (realData.price || '').replace(/\D/g, '')
        const cleanAgentPrice = agentText.replace(/\D/g, '')
        
        // El precio en el texto del agente tiene que estar contenido o ser muy cercano
        const match = agentText.includes(realData.price || 'SInPrEcIo') || cleanAgentPrice.includes(cleanPrice)
        console.log(`\n📊 CONSISTENCIA: ${match ? '✅ OK' : '❌ ERROR - El precio no coincide'}`)

    } catch (e: any) {
        console.error('Error verificando:', e.message)
    } finally {
        await browser.close()
    }
}

const target = process.argv[2] || "Turbina Kmd Draco"
verifyMeliProduct(target).catch(console.error)
