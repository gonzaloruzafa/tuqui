/**
 * Simple Conversation Test
 *
 * Quick test to validate Skills system with a single conversation flow.
 */

import 'dotenv-flow/config'

const TEST_TENANT_ID = process.env.TEST_TENANT_ID || 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@adhoc.com.ar'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

async function testConversation() {
  console.log('\n🚀 Simple Skills Test\n')
  console.log(`Tenant: ${TEST_TENANT_ID}`)
  console.log(`User: ${TEST_USER_EMAIL}\n`)
  console.log('='.repeat(80))

  const messages: Message[] = []

  const conversationTurns = [
    '¿Cuánto vendimos en diciembre 2025?',
    '¿Quiénes fueron los mejores clientes?',
    '¿Qué productos vendió el primero?',
  ]

  for (let i = 0; i < conversationTurns.length; i++) {
    const userMessage = conversationTurns[i]

    console.log(`\n--- Turn ${i + 1}/${conversationTurns.length} ---\n`)
    console.log(`👤 User: ${userMessage}`)

    messages.push({
      role: 'user',
      content: userMessage,
    })

    try {
      const startTime = Date.now()

      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentSlug: 'tuqui',
          messages: messages,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'API Error')
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      let botText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const isDataStream = chunk.match(/^[0-9a-z]:/m)

        if (isDataStream) {
          const lines = chunk.split('\n').filter(line => line.trim())
          for (const line of lines) {
            const match = line.match(/^([0-9a-z]):(.*)$/)
            if (match) {
              const [_, type, content] = match
              if (type === '0') {
                try {
                  botText += JSON.parse(content)
                } catch (e) {
                  botText += content.replace(/^"|"$/g, '')
                }
              }
            }
          }
        } else {
          botText += chunk
        }
      }

      const duration = Date.now() - startTime

      messages.push({
        role: 'assistant',
        content: botText,
      })

      console.log(`\n🤖 Assistant:\n${botText.substring(0, 300)}${botText.length > 300 ? '...' : ''}\n`)
      console.log(`⏱️  Duration: ${duration}ms`)

    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error(error)
      break
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n✅ Test completed!\n')
}

// Run
testConversation().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
