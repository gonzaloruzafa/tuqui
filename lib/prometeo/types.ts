export interface PrometeoTask {
    id: string
    tenant_id?: string // In tenant DB context this might be implicit, but good to have
    agent_id: string
    user_email: string
    name: string
    prompt: string
    schedule: string // Cron expression
    is_active: boolean
    last_run_at: string | null
    next_run_at: string
}

export interface PushSubscription {
    endpoint: string
    keys: {
        p256dh: string
        auth: string
    }
}
