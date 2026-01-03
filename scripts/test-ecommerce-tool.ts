/**
 * Test script for ecommerce_search tool
 * 
 * Usage: npx tsx scripts/test-ecommerce-tool.ts
 */

import 'dotenv/config'

const TAVILY_API_KEY = process.env.TAVILY_API_KEY
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY

if (!TAVILY_API_KEY) {
    console.error('❌ TAVILY_API_KEY not set')
    process.exit(1)
}
if (!FIRECRAWL_API_KEY) {
    console.error('❌ FIRECRAWL_API_KEY not set')
    process.exit(1)
}

console.log('🔧 Testing Ecommerce Search Tool')
console.log('================================')
console.log(`Tavily: ${TAVILY_API_KEY.substring(0, 10)}...`)
console.log(`Firecrawl: ${FIRECRAWL_API_KEY.substring(0, 10)}...`)

// Import the tool
import { ecommerceSearchTool } from '../lib/tools/ecommerce'

async function test() {
    const queries = [
        { query: 'sillon odontologico', marketplace: 'mercadolibre' },
        { query: 'termo stanley 1 litro', marketplace: 'mercadolibre' }
    ]
    
    for (const q of queries) {
        console.log(`\n🔍 Testing: "${q.query}" (${q.marketplace})`)
        console.log('─'.repeat(50))
        
        try {
            const startTime = Date.now()
            
            // Execute the tool manually
            const result = await ecommerceSearchTool.execute(q, {
                messages: [],
                toolCallId: 'test'
            } as any)
            
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
            
            console.log(`⏱️  Time: ${elapsed}s`)
            
            if (result.error) {
                console.log(`❌ Error: ${result.error}`)
            } else {
                console.log(`✅ Found ${result.products?.length || 0} products`)
                
                if (result.products?.length > 0) {
                    console.log('\n📦 Products:')
                    for (const p of result.products) {
                        console.log(`  • ${p.title?.substring(0, 50)}...`)
                        console.log(`    💰 Price: ${p.price || 'N/A'}`)
                        console.log(`    🔗 ${p.url?.substring(0, 60)}...`)
                    }
                }
                
                if (result.summary) {
                    console.log(`\n📝 Summary: ${result.summary.substring(0, 200)}...`)
                }
            }
        } catch (error: any) {
            console.error(`❌ Exception: ${error.message}`)
        }
    }
}

test().then(() => {
    console.log('\n✅ Test completed')
    process.exit(0)
}).catch(err => {
    console.error('Test failed:', err)
    process.exit(1)
})
