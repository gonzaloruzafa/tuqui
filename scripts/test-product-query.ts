/**
 * Test para debugear el resultado de productos vendidos
 */

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

console.log('ENV check:')
console.log('  SUPABASE_URL:', SUPABASE_URL)
console.log('  SERVICE_KEY:', SUPABASE_SERVICE_KEY ? `${SUPABASE_SERVICE_KEY.substring(0, 20)}...` : 'NOT SET')

async function testProductQuery() {
    console.log('\n🔍 Testing product query...\n')

    // Get tenant
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: tenants, error } = await db.from('tenants').select('id, name')
    
    console.log('Tenants query result:', { count: tenants?.length, error })
    
    if (!tenants || tenants.length === 0) {
        console.log('❌ No tenants found')
        return
    }
    
    const tenant = tenants[0]
    console.log('Tenant:', tenant.id, tenant.name)
    
    // Get Odoo integration
    const { data: integration } = await db
        .from('integrations')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('type', 'odoo')
        .single()
        
    console.log('Odoo integration:', integration?.config?.odoo_url)
    console.log()
    
    // Test con executeIntelligentQuery
    const { executeIntelligentQuery } = await import('../lib/tools/gemini-odoo-v2')
    
    const args = {
        queries: [{
            id: 'q1',
            model: 'sale.order.line',
            operation: 'aggregate',
            filters: 'agosto 2025 confirmadas',
            groupBy: ['product_id'],
            limit: 5,
            orderBy: 'price_subtotal desc'
        }],
        include_insights: false
    }
    
    console.log('📊 Query args:', JSON.stringify(args, null, 2))
    console.log()
    
    const result = await executeIntelligentQuery(tenant.id, args)
    
    console.log('📋 Result:')
    console.log('  success:', result.success)
    console.log('  count:', result.count)
    console.log('  total:', result.total)
    console.log('  cached:', result.cached)
    console.log('  executionMs:', result.executionMs)
    console.log()
    
    if (result.error) {
        console.log('❌ Error:', result.error)
        return
    }
    
    if (result.grouped) {
        console.log('📊 Grouped data:')
        for (const [name, data] of Object.entries(result.grouped)) {
            console.log(`  "${name}": count=${data.count}, total=${data.total.toLocaleString('es-AR')}`)
        }
    }
    
    if (result.data) {
        console.log('📋 Raw data (first 3):')
        console.log(JSON.stringify(result.data.slice(0, 3), null, 2))
    }
}

testProductQuery().catch(console.error)
