/**
 * Test: Verificar filtros de estado por defecto en todos los modelos
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getOdooClient } from '../lib/tools/odoo/client'

const TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

interface ModelTest {
    model: string
    stateField: string
    draftStates: string[]  // Estados que NO deberían incluirse por defecto
    validStates: string[]  // Estados que SÍ deberían incluirse
    dateField: string
    amountField?: string
}

const MODELS_TO_TEST: ModelTest[] = [
    {
        model: 'sale.order',
        stateField: 'state',
        draftStates: ['draft', 'sent', 'cancel'],
        validStates: ['sale', 'done'],
        dateField: 'date_order',
        amountField: 'amount_total'
    },
    {
        model: 'purchase.order',
        stateField: 'state', 
        draftStates: ['draft', 'sent', 'cancel'],
        validStates: ['purchase', 'done'],
        dateField: 'date_order',
        amountField: 'amount_total'
    },
    {
        model: 'account.move',
        stateField: 'state',
        draftStates: ['draft', 'cancel'],
        validStates: ['posted'],
        dateField: 'invoice_date',
        amountField: 'amount_total'
    },
    {
        model: 'stock.picking',
        stateField: 'state',
        draftStates: ['draft', 'cancel'],
        validStates: ['assigned', 'done'],
        dateField: 'scheduled_date'
    }
]

async function testModel(odoo: any, test: ModelTest) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📋 ${test.model}`)
    console.log('='.repeat(60))
    
    // Get all records from last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0]
    
    const domain: any[] = [[test.dateField, '>=', dateStr]]
    
    // Count by state
    try {
        const grouped = await odoo.readGroup(
            test.model,
            domain,
            [test.stateField],
            [test.stateField],
            `${test.stateField} asc`,
            100
        )
        
        console.log(`\nEstados encontrados (últimos 30 días):`)
        let totalDraft = 0
        let totalValid = 0
        let totalAll = 0
        
        for (const g of grouped) {
            const state = g[test.stateField]
            const count = g[`${test.stateField}_count`]
            totalAll += count
            
            const isDraft = test.draftStates.includes(state)
            const isValid = test.validStates.includes(state)
            
            if (isDraft) totalDraft += count
            if (isValid) totalValid += count
            
            const icon = isDraft ? '⚠️' : (isValid ? '✅' : '❓')
            console.log(`  ${icon} ${state}: ${count} registros`)
        }
        
        console.log(`\n📊 Resumen:`)
        console.log(`  Total registros: ${totalAll}`)
        console.log(`  ⚠️ Borradores/Cancelados: ${totalDraft} (${(totalDraft/totalAll*100).toFixed(1)}%)`)
        console.log(`  ✅ Válidos: ${totalValid} (${(totalValid/totalAll*100).toFixed(1)}%)`)
        
        if (totalDraft > 0 && test.amountField) {
            // Check monetary impact
            const draftDomain = [...domain, [test.stateField, 'in', test.draftStates]]
            const validDomain = [...domain, [test.stateField, 'in', test.validStates]]
            
            const draftRecords = await odoo.searchRead(test.model, draftDomain, [test.amountField], 1000)
            const validRecords = await odoo.searchRead(test.model, validDomain, [test.amountField], 1000)
            
            const draftTotal = draftRecords.reduce((sum: number, r: any) => sum + (r[test.amountField] || 0), 0)
            const validTotal = validRecords.reduce((sum: number, r: any) => sum + (r[test.amountField] || 0), 0)
            
            console.log(`\n💰 Impacto monetario:`)
            console.log(`  ⚠️ Monto en borradores: $${Math.round(draftTotal).toLocaleString('es-AR')}`)
            console.log(`  ✅ Monto válido: $${Math.round(validTotal).toLocaleString('es-AR')}`)
            console.log(`  📈 Diferencia si incluimos borradores: +${((draftTotal/validTotal)*100).toFixed(1)}%`)
        }
        
    } catch (e: any) {
        console.log(`  ❌ Error: ${e.message}`)
    }
}

async function main() {
    const odoo = await getOdooClient(TENANT_ID)
    
    console.log('🔍 Analizando filtros de estado por defecto en todos los modelos...\n')
    
    for (const test of MODELS_TO_TEST) {
        await testModel(odoo, test)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('📋 CONCLUSIÓN')
    console.log('='.repeat(60))
    console.log('Modelos que necesitan filtro de estado por defecto:')
    console.log('- sale.order: state in [sale, done]')
    console.log('- purchase.order: state in [purchase, done]')
    console.log('- stock.picking: state in [assigned, done]')
    console.log('- account.move: YA tiene filtro (state = posted)')
    console.log('- sale.order.line: YA tiene filtro (state in [sale, done])')
    console.log('- account.payment: YA tiene filtro (state = posted)')
}

main().catch(console.error)
