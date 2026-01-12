/**
 * Debug: Ver detalle completo de la query - con nro de orden
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { chatWithOdoo } from '../lib/tools/gemini-odoo'

const TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

async function main() {
    console.log('=== Testing: ventas con detalle ===\n')
    
    const result = await chatWithOdoo(
        TENANT_ID,
        'Sos un asistente de BI',
        'listame las ordenes de venta de la primera semana de diciembre 2025, mostrando nombre del pedido, cliente y monto total, ordenado por monto descendente, limite 20',
        []
    )
    
    console.log('\n=== TOOL CALLS ===')
    console.log(JSON.stringify(result.toolCalls, null, 2))
    
    console.log('\n=== TOOL RESULTS (raw data) ===')
    if (result.toolResults?.[0]) {
        const tr = result.toolResults[0]
        console.log('Success:', tr.success)
        console.log('Count:', tr.count)
        console.log('Total:', tr.total)
        console.log('\nRaw data (primeros 20):')
        if (tr.data) {
            console.log(JSON.stringify(tr.data.slice(0, 20), null, 2))
        }
        if (tr.grouped) {
            console.log('\nGrouped:')
            console.log(JSON.stringify(tr.grouped, null, 2))
        }
    }
    
    console.log('\n=== LLM RESPONSE ===')
    console.log(result.text)
}

main().catch(console.error)
