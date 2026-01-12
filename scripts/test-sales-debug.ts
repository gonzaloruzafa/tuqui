/**
 * Debug: Ventas primera semana diciembre - Ver output RAW de la tool
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { chatWithOdoo } from '../lib/tools/gemini-odoo'

const TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

async function main() {
    console.log('=== Testing: ventas primera semana diciembre ===\n')
    
    const result = await chatWithOdoo(
        TENANT_ID,
        'Sos un asistente de BI',
        'ventas primera semana diciembre 2025 agrupadas por cliente, dame el top 10',
        []
    )
    
    console.log('\n=== TOOL CALLS ===')
    console.log(JSON.stringify(result.toolCalls, null, 2))
    
    console.log('\n=== TOOL RESULTS (raw) ===')
    if (result.toolResults?.[0]) {
        const tr = result.toolResults[0]
        console.log('Success:', tr.success)
        console.log('Count:', tr.count)
        console.log('Total:', tr.total)
        console.log('\nGrouped data (top 15):')
        if (tr.grouped) {
            const sorted = Object.entries(tr.grouped)
                .sort((a: any, b: any) => b[1].total - a[1].total)
                .slice(0, 15)
            for (const [name, data] of sorted) {
                console.log(`  ${name}: $${Math.round((data as any).total).toLocaleString('es-AR')}`)
            }
        } else {
            console.log('No grouped data - showing raw data:')
            console.log(JSON.stringify(tr.data?.slice(0, 10), null, 2))
        }
    }
    
    console.log('\n=== LLM RESPONSE ===')
    console.log(result.text)
}

main().catch(console.error)
