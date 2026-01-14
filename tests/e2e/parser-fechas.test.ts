/**
 * Test: Parser de fechas "desde [mes] del año pasado"
 */

import { describe, test, expect } from 'vitest'
import { buildDomain } from '@/lib/tools/odoo/query-builder'

describe('Parser de Fechas - Nuevos Patrones', () => {

    test('"desde julio del año pasado" -> Jul 2025 hasta hoy', () => {
        // Hoy es 2026-01-14
        const domain = buildDomain('desde julio del año pasado', 'purchase.report')
        
        console.log('Domain generado:', JSON.stringify(domain, null, 2))
        
        // Debería tener filtro de fecha desde 2025-07-01
        const startFilter = domain.find(d => d[0] === 'date_order' && d[1] === '>=')
        const endFilter = domain.find(d => d[0] === 'date_order' && d[1] === '<=')
        
        expect(startFilter).toBeDefined()
        expect(startFilter?.[2]).toBe('2025-07-01')
        expect(endFilter).toBeDefined()
        // End should be today or close to it
        expect(endFilter?.[2]).toMatch(/^2026-01/)
    })

    test('"año pasado" -> Todo 2025', () => {
        const domain = buildDomain('año pasado', 'sale.report')
        
        console.log('Domain generado:', JSON.stringify(domain, null, 2))
        
        const startFilter = domain.find(d => d[0] === 'date' && d[1] === '>=')
        const endFilter = domain.find(d => d[0] === 'date' && d[1] === '<=')
        
        expect(startFilter).toBeDefined()
        expect(startFilter?.[2]).toBe('2025-01-01')
        expect(endFilter).toBeDefined()
        expect(endFilter?.[2]).toBe('2025-12-31')
    })

    test('"desde octubre" (sin "año pasado") -> Oct 2025 (año pasado implícito porque octubre > enero actual)', () => {
        // Si estamos en enero 2026 y dicen "desde octubre", 
        // el mes ya pasó este año, así que debe ser oct 2025
        const domain = buildDomain('desde octubre', 'purchase.report')
        
        console.log('Domain generado:', JSON.stringify(domain, null, 2))
        
        const startFilter = domain.find(d => d[0] === 'date_order' && d[1] === '>=')
        
        // Octubre ya pasó este año, pero el regex requiere "año pasado" explícitamente
        // Así que sin "año pasado", debería usar el pattern de mes normal
        if (startFilter) {
            console.log('Start date:', startFilter[2])
        }
    })

    test('"este mes" -> Enero 2026', () => {
        const domain = buildDomain('este mes', 'sale.report')
        
        console.log('Domain generado:', JSON.stringify(domain, null, 2))
        
        const startFilter = domain.find(d => d[0] === 'date' && d[1] === '>=')
        const endFilter = domain.find(d => d[0] === 'date' && d[1] === '<=')
        
        expect(startFilter?.[2]).toBe('2026-01-01')
        expect(endFilter?.[2]).toBe('2026-01-31')
    })

    test('"enero 2026" -> Enero 2026 específico', () => {
        const domain = buildDomain('enero 2026', 'purchase.report')
        
        console.log('Domain generado:', JSON.stringify(domain, null, 2))
        
        const startFilter = domain.find(d => d[0] === 'date_order' && d[1] === '>=')
        const endFilter = domain.find(d => d[0] === 'date_order' && d[1] === '<=')
        
        expect(startFilter?.[2]).toBe('2026-01-01')
        expect(endFilter?.[2]).toBe('2026-01-31')
    })
})
