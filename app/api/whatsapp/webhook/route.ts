import { NextRequest } from 'next/server'
import { getTenantByPhone } from '@/lib/supabase/client'
import { sendWhatsApp } from '@/lib/twilio/client'
import { getOrCreateWhatsAppSession, getSessionMessages, saveMessage } from '@/lib/supabase/chat-history'
import { processChatRequest } from '@/lib/chat/engine'
import { getAgentBySlug } from '@/lib/agents/service'
import { validateTwilioSignature } from '@/lib/twilio/validate'

export const maxDuration = 60 // Allow longer timeout for tools

/**
 * Detects and converts markdown tables to numbered bullet lists for WhatsApp
 * Max 10 rows displayed, with "...y X más" if truncated
 */
function formatTablesForWhatsApp(text: string): string {
    const tableRegex = /\|(.+)\|[\r\n]+\|[-:\s|]+\|[\r\n]+((?:\|.+\|[\r\n]*)+)/g
    
    return text.replace(tableRegex, (match, headerRow, bodyRows) => {
        // Parse headers
        const headers = headerRow.split('|')
            .map((h: string) => h.trim())
            .filter((h: string) => h.length > 0)
        
        // Parse body rows
        const rows = bodyRows.trim().split('\n')
            .map((row: string) => 
                row.split('|')
                    .map((cell: string) => cell.trim())
                    .filter((cell: string) => cell.length > 0)
            )
            .filter((row: string[]) => row.length > 0)
        
        if (rows.length === 0) return match // No data rows, keep original
        
        const MAX_ROWS = 10
        const displayRows = rows.slice(0, MAX_ROWS)
        const truncatedCount = rows.length - MAX_ROWS
        
        // Build numbered list with key-value pairs
        let result = '\n'
        displayRows.forEach((row: string[], idx: number) => {
            result += `${idx + 1}. `
            const pairs = headers.map((header: string, i: number) => `${header}: ${row[i] || '-'}`)
            result += pairs.join(', ')
            result += '\n'
        })
        
        if (truncatedCount > 0) {
            result += `...y ${truncatedCount} más\n`
        }
        
        return result
    })
}

/**
 * Splits text into WhatsApp-friendly chunks, respecting bullet list integrity
 */
function chunkMessageRespectingBullets(text: string, maxLength: number = 1500): string[] {
    if (text.length <= maxLength) return [text]
    
    const chunks: string[] = []
    let remaining = text
    
    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining)
            break
        }
        
        // Find a good break point (newline, period, or space)
        let breakPoint = remaining.lastIndexOf('\n', maxLength)
        if (breakPoint < maxLength * 0.5) {
            breakPoint = remaining.lastIndexOf('. ', maxLength)
        }
        if (breakPoint < maxLength * 0.5) {
            breakPoint = remaining.lastIndexOf(' ', maxLength)
        }
        if (breakPoint < maxLength * 0.3) {
            breakPoint = maxLength // Force break
        }
        
        chunks.push(remaining.substring(0, breakPoint + 1).trim())
        remaining = remaining.substring(breakPoint + 1).trim()
    }
    
    return chunks
}

export async function POST(req: NextRequest) {
    console.log('[WhatsApp] Webhook received')

    try {
        const rawBody = await req.text()

        // 0. Validate Twilio signature (skip in dev if no token configured)
        const isValid = validateTwilioSignature(req, rawBody)
        if (!isValid) {
            console.warn('[WhatsApp] Invalid Twilio signature — rejecting request')
            return new Response('Forbidden', { status: 403 })
        }

        const params = new URLSearchParams(rawBody)

        // 1. Handle Twilio Debugger or Status Callbacks
        if (params.has('Payload') || params.has('MessageStatus')) {
            console.log('[WhatsApp] Ignoring Twilio event:', params.has('Payload') ? 'Debugger' : 'Status Callback')
            return new Response('<Response></Response>', {
                status: 200,
                headers: { 'Content-Type': 'text/xml' }
            })
        }

        const from = params.get('From')
        const body = params.get('Body')

        if (!from || !body) {
            console.log('[WhatsApp] Invalid messaging payload. Received keys:', Array.from(params.keys()).join(', '))
            return new Response('<Response></Response>', {
                status: 200,
                headers: { 'Content-Type': 'text/xml' }
            })
        }

        console.log(`[WhatsApp] Incoming from ${from}: ${body}`)

        // IMPORTANT: Respond to Twilio immediately to avoid timeout
        // Process the message asynchronously (fire and forget)
        processMessageAsync(from, body).catch(err => {
            console.error('[WhatsApp] Background processing error:', err)
        })

        // Return 200 immediately to Twilio (within milliseconds)
        return new Response('<Response></Response>', {
            status: 200,
            headers: { 'Content-Type': 'text/xml' }
        })

    } catch (error: any) {
        console.error('[WhatsApp] Webhook Error:', error)
        return new Response('<Response></Response>', {
            status: 200,
            headers: { 'Content-Type': 'text/xml' }
        })
    }
}

/**
 * Process WhatsApp message asynchronously after responding to Twilio
 */
async function processMessageAsync(from: string, body: string) {
    try {
        // 1. Lookup Tenant by Phone
        const tenantInfo = await getTenantByPhone(from)
        if (!tenantInfo) {
            console.log(`[WhatsApp] Unauthorized phone: ${from}`)
            return
        }

        const { id: tenantId, userEmail } = tenantInfo

        // 2. Get Tuqui (the default agent for WhatsApp)
        const agent = await getAgentBySlug(tenantId, 'tuqui')
        if (!agent) {
            console.error(`[WhatsApp] Tuqui agent not found for tenant ${tenantId}`)
            await sendWhatsApp(tenantId, from, '❌ Error: No se encontró el agente.')
            return
        }
        console.log(`[WhatsApp] Using Tuqui with tools: ${agent.tools?.join(', ')}`)
        
        // 3. Get/create session
        const sessionId = await getOrCreateWhatsAppSession(tenantId, agent.id, userEmail)
        const history = await getSessionMessages(tenantId, sessionId)

        // Save user message
        await saveMessage(tenantId, sessionId, 'user', body)

        // 4. Invoke Chat Engine with Tuqui (can take 10-60 seconds with tools)
        console.log(`[WhatsApp] Starting chat processing for ${from}...`)
        const startTime = Date.now()
        
        const result = await processChatRequest({
            tenantId,
            userEmail,
            agent,
            messages: [
                ...history.map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: body }
            ],
            channel: 'whatsapp'
        })
        
        console.log(`[WhatsApp] Chat completed in ${Date.now() - startTime}ms`)

        // 5. Save assistant response and send via WhatsApp
        await saveMessage(tenantId, sessionId, 'assistant', result.text, result.toolCalls)
        
        const formattedText = formatTablesForWhatsApp(result.text)
        const chunks = chunkMessageRespectingBullets(formattedText, 1500)
        
        for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks.length > 1 
                ? `(${i + 1}/${chunks.length}) ${chunks[i]}`
                : chunks[i]
            await sendWhatsApp(tenantId, from, chunkText)
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500))
            }
        }
        
        console.log(`[WhatsApp] Response sent to ${from}`)

    } catch (error: any) {
        console.error('[WhatsApp] Async processing error:', error)
        try {
            const tenantInfo = await getTenantByPhone(from)
            if (tenantInfo) {
                await sendWhatsApp(tenantInfo.id, from, `❌ Error: ${error.message?.substring(0, 100) || 'Error desconocido'}`)
            }
        } catch (e) {
            console.error('[WhatsApp] Could not send error message:', e)
        }
    }
}
