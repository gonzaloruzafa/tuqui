import { getOdooClient } from './lib/tools/odoo/client'

async function test() {
    const tenantId = 'ddf33242-df66-4171-8cdb-0f622e96d744'
    console.log('Testing Odoo for tenant:', tenantId)
    try {
        const client = await getOdooClient(tenantId)
        console.log('Client created. Authenticating...')
        const uid = await client.authenticate()
        console.log('Authenticated! UID:', uid)

        console.log('Testing search_read on sale.order...')
        const sales = await client.searchRead('sale.order', [], ['name', 'amount_total'], 1)
        console.log('Sales found:', sales)
    } catch (e) {
        console.error('Test failed:', e)
    }
}

test()
