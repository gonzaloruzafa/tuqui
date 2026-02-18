import { describe, it, expect, vi, beforeEach } from 'vitest'

// Set env before importing
vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-key-for-unit-tests-only!')

const { encrypt, decrypt } = await import('@/lib/crypto')

describe('crypto', () => {
    it('encrypts and decrypts correctly with AES-256-GCM', () => {
        const original = 'my-secret-api-key-12345'
        const encrypted = encrypt(original)
        expect(encrypted).toMatch(/^gcm:/)
        expect(encrypted).not.toContain(original)
        expect(decrypt(encrypted)).toBe(original)
    })

    it('handles empty and null input gracefully', () => {
        expect(decrypt('')).toBe('')
        expect(decrypt(null as any)).toBe('')
        expect(decrypt(undefined as any)).toBe('')
    })

    it('decrypts legacy enc: base64 format (backwards compatible)', () => {
        const original = 'my-old-password'
        const legacyEncrypted = `enc:${Buffer.from(original).toString('base64')}`
        expect(decrypt(legacyEncrypted)).toBe(original)
    })

    it('returns plain text for unrecognized formats', () => {
        expect(decrypt('plain-text-value')).toBe('plain-text-value')
    })

    it('produces different ciphertexts for same input (random IV)', () => {
        const text = 'same-input'
        const enc1 = encrypt(text)
        const enc2 = encrypt(text)
        expect(enc1).not.toBe(enc2) // random IV
        expect(decrypt(enc1)).toBe(text)
        expect(decrypt(enc2)).toBe(text)
    })

    it('detects tampering (GCM auth tag)', () => {
        const encrypted = encrypt('sensitive-data')
        // Tamper with the ciphertext
        const parts = encrypted.split(':')
        parts[3] = parts[3].replace(/a/g, 'b')
        const tampered = parts.join(':')
        expect(() => decrypt(tampered)).toThrow()
    })
})
