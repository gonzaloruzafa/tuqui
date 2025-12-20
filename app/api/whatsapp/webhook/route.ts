import { getMasterClient } from '@/lib/supabase/master'
import { getTenantClient, getTenantConfig } from '@/lib/supabase/tenant'
import { sendWhatsApp } from '@/lib/twilio/client'
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { getAgentsForTenant } from '@/lib/agents/service'

export async function POST(req: Request) {
    const formData = await req.formData()
    const From = formData.get('From') as string // whatsapp:+123456...
    const To = formData.get('To') as string
    const Body = formData.get('Body') as string

    if (!From || !To) return new Response('Missing From/To', { status: 400 })

    const fromNumber = From.replace('whatsapp:', '')
    const toNumber = To.replace('whatsapp:', '')

    console.log(`[WhatsApp] Received message from ${fromNumber} to ${toNumber}: ${Body}`)

    // 1. Identify Tenant by 'To' number (This is tricky if we don't have a reverse lookup table)
    // The Master DB 'tenants' table has 'twilio_phone' column.
    const master = getMasterClient()
    const { data: tenant } = await master
        .from('tenants')
        .select('id, slug')
        .eq('twilio_phone', toNumber)
        .single()

    if (!tenant) {
        console.error(`[WhatsApp] No tenant found for number ${toNumber}`)
        return new Response('Tenant not found', { status: 404 })
    }

    // 2. Identify Agent
    // For Alpha, pick 'tuqui-chat' or a specific 'whatsapp_agent' configured in settings
    // Let's assume 'tuqui-chat' for now
    const tenantId = tenant.id
    const agents = await getAgentsForTenant(tenantId)
    const agent = agents.find(a => a.slug === 'tuqui-chat') || agents[0]

    if (!agent) return new Response('No agent available', { status: 500 })

    // 3. Process with AI
    // We should create a session context, but for alpha: simple stateless or last-message context
    // Let's do simple stateless response for speed in this Alpha setup

    try {
        const { text } = await generateText({
            model: google('gemini-2.5-flash'),
            system: agent.system_prompt || 'Sos un asistente útil.',
            prompt: Body
        })

        // 4. Reply
        await sendWhatsApp(tenantId, fromNumber, text)

    } catch (error) {
        console.error('[WhatsApp] Processing error:', error)
    }

    return new Response('<Response></Response>', {
        headers: { 'Content-Type': 'text/xml' }
    })
}
