/**
 * Push Notification Sender
 *
 * Extracted from prometeo/notifier.ts for reuse across the app.
 * Used by: Intelligence Layer cron, Prometeo notifier, future features.
 */

import { getClient } from '@/lib/supabase/client'
import webpush from 'web-push'

// Configure VAPID once at module load
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@tuqui.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
    )
}

export interface PushPayload {
    title: string
    body: string
    url?: string
    tag?: string
    icon?: string
}

interface PushResult {
    sent: number
    failed: number
    expired: number
}

/**
 * Send push notification to a specific user (all their subscriptions)
 */
export async function sendPushToUser(
    userId: string,
    payload: PushPayload,
): Promise<PushResult> {
    const db = getClient()

    const { data: subs } = await db
        .from('push_subscriptions')
        .select('id, subscription')
        .eq('user_id', userId)

    if (!subs?.length) return { sent: 0, failed: 0, expired: 0 }

    const result: PushResult = { sent: 0, failed: 0, expired: 0 }

    for (const sub of subs) {
        try {
            await webpush.sendNotification(
                sub.subscription,
                JSON.stringify({
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon || '/icons/icon-192.png',
                    badge: '/icons/badge-72.png',
                    tag: payload.tag || 'tuqui',
                    data: { url: payload.url || '/' },
                }),
            )
            result.sent++
        } catch (err: unknown) {
            const statusCode = (err as { statusCode?: number }).statusCode
            if (statusCode === 410 || statusCode === 404) {
                // Subscription expired — clean up
                await db.from('push_subscriptions').delete().eq('id', sub.id)
                result.expired++
            } else {
                result.failed++
            }
        }
    }

    return result
}

/**
 * Send push notification to all users in a tenant
 */
export async function sendPushToTenant(
    tenantId: string,
    payload: PushPayload,
): Promise<PushResult> {
    const db = getClient()

    const { data: subs } = await db
        .from('push_subscriptions')
        .select('id, subscription, user_id')
        .eq('tenant_id', tenantId)

    if (!subs?.length) return { sent: 0, failed: 0, expired: 0 }

    const result: PushResult = { sent: 0, failed: 0, expired: 0 }

    for (const sub of subs) {
        try {
            await webpush.sendNotification(
                sub.subscription,
                JSON.stringify({
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon || '/icons/icon-192.png',
                    badge: '/icons/badge-72.png',
                    tag: payload.tag || 'tuqui',
                    data: { url: payload.url || '/' },
                }),
            )
            result.sent++
        } catch (err: unknown) {
            const statusCode = (err as { statusCode?: number }).statusCode
            if (statusCode === 410 || statusCode === 404) {
                await db.from('push_subscriptions').delete().eq('id', sub.id)
                result.expired++
            } else {
                result.failed++
            }
        }
    }

    return result
}
