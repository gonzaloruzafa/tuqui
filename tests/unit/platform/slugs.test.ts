import { describe, test, expect } from 'vitest'
import { generateSlug } from '@/lib/platform/slugs'

describe('generateSlug', () => {
  const cases = [
    { input: 'Empresa ABC', expected: 'empresa-abc' },
    { input: 'Café & Más', expected: 'cafe-mas' },
    { input: '  Spaces  Around  ', expected: 'spaces-around' },
    { input: 'UPPERCASE', expected: 'uppercase' },
    { input: 'with---dashes', expected: 'with-dashes' },
    { input: 'números 123', expected: 'numeros-123' },
    { input: 'ñoño', expected: 'nono' },
    { input: 'hello world!@#$%', expected: 'hello-world' },
    { input: 'Adhoc Inc.', expected: 'adhoc-inc' },
  ]

  test.each(cases)('$input → $expected', ({ input, expected }) => {
    expect(generateSlug(input)).toBe(expected)
  })
})
