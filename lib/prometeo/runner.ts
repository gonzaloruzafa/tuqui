import { getTenantClient, getTenantConfig } from '@/lib/supabase/tenant'
import { getMasterClient } from '@/lib/supabase/master'
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import webpush from 'web-push'
import { PrometeoTask } from './types'

// Configure Web Push (should be done once)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@tuqui.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    )
}

export async function runPendingTasks() {
    console.log('[Prometeo] Starting run...')
    const master = getMasterClient()

    // 1. Get all active tenants
    const { data: tenants } = await master.from('tenants').select('id, slug').eq('is_active', true)
    if (!tenants) return

    for (const tenant of tenants) {
        console.log(`[Prometeo] Checking tenant: ${tenant.slug}`)
        try {
            await processTenantTasks(tenant.id)
        } catch (e) {
            console.error(`[Prometeo] Error processing tenant ${tenant.slug}:`, e)
        }
    }
    console.log('[Prometeo] Run complete.')
}

async function processTenantTasks(tenantId: string) {
    const db = await getTenantClient(tenantId)

    // 2. Get pending tasks
    // Logic: next_run_at <= now AND is_active = true
    const now = new Date().toISOString()
    const { data: tasks } = await db
        .from('prometeo_tasks')
        .select('*')
        .eq('is_active', true)
        .lte('next_run_at', now)

    if (!tasks || tasks.length === 0) return

    console.log(`[Prometeo] Found ${tasks.length} tasks for tenant ${tenantId}`)

    for (const task of tasks) {
        await executeTask(tenantId, task)
    }
}

async function executeTask(tenantId: string, task: PrometeoTask) {
    console.log(`[Prometeo] Executing task: ${task.name}`)
    const db = await getTenantClient(tenantId)

    try {
        // 1. Run Agent Logic
        // Fetch agent system prompt + task prompt
        const { data: agent } = await db.from('agents').select('*').eq('id', task.agent_id).single()
        if (!agent) throw new Error('Agent not found')

        // Generate content
        const { text } = await generateText({
            model: google('gemini-2.5-flash'),
            system: agent.system_prompt || 'Sos un asistente útil.',
            prompt: `TASK CONTEXT: This is a scheduled task named "${task.name}".
USER PROMPT: ${task.prompt}
Please generate a concise notification/summary based on this request. max 200 chars if possible.`
        })

        // 2. Send Push Notification
        // Get user subscription
        const { data: subs } = await db
            .from('push_subscriptions')
            .select('*')
            .eq('user_email', task.user_email)

        if (subs && subs.length > 0) {
            for (const sub of subs) {
                try {
                    await webpush.sendNotification(sub.subscription, JSON.stringify({
                        title: `Tuqui: ${agent.name}`,
                        body: text,
                        icon: '/icon-192.png'
                    }))
                } catch (e) {
                    console.error('Push failed', e)
                }
            }
        }

        // 3. Update next_run_at (Simple logic: add 24h for daily, needs real cron parser)
        // For Alpha, let's assume all tasks are daily
        const nextRun = new Date(new Date().getTime() + 24 * 60 * 60 * 1000)

        await db.from('prometeo_tasks').update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRun.toISOString()
        }).eq('id', task.id)

    } catch (error) {
        console.error(`[Prometeo] Task failed: ${task.id}`, error)
    }
}
