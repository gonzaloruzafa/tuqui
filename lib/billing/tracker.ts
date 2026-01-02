import { getTenantClient } from '@/lib/supabase/client'
import { getTenantPlan, USAGE_LIMITS } from './limits'

export async function checkUsageLimit(tenantId: string, userEmail: string, estimatedTokens: number) {
    const plan = await getTenantPlan(tenantId)
    const db = await getTenantClient(tenantId)

    // Get current usage for month
    const currentMonth = new Date().toISOString().slice(0, 7) // 2025-12
    const { data: usage } = await db
        .from('usage_stats')
        .select('total_tokens')
        .eq('user_email', userEmail)
        .eq('year_month', currentMonth)
        .single()

    const currentTokens = usage?.total_tokens || 0

    // Check limit (Per user limit for PRO, or Global for FREE?)
    // Let's assume per-user limit for simplicity in Alpha based on user request "cobro por usuario"
    const limit = plan.tokens_per_user || USAGE_LIMITS.FREE_TIER.tokens_per_month

    if (currentTokens + estimatedTokens > limit) {
        throw new Error(`Monthly token limit reached for user (${currentTokens}/${limit})`)
    }
}

export async function trackUsage(tenantId: string, userEmail: string, tokens: number) {
    const db = await getTenantClient(tenantId)

    await db.rpc('increment_usage', {
        p_user_email: userEmail,
        p_tokens: tokens
    })
}
