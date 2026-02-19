import twilio from 'twilio'
import { NextRequest } from 'next/server'

/**
 * Validates Twilio webhook signature using X-Twilio-Signature header.
 * 
 * In development without TWILIO_AUTH_TOKEN configured, logs a warning
 * and allows the request through (for local testing).
 * 
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioSignature(req: NextRequest, rawBody: string): boolean {
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!authToken) {
        console.warn('[Twilio] No TWILIO_AUTH_TOKEN — skipping signature validation')
        return process.env.NODE_ENV === 'development'
    }

    const signature = req.headers.get('x-twilio-signature')
    if (!signature) {
        console.warn('[Twilio] Missing X-Twilio-Signature header')
        return false
    }

    // Reconstruct the URL Twilio used to sign the request
    const url = buildWebhookUrl(req)

    // Parse body params for validation
    const params: Record<string, string> = {}
    const searchParams = new URLSearchParams(rawBody)
    for (const [key, value] of searchParams) {
        params[key] = value
    }

    return twilio.validateRequest(authToken, signature, url, params)
}

/**
 * Builds the webhook URL that Twilio used to sign the request.
 * Uses NEXTAUTH_URL/VERCEL_URL for production, falls back to request URL.
 */
function buildWebhookUrl(req: NextRequest): string {
    const baseUrl = process.env.NEXTAUTH_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

    if (baseUrl) {
        return `${baseUrl}/api/webhooks/twilio`
    }

    // Fallback: reconstruct from request
    return req.url
}
