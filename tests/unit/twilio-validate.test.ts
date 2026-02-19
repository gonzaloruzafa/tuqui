import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock twilio before importing
vi.mock('twilio', () => ({
    default: {
        validateRequest: vi.fn()
    }
}))

import { validateTwilioSignature } from '@/lib/twilio/validate'
import twilio from 'twilio'

const mockValidateRequest = vi.mocked(twilio.validateRequest)

function makeRequest(headers: Record<string, string> = {}, url = 'https://tuqui.vercel.app/api/webhooks/twilio') {
    return {
        headers: new Headers(headers),
        url,
    } as any
}

describe('validateTwilioSignature', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        vi.stubEnv('TWILIO_AUTH_TOKEN', 'test-auth-token')
        vi.stubEnv('NODE_ENV', 'production')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    test('returns false when no auth token in production', () => {
        vi.stubEnv('TWILIO_AUTH_TOKEN', '')
        const result = validateTwilioSignature(makeRequest(), 'Body=hello&From=whatsapp:+123')
        expect(result).toBe(false)
    })

    test('returns true when no auth token in development', () => {
        vi.stubEnv('TWILIO_AUTH_TOKEN', '')
        vi.stubEnv('NODE_ENV', 'development')
        const result = validateTwilioSignature(makeRequest(), 'Body=hello')
        expect(result).toBe(true)
    })

    test('returns false when X-Twilio-Signature header is missing', () => {
        const result = validateTwilioSignature(makeRequest(), 'Body=hello')
        expect(result).toBe(false)
    })

    test('delegates to twilio.validateRequest with correct params', () => {
        mockValidateRequest.mockReturnValue(true)
        vi.stubEnv('NEXTAUTH_URL', 'https://tuqui.vercel.app')
        
        const req = makeRequest({ 'x-twilio-signature': 'valid-sig' })
        const body = 'Body=hello&From=whatsapp%3A%2B5491112345678'
        
        const result = validateTwilioSignature(req, body)
        
        expect(result).toBe(true)
        expect(mockValidateRequest).toHaveBeenCalledWith(
            'test-auth-token',
            'valid-sig',
            'https://tuqui.vercel.app/api/webhooks/twilio',
            { Body: 'hello', From: 'whatsapp:+5491112345678' }
        )
    })

    test('returns false when signature is invalid', () => {
        mockValidateRequest.mockReturnValue(false)
        
        const req = makeRequest({ 'x-twilio-signature': 'bad-sig' })
        const result = validateTwilioSignature(req, 'Body=hack')
        
        expect(result).toBe(false)
    })

    test('uses VERCEL_URL when NEXTAUTH_URL is not set', () => {
        mockValidateRequest.mockReturnValue(true)
        vi.stubEnv('NEXTAUTH_URL', '')
        vi.stubEnv('VERCEL_URL', 'tuqui-abc123.vercel.app')
        
        const req = makeRequest({ 'x-twilio-signature': 'sig' })
        validateTwilioSignature(req, 'Body=test')
        
        expect(mockValidateRequest).toHaveBeenCalledWith(
            'test-auth-token',
            'sig',
            'https://tuqui-abc123.vercel.app/api/webhooks/twilio',
            { Body: 'test' }
        )
    })
})
