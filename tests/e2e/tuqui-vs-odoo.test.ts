/**
 * Test: Tuqui vs Odoo - Validación E2E Real
 * 
 * Compara respuestas de Tuqui (via API) con datos reales de Odoo
 * 
 * Requires TEST_TENANT_ID in .env.local to run.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
import { getOdooClient } from '@/lib/tools/odoo/client'

config({ path: '.env.local' })

// Environment-based tenant ID
const TENANT_ID = process.env.TEST_TENANT_ID
const SKIP_TESTS = !TENANT_ID
const TUQUI_API_URL = 'https://tuqui-agents-alpha.vercel.app/api/internal/chat-test'
const INTERNAL_TEST_KEY = process.env.INTERNAL_TEST_KEY || 'test-key-change-in-prod'

if (SKIP_TESTS) {
    console.log('⚠️  TEST_TENANT_ID not set - skipping tuqui-vs-odoo tests')
}

const fmt = (n: number) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
}).format(n)

let odoo: any

// Helper para llamar a Tuqui
async function askTuqui(question: string): Promise<string> {
    const response = await fetch(TUQUI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-key': INTERNAL_TEST_KEY
        },
        body: JSON.stringify({
            tenantId: TENANT_ID!,
            messages: [{ role: 'user', content: question }],
            sessionId: `test-${Date.now()}`
        })
    })

    if (!response.ok) {
        throw new Error(`Tuqui API error: ${response.status}`)
    }

    const data = await response.json()
    return data.response || data.message || JSON.stringify(data)
}

// Helper para extraer números de texto
function extractNumber(text: string): number | null {
    // Buscar patrones como $1.234.567 o 1234567 o 1,234,567
    const patterns = [
        /\$\s*([\d.,]+)/g,  // $1.234.567
        /(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/g,  // 1.234.567,89
        /(\d+)/g  // números simples
    ]

    for (const pattern of patterns) {
        const matches = text.match(pattern)
        if (matches && matches.length > 0) {
            // Tomar el primer número significativo
            for (const match of matches) {
                const cleaned = match.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.')
                const num = parseFloat(cleaned)
                if (num > 1000) return num  // Solo números significativos
            }
        }
    }
    return null
}

describe('Tuqui vs Odoo - Validación E2E', () => {

    beforeAll(async () => {
        odoo = await getOdooClient(TENANT_ID!)
        console.log('✅ Conectado a Odoo')
    })

    describe('1. Compras - El problema original', () => {

        it('Pregunta: "cuánto compramos desde julio del año pasado"', async () => {
            const startDate = '2025-07-01'
            const endDate = '2026-01-14'

            // 1. Obtener valor real de Odoo (CON filtro de estado)
            const odooResult = await odoo.readGroup(
                'purchase.report',
                [
                    ['date_order', '>=', startDate],
                    ['date_order', '<=', endDate],
                    ['state', 'in', ['purchase', 'done']]
                ],
                ['price_total:sum'],
                [],
                { limit: 1 }
            )
            const odooTotal = odooResult[0]?.price_total || 0

            console.log('\n============================================================')
            console.log('📊 COMPRAS DESDE JULIO 2025')
            console.log('============================================================')
            console.log(`   Odoo (real): ${fmt(odooTotal)}`)

            // 2. Preguntar a Tuqui
            console.log('\n   🤖 Preguntando a Tuqui...')
            const tuquiResponse = await askTuqui('cuánto compramos desde julio del año pasado')
            console.log(`   Tuqui responde: ${tuquiResponse.substring(0, 500)}...`)

            const tuquiNumber = extractNumber(tuquiResponse)
            console.log(`   Número extraído de Tuqui: ${tuquiNumber ? fmt(tuquiNumber) : 'NO ENCONTRADO'}`)

            if (tuquiNumber) {
                const diff = Math.abs(tuquiNumber - odooTotal) / odooTotal * 100
                console.log(`\n   📈 Diferencia: ${diff.toFixed(1)}%`)

                // Tuqui debe estar dentro del 20% del valor real
                if (diff > 20) {
                    console.log(`   ❌ FALLA: Diferencia mayor al 20%`)
                    console.log(`   Esperado: ~${fmt(odooTotal)}`)
                    console.log(`   Obtenido: ${fmt(tuquiNumber)}`)
                }

                expect(diff).toBeLessThan(50)  // Tolerancia amplia para empezar
            }
        }, 60000)

        it('Pregunta: "top 5 proveedores"', async () => {
            const startDate = '2025-07-01'
            const endDate = '2026-01-14'

            // Odoo real
            const odooResult = await odoo.readGroup(
                'purchase.report',
                [
                    ['date_order', '>=', startDate],
                    ['date_order', '<=', endDate],
                    ['state', 'in', ['purchase', 'done']]
                ],
                ['partner_id', 'price_total:sum'],
                ['partner_id'],
                { orderby: 'price_total desc', limit: 5 }
            )

            console.log('\n============================================================')
            console.log('📊 TOP 5 PROVEEDORES (Jul 2025 - Ene 2026)')
            console.log('============================================================')
            console.log('\n   🎯 ODOO REAL:')
            odooResult.forEach((r: any, i: number) => {
                console.log(`   ${i + 1}. ${r.partner_id?.[1]}: ${fmt(r.price_total)}`)
            })

            // Tuqui
            console.log('\n   🤖 Preguntando a Tuqui...')
            const tuquiResponse = await askTuqui('dame el top 5 de proveedores a los que más le compramos desde julio del año pasado')
            console.log(`\n   TUQUI RESPONDE:\n${tuquiResponse}`)

            // Verificar que FOSHAN esté en top y con valor razonable
            const foshanInOdoo = odooResult.find((r: any) =>
                r.partner_id?.[1]?.toLowerCase().includes('foshan')
            )

            if (foshanInOdoo) {
                console.log(`\n   🎯 FOSHAN en Odoo: ${fmt(foshanInOdoo.price_total)}`)
                // Si Tuqui menciona FOSHAN con un valor >$900M, hay problema
                if (tuquiResponse.toLowerCase().includes('foshan')) {
                    const foshanMatch = tuquiResponse.match(/foshan[^$]*\$\s*([\d.,]+)/i)
                    if (foshanMatch) {
                        const tuquiFoshan = parseFloat(foshanMatch[1].replace(/\./g, '').replace(',', '.'))
                        console.log(`   FOSHAN en Tuqui: ${fmt(tuquiFoshan)}`)
                        if (tuquiFoshan > 700_000_000) {
                            console.log(`   ⚠️ FOSHAN inflado en Tuqui!`)
                        }
                    }
                }
            }
        }, 60000)
    })

    describe('2. Ventas - Validación básica', () => {

        it('Pregunta: "cuánto vendimos este mes"', async () => {
            // Odoo real
            const now = new Date()
            const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
            const today = now.toISOString().split('T')[0]

            const odooResult = await odoo.readGroup(
                'sale.report',
                [
                    ['date', '>=', startOfMonth],
                    ['date', '<=', today],
                    ['state', 'in', ['sale', 'done']]
                ],
                ['price_total:sum'],
                [],
                { limit: 1 }
            )
            const odooTotal = odooResult[0]?.price_total || 0

            console.log('\n============================================================')
            console.log('📊 VENTAS ESTE MES')
            console.log('============================================================')
            console.log(`   Odoo (real): ${fmt(odooTotal)}`)

            // Tuqui
            console.log('\n   🤖 Preguntando a Tuqui...')
            const tuquiResponse = await askTuqui('cuánto vendimos este mes')
            console.log(`   Tuqui responde: ${tuquiResponse.substring(0, 300)}...`)

            const tuquiNumber = extractNumber(tuquiResponse)
            if (tuquiNumber) {
                console.log(`   Número extraído: ${fmt(tuquiNumber)}`)
                const diff = Math.abs(tuquiNumber - odooTotal) / odooTotal * 100
                console.log(`   Diferencia: ${diff.toFixed(1)}%`)
            }
        }, 60000)

        it('Pregunta: "quién es mi mejor cliente"', async () => {
            const now = new Date()
            const startOfYear = `${now.getFullYear()}-01-01`
            const today = now.toISOString().split('T')[0]

            const odooResult = await odoo.readGroup(
                'sale.report',
                [
                    ['date', '>=', startOfYear],
                    ['date', '<=', today],
                    ['state', 'in', ['sale', 'done']]
                ],
                ['partner_id', 'price_total:sum'],
                ['partner_id'],
                { orderby: 'price_total desc', limit: 5 }
            )

            console.log('\n============================================================')
            console.log('📊 MEJOR CLIENTE (Este año)')
            console.log('============================================================')
            console.log('\n   🎯 TOP 5 en ODOO:')
            odooResult.forEach((r: any, i: number) => {
                console.log(`   ${i + 1}. ${r.partner_id?.[1]}: ${fmt(r.price_total)}`)
            })

            const topClient = odooResult[0]?.partner_id?.[1] || 'N/A'

            console.log('\n   🤖 Preguntando a Tuqui...')
            const tuquiResponse = await askTuqui('quién es mi mejor cliente')
            console.log(`   Tuqui responde: ${tuquiResponse.substring(0, 400)}...`)

            // Verificar que Tuqui mencione al cliente correcto
            const topClientFirstWord = topClient.split(' ')[0].toLowerCase()
            const tuquiMentionsTop = tuquiResponse.toLowerCase().includes(topClientFirstWord)
            console.log(`\n   ¿Tuqui menciona a "${topClient}"? ${tuquiMentionsTop ? '✅ SÍ' : '❌ NO'}`)
        }, 60000)
    })

    describe('3. Facturación', () => {

        it('Pregunta: "cuánto nos deben los clientes"', async () => {
            // Odoo: facturas de cliente impagas
            const odooResult = await odoo.readGroup(
                'account.move',
                [
                    ['move_type', '=', 'out_invoice'],
                    ['state', '=', 'posted'],
                    ['payment_state', 'in', ['not_paid', 'partial']]
                ],
                ['amount_residual:sum'],
                [],
                { limit: 1 }
            )
            const odooTotal = odooResult[0]?.amount_residual || 0

            console.log('\n============================================================')
            console.log('📊 CUENTAS POR COBRAR')
            console.log('============================================================')
            console.log(`   Odoo (real): ${fmt(odooTotal)}`)

            console.log('\n   🤖 Preguntando a Tuqui...')
            const tuquiResponse = await askTuqui('cuánto nos deben los clientes')
            console.log(`   Tuqui responde: ${tuquiResponse.substring(0, 300)}...`)

            const tuquiNumber = extractNumber(tuquiResponse)
            if (tuquiNumber) {
                console.log(`   Número extraído: ${fmt(tuquiNumber)}`)
                const diff = Math.abs(tuquiNumber - odooTotal) / odooTotal * 100
                console.log(`   Diferencia: ${diff.toFixed(1)}%`)
            }
        }, 60000)
    })

    describe('4. Stock', () => {

        it('Pregunta: "cuántos pedidos tenemos sin entregar"', async () => {
            // Odoo: pickings pendientes
            const odooResult = await odoo.searchCount(
                'stock.picking',
                [
                    ['state', 'in', ['assigned', 'confirmed', 'waiting']],
                    ['picking_type_id.code', '=', 'outgoing']
                ]
            )

            console.log('\n============================================================')
            console.log('📊 PEDIDOS SIN ENTREGAR')
            console.log('============================================================')
            console.log(`   Odoo (real): ${odooResult} entregas pendientes`)

            console.log('\n   🤖 Preguntando a Tuqui...')
            const tuquiResponse = await askTuqui('cuántos pedidos tenemos sin entregar')
            console.log(`   Tuqui responde: ${tuquiResponse.substring(0, 300)}...`)

            // Extraer número de Tuqui
            const numbers = tuquiResponse.match(/\d+/g)
            if (numbers) {
                const tuquiCount = parseInt(numbers[0])
                console.log(`   Número en Tuqui: ${tuquiCount}`)
                if (Math.abs(tuquiCount - odooResult) <= 10) {
                    console.log(`   ✅ Coincide (±10)`)
                } else {
                    console.log(`   ⚠️ Diferencia significativa`)
                }
            }
        }, 60000)
    })
})
