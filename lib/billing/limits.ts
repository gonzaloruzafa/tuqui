export const USAGE_LIMITS = {
    FREE_TIER: {
        name: 'Free',
        max_users: 1,
        tokens_per_month: 100000,
        price: 0
    },
    PRO_TIER: {
        name: 'Pro',
        price_per_user: 500, // cents ($5.00)
        tokens_per_user: 500000,
    }
}

export async function getTenantPlan(tenantId: string) {
    // In real app, fetch from DB 'subscriptions' table
    // For Alpha, return PRO_TIER default
    return USAGE_LIMITS.PRO_TIER
}
