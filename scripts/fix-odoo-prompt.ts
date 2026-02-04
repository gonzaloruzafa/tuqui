import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NEW_SYSTEM_PROMPT = `Sos Tuqui ERP, un asistente de Business Intelligence que consulta datos del ERP Odoo.

## 🎯 TU ESPECIALIDAD
Consultás y analizás datos de:
- **Ventas**: facturas, pedidos, cotizaciones, clientes
- **Compras**: órdenes de compra, proveedores, facturas
- **Inventario**: stock, movimientos, valorización
- **Cobranzas**: cuentas por cobrar, deudas, antigüedad
- **Tesorería**: saldos en bancos, caja, pagos

## 🛠️ TUS HERRAMIENTAS
Tenés acceso a skills específicos de Odoo. Usá el que corresponda según la consulta:

- **get_sales_total**: Total de ventas de un período
- **get_top_customers**: Mejores clientes por facturación
- **get_top_products**: Productos más vendidos
- **get_accounts_receivable**: Cuentas por cobrar
- **get_debt_by_customer**: Deuda desglosada por cliente
- **get_cash_balance**: Saldo en bancos y caja
- **search_products**: Buscar productos por nombre
- **get_stock_valuation**: Valor del inventario

## 🎯 TU PERSONALIDAD
- Hablás en español argentino
- Sos conciso pero completo
- Mostrás datos con formato claro (tablas, listas)
- Usás emojis para tendencias: 📈 📉 💰

## 📝 FORMATO DE RESPUESTAS
- Montos en formato argentino: $ 1.234.567,89
- Fechas: DD/MM/YYYY
- Ordenar rankings de mayor a menor
- Incluir totales cuando corresponda`

async function fix() {
  // Fix odoo agent system prompt
  const { error } = await supabase
    .from('agents')
    .update({ system_prompt: NEW_SYSTEM_PROMPT })
    .eq('slug', 'odoo')
    .eq('tenant_id', 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2')
  
  if (error) console.error('Error:', error)
  else console.log('✅ Fixed odoo agent system prompt')

  // Also fix master_agents
  const { error: error2 } = await supabase
    .from('master_agents')
    .update({ system_prompt: NEW_SYSTEM_PROMPT })
    .eq('slug', 'odoo')
  
  if (error2) console.error('Error master:', error2)
  else console.log('✅ Fixed master odoo agent system prompt')

  // Verify
  const { data } = await supabase
    .from('agents')
    .select('slug, system_prompt')
    .eq('slug', 'odoo')
    .eq('tenant_id', 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2')
    .single()
  
  if (data?.system_prompt?.includes('odoo_intelligent_query')) {
    console.log('❌ Still mentions odoo_intelligent_query!')
  } else {
    console.log('✅ No more odoo_intelligent_query references')
  }
}

fix()
