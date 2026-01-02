import { NextRequest, NextResponse } from 'next/server'
import { getTenantByPhone } from '@/lib/supabase/tenant'
import { sendWhatsApp } from '@/lib/twilio/client'
import { getAgentBySlug } from '@/lib/agents/service'
import { searchDocuments } from '@/lib/rag/search'
import { getToolsForAgent } from '@/lib/tools/executor'
import { getMasterClient } from '@/lib/supabase/master'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { getOrCreateWhatsAppSession, getSessionMessages, saveMessage } from '@/lib/supabase/chat-history'

const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY
})

export const maxDuration = 60 // Allow longer timeout for tools

export async function POST(req: NextRequest) {
    console.log('[WhatsApp] Webhook received')

    try {
        const rawBody = await req.text()
        console.log('[WhatsApp] Raw payload:', rawBody)

        const params = new URLSearchParams(rawBody)

        // Check if this is a Twilio Debugger event instead of a message
        if (params.has('Payload')) {
            console.log('[WhatsApp] Ignoring Twilio Debugger event')
            return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
        }

        const from = params.get('From')
        const body = params.get('Body')

        if (!from || !body) {
            console.log('[WhatsApp] Invalid messaging payload. Params:', Object.fromEntries(params.entries()))
            return new Response(`Error: Se esperaba un mensaje de WhatsApp (From/Body). Recibido: ${Array.from(params.keys()).join(', ')}`, { status: 400 })
        }

        console.log(`[WhatsApp] Incoming from ${from}: ${body}`)

        // 1. Lookup Tenant by Phone
        const tenantInfo = await getTenantByPhone(from)
        if (!tenantInfo) {
            console.log(`[WhatsApp] Unauthorized phone: ${from}`)
            return new Response(`Unauthorized phone: ${from}`, { status: 401 })
        }

        const { id: tenantId, schema, userEmail } = tenantInfo
        console.log(`[WhatsApp] Routed to Tenant: ${tenantId} (${schema}) for ${userEmail}`)

        // 2. Load Agent
        const { getAgentsForTenant } = await import('@/lib/agents/service')
        const allAgents = await getAgentsForTenant(tenantId)

        if (allAgents.length === 0) {
            console.error(`[WhatsApp] No agents found for tenant ${tenantId}`)
            await sendWhatsApp(tenantId, from, "Lo siento, no tenés agentes configurados. Por favor contacta a soporte.")
            return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
        }

        // Try to find a default agent: tuqui-chat or the first one available
        const preferredSlug = 'tuqui-chat'
        let agent = allAgents.find(a => a.slug === preferredSlug) || allAgents[0]
        console.log(`[WhatsApp] selected Agent: ${agent.slug} (${agent.id})`)

        // 3. Chat History & Session
        const sessionId = await getOrCreateWhatsAppSession(tenantId, agent.id, userEmail)
        const history = await getSessionMessages(tenantId, sessionId)
        console.log(`[WhatsApp] Session ${sessionId} loaded with ${history.length} messages`)

        // Save USER message to history
        await saveMessage(tenantId, sessionId, 'user', body)

        // 4. Determine Execution Path (Standard vs Odoo)
        let responseText = ""
        const hasOdooTools = agent.tools?.some(t => t.startsWith('odoo'))

        // Prepare System Prompt
        const basePrompt = agent.system_prompt || ''
        const master = getMasterClient()
        const { data: tenantData } = await master
            .from('tenants')
            .select('company_context')
            .eq('id', tenantId)
            .single()

        const companyContext = tenantData?.company_context ? `CONTEXTO DE LA EMPRESA:\n${tenantData.company_context}\n\n` : ''
        const fullSystemPrompt = `${companyContext}${basePrompt}\n\nIMPORTANTE: Estás en WhatsApp. Sé conciso pero útil. No pidas aclaraciones innecesarias si el contexto ya está en el historial.`

        if (hasOdooTools) {
            // Path A: Odoo BI Agent (Native Loop)
            console.log('[WhatsApp] Using Odoo BI Agent loop')
            const { chatWithOdoo } = await import('@/lib/tools/gemini-odoo')

            // Convert history for Gemini
            const geminiHistory = history.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            })) as any[]

            const odooRes = await chatWithOdoo(tenantId, fullSystemPrompt, body, geminiHistory)
            responseText = odooRes.text
        } else {
            // Path B: Standard Agent (AI SDK)
            console.log('[WhatsApp] Using Standard Agent loop')

            // 4.2 RAG Search
            let ragContext = ""
            if (agent.rag_enabled) {
                try {
                    const searchResults = await searchDocuments(tenantId, agent.id, body, 3)
                    if (searchResults.length > 0) {
                        ragContext = "\n\nINFORMACIÓN RELEVANTE:\n" + searchResults.map(r => r.content).join("\n---\n")
                    }
                } catch (e) {
                    console.error('[WhatsApp] RAG Error:', e)
                }
            }

            // 4.3 Load Tools
            const tools = await getToolsForAgent(tenantId, agent.tools || [])

            const { text } = await generateText({
                model: google('gemini-2.0-flash'),
                system: fullSystemPrompt + ragContext,
                messages: [
                    ...history.map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: body }
                ] as any,
                tools: tools as any,
                maxSteps: 5
            } as any)
            responseText = text
        }

        // 5. Save ASSISTANT message to history
        await saveMessage(tenantId, sessionId, 'assistant', responseText)

        // 6. Send Response back via Twilio
        console.log('[WhatsApp] Sending response...')
        await sendWhatsApp(tenantId, from, responseText)

        // 7. Return empty TwiML to avoid echo
        return new Response('<Response></Response>', {
            status: 200,
            headers: { 'Content-Type': 'text/xml' }
        })

    } catch (error: any) {
        console.error('[WhatsApp] Webhook Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}
