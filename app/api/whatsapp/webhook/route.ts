import { NextRequest, NextResponse } from 'next/server'
import { getTenantByPhone } from '@/lib/supabase/tenant'
import { sendWhatsApp } from '@/lib/twilio/client'
import { getAgentBySlug } from '@/lib/agents/service'
import { searchDocuments } from '@/lib/rag/search'
import { getToolsForAgent } from '@/lib/tools/executor'
import { getMasterClient } from '@/lib/supabase/master'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'

const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY
})

export const maxDuration = 60 // Allow longer timeout for tools

export async function POST(req: NextRequest) {
    console.log('[WhatsApp] Webhook received')

    try {
        const formData = await req.formData()
        const from = formData.get('From')?.toString() // whatsapp:+549...
        const body = formData.get('Body')?.toString()

        if (!from || !body) {
            return new Response('Missing From or Body', { status: 400 })
        }

        console.log(`[WhatsApp] Incoming from ${from}: ${body}`)

        // 1. Lookup Tenant by Phone
        const tenantInfo = await getTenantByPhone(from)
        console.log(`[WhatsApp] Lookup result for ${from}:`, tenantInfo ? 'Found' : 'NOT FOUND')

        if (!tenantInfo) {
            console.log(`[WhatsApp] Unauthorized phone: ${from}`)
            return new Response(`Unauthorized phone: ${from}`, { status: 401 })
        }

        const { id: tenantId, schema, userEmail } = tenantInfo
        console.log(`[WhatsApp] Routed to Tenant: ${tenantId} (${schema}) for ${userEmail}`)

        // 2. Load Orchestrator Agent (default or based on keywords)
        // For POC we'll use a hardcoded agent slug or the first one found
        const agentSlug = 'bi-analyst' // Default for now, can be an env var
        const agent = await getAgentBySlug(tenantId, agentSlug)

        if (!agent) {
            console.error(`[WhatsApp] Agent ${agentSlug} not found for tenant ${tenantId}`)
            await sendWhatsApp(tenantId, from, "Lo siento, mi configuración está incompleta. Por favor contacta a soporte.")
            return new Response('Agent not found', { status: 404 })
        }

        // 3. Prepare AI Context
        const systemPrompt = agent.system_prompt || ''

        // Fetch company context if exists
        const master = getMasterClient()
        const { data: tenantData } = await master
            .from('tenants')
            .select('company_context')
            .eq('id', tenantId)
            .single()

        const companyContext = tenantData?.company_context ? `CONTEXTO DE LA EMPRESA:\n${tenantData.company_context}\n\n` : ''
        const fullSystemPrompt = `${companyContext}${systemPrompt}`

        // 4. RAG Search (Optional but recommended)
        let ragContext = ""
        try {
            const searchResults = await searchDocuments(tenantId, agent.id, body, 3)
            if (searchResults.length > 0) {
                ragContext = "\n\nINFORMACIÓN RELEVANTE:\n" + searchResults.map(r => r.content).join("\n---\n")
            }
        } catch (e) {
            console.error('[WhatsApp] RAG Error:', e)
        }

        // 5. Load Tools
        const tools = await getToolsForAgent(tenantId, agent.tools || [])

        // 6. Generate Text
        console.log('[WhatsApp] Invoking Gemini...')
        const { text } = await generateText({
            model: google('gemini-2.0-flash'),
            system: fullSystemPrompt + ragContext,
            messages: [{ role: 'user', content: body }],
            tools: tools as any,
            maxSteps: 5
        } as any)

        // 7. Send Response back via Twilio
        console.log('[WhatsApp] Sending response...')
        await sendWhatsApp(tenantId, from, text)

        return new Response('OK', { status: 200 })

    } catch (error: any) {
        console.error('[WhatsApp] Webhook Error:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
}
