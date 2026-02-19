import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
    if (!secret) throw new Error('NEXTAUTH_SECRET or AUTH_SECRET required for encryption')
    // Derive a 32-byte key from the secret
    return Buffer.concat([Buffer.from(secret, 'utf-8'), Buffer.alloc(32)], 32)
}

export function encrypt(text: string): string {
    const key = getKey()
    const iv = randomBytes(12) // 96-bit IV for GCM
    const cipher = createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return `gcm:${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(text: string): string {
    if (!text || typeof text !== 'string') return ''

    // Legacy base64 format — backwards compatible read
    if (text.startsWith('enc:')) {
        return Buffer.from(text.slice(4), 'base64').toString('utf-8')
    }

    // Plain text (unencrypted legacy data)
    if (!text.startsWith('gcm:')) return text

    // AES-256-GCM format: gcm:iv:authTag:ciphertext
    const key = getKey()
    const [, ivHex, authTagHex, ciphertext] = text.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}
