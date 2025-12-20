import twilio from 'twilio'
import { getTenantClient, getTenantConfig } from '@/lib/supabase/tenant'
import { decrypt } from '@/lib/crypto'

export async function getTwilioClientForTenant(tenantId: string) {
    const db = await getTenantClient(tenantId)
    const { data: config } = await db
        .from('integrations')
        .select('*')
        .eq('type', 'twilio')
        .single()

    if (!config || !config.is_active || !config.config) return null

    // Real implementation: decrypt secrets
    const { account_sid, auth_token } = config.config

    // Decrypt if needed (if stored encrypted)
    // const sid = decrypt(account_sid)
    // const token = decrypt(auth_token)

    return twilio(account_sid, auth_token)
}

export async function getTwilioConfig(tenantId: string) {
    const db = await getTenantClient(tenantId)
    const { data: config } = await db
        .from('integrations')
        .select('*')
        .eq('type', 'twilio')
        .single()

    return config?.config || null
}

export async function sendWhatsApp(tenantId: string, to: string, message: string) {
    const client = await getTwilioClientForTenant(tenantId)
    if (!client) throw new Error('Twilio not configured for this tenant')

    const config = await getTwilioConfig(tenantId)

    return client.messages.create({
        from: `whatsapp:${config.iphone_number || config.phone_number}`, // config.phone_number should include + prefix
        to: `whatsapp:${to}`,
        body: message
    })
}
