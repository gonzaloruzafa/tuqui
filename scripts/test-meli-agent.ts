/**
 * Test the MeLi agent end-to-end
 */
import 'dotenv/config'

const PROD_URL = 'https://tuqui-agents-alpha.vercel.app'
const LOCAL_URL = 'http://localhost:3000'

// Use prod by default
const BASE_URL = process.env.TEST_LOCAL === 'true' ? LOCAL_URL : PROD_URL

async function testMeliAgent() {
    console.log('\n🧪 Testing MeLi Agent...')
    console.log('Using:', BASE_URL)
    
    // First get a valid tenant ID from agents endpoint
    console.log('\n📋 Getting tenant info...')
    
    const testTenantId = 'test-tenant'  // May need to use actual tenant
    const testMessages = [
        { role: 'user', content: '¿Cuánto sale un termo Stanley en MercadoLibre?' }
    ]
    
    console.log('\n📝 Question:', testMessages[0].content)
    console.log('\n⏳ Calling /api/chat (this may take a minute with web scraping)...')
    
    try {
        const startTime = Date.now()
        
        // The chat endpoint expects: messages[], tenantId, agentId (optional)
        const response = await fetch(`${BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId: testTenantId,
                agentId: 'meli-researcher',
                messages: testMessages
            })
        })
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        
        if (!response.ok) {
            const error = await response.text()
            console.error('❌ Error:', response.status, error)
            return
        }
        
        // Handle streaming response
        const text = await response.text()
        
        console.log(`\n✅ Response received in ${elapsed}s`)
        console.log('\n📄 Raw response (first 3000 chars):')
        console.log('─'.repeat(60))
        console.log(text.slice(0, 3000))
        console.log('─'.repeat(60))
        
    } catch (error: any) {
        console.error('❌ Exception:', error.message)
    }
}

testMeliAgent()
