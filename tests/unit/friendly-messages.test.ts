import { describe, it, expect } from 'vitest'
import { getFriendlyError, formatErrorResponse, formatErrorForUser } from '@/lib/errors/friendly-messages'

describe('getFriendlyError', () => {
  const cases = [
    {
      input: 'Monthly token limit reached for user (502959/500000)',
      expectedMessage: '⚠️ Límite mensual de tokens alcanzado',
      expectedRetryable: false,
      expectedStatus: 429,
    },
    {
      input: 'quota exceeded',
      expectedMessage: '⚠️ Límite mensual de tokens alcanzado',
      expectedRetryable: false,
      expectedStatus: 429,
    },
    {
      input: 'rate limit exceeded',
      expectedMessage: '🕒 Demasiadas consultas',
      expectedRetryable: true,
      expectedStatus: 429,
    },
    {
      input: 'too many requests',
      expectedMessage: '🕒 Demasiadas consultas',
      expectedRetryable: true,
      expectedStatus: 429,
    },
    {
      input: 'resource_exhausted',
      expectedMessage: '📊 Cuota de API agotada',
      expectedRetryable: false,
      expectedStatus: 429,
    },
    {
      input: 'authentication failed',
      expectedMessage: '🔒 Error de autenticación',
      expectedRetryable: false,
      expectedStatus: 401,
    },
    {
      input: 'fetch failed',
      expectedMessage: '🌐 Error de conexión',
      expectedRetryable: true,
      expectedStatus: 503,
    },
    {
      input: 'request timed out',
      expectedMessage: '⏱️ Tiempo de espera agotado',
      expectedRetryable: true,
      expectedStatus: 504,
    },
    {
      input: 'something completely unknown went wrong',
      expectedMessage: '❌ Error inesperado',
      expectedRetryable: true,
      expectedStatus: 500,
    },
  ]

  it.each(cases)('$input → $expectedMessage', ({ input, expectedMessage, expectedRetryable, expectedStatus }) => {
    const result = getFriendlyError(new Error(input))
    expect(result.message).toBe(expectedMessage)
    expect(result.retryable).toBe(expectedRetryable)
    expect(result.statusCode).toBe(expectedStatus)
  })

  it('extracts token usage from error message', () => {
    const result = getFriendlyError(new Error('Monthly token limit reached for user (502959/500000)'))
    expect(result.suggestion).toContain('502959')
    expect(result.suggestion).toContain('500000')
  })

  it('handles null/undefined errors gracefully', () => {
    expect(getFriendlyError(null).message).toBe('❌ Error inesperado')
    expect(getFriendlyError(undefined).message).toBe('❌ Error inesperado')
  })
})

describe('formatErrorResponse', () => {
  it('returns error + suggestion + retryable', () => {
    const result = formatErrorResponse(new Error('Monthly token limit reached for user (100/200)'))
    expect(result.error).toBe('⚠️ Límite mensual de tokens alcanzado')
    expect(result.suggestion).toBeDefined()
    expect(result.retryable).toBe(false)
  })
})

describe('formatErrorForUser', () => {
  it('combines message and suggestion', () => {
    const result = formatErrorForUser(new Error('timeout'))
    expect(result).toContain('⏱️ Tiempo de espera agotado')
    expect(result).toContain('Intentá')
  })
})
