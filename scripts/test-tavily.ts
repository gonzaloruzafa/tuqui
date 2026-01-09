
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const TAVILY_API_KEY = process.env.TAVILY_API_KEY

async function testTavily(query: string) {
    console.log(`\n🔍 Buscando con Tavily: "${query}"`)
    
    const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query: `${query} site:mercadolibre.com.ar`,
            max_results: 5
        })
    })
    
    const data = await res.json()
    console.log(`\n✅ Resultados de Tavily:`)
    data.results?.forEach((r: any, i: number) => {
        console.log(`[${i+1}] ${r.title}`)
        console.log(`    URL: ${r.url}`)
    })
}

testTavily("Turbina Kmd Draco precio").catch(console.error)
