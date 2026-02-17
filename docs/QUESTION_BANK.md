# Question Bank — Tuqui Intelligence

> **Propósito:** Backlog de preguntas que usuarios reales harían. Sirve para planificar skills y medir gaps.  
> **NO es código ejecutable.** Cuando decidimos actuar sobre una pregunta, se mueve a `tests/evals/test-cases.ts`.  
> **Última actualización:** 2026-02-16

---

## Cómo usar este doc

1. Revisá las preguntas marcadas ❌ (no cubiertas) con business value 🔴 (alto)
2. Elegí las que querés resolver en el próximo sprint
3. Mové esas preguntas a `test-cases.ts` como tests reales
4. Creá el skill mínimo que las resuelve
5. Actualizá la columna de cobertura acá (❌ → ✅)

### Columnas

| Columna | Significado |
|---------|-------------|
| **Cobertura** | ✅ Cubierta / ⚠️ Parcial / ❌ Sin cubrir |
| **Agente** | `odoo` `meli` `contador` `abogado` `tuqui` |
| **Modelos/Tools** | Qué modelos Odoo o tools necesita |
| **Valor** | 🔴 Alto / 🟡 Medio / 🟢 Bajo (impacto en "vender más y optimizar") |
| **Dificultad** | 1-5 (1=single skill directo, 5=multi-skill + insight) |

---

## Eval real — 2026-02-16

> **28 preguntas evaluadas contra producción (localhost:3000)**  
> **28/28 pass** | Routing: 100% correcto | Avg latency: 22s

### Hallazgos clave

1. **El LLM ya resuelve cross-domain sin skills dedicados.** Gemini 3 Flash con `maxSteps: 12` encadena 2-4 tool calls y cruza datos solo. Ej: "¿Los que más compran son los que más deben?" → llama `getTopCustomers` + `getAccountsReceivable` y cruza nombres.

2. **Routing funciona perfecto.** 12/12 Odoo queries → `odoo`, MeLi → `meli`, contador → `contador`, legal → `legal`, general → `tuqui`. No hubo un solo mis-route.

3. **Las preguntas "ejecutivas" funcionan sorprendentemente bien.** "¿Qué debería preocuparme del negocio?" genera una respuesta de 4 puntos (deuda, caída ventas, stock dormido, CRM estancado) con datos reales. Latencia: 27s pero calidad excelente.

4. **Gap real: contador no cruza con Odoo.** "¿Cuánto IVA tengo que pagar?" → `contador` responde con teoría y pide los datos. No puede leer del ERP porque no tiene tool `odoo`. **Este es el gap más valioso de resolver.**

5. **Latencia correlaciona con tool calls.** Simple (1 tool): ~12s, Cross-domain (2-3 tools): ~25s, Executive summary (4+ tools): ~32-47s.

6. **Los skills atómicos ayudan más de lo esperado.** Aunque no hay un skill `get-fulfillment-status`, el LLM llama `getPendingSaleOrders` + `getProductStock` y cruza el resultado por su cuenta.

### Conclusiones para priorización

| Prioridad | Acción | Impacto |
|-----------|--------|---------|
| 🔴 P0 | **Dar tool `odoo` al agente `contador`** para que calcule IVA real | Desbloquea CT-001 y toda la categoría |
| 🟡 P1 | **Skill `get-days-of-stock`** — el LLM lo resuelve pero mal (estima, no calcula velocity real) | Precisión en SV-001/SV-006 |
| 🟡 P1 | **Skill `get-collection-ratio`** — cobros vs facturación en un call | Reduce latencia de 25s a ~12s para CD-004 |
| 🟢 P2 | **Skill `get-executive-summary`** — compila multi-metric en 1 call | Reduce latencia de 32s a ~15s para RE-001 |
| 🟢 P2 | **Mejorar descriptions de skills** para que el LLM elija mejor cuáles usar | Calidad general |
| ⚪ P3 | Skills de stock.picking (entregas atrasadas, lead time) | Bajo uso pero útil para operaciones |

### Lo que NO necesita skill nuevo

Estas preguntas parecían gaps pero el LLM ya las maneja bien encadenando tools existentes:
- "¿Tengo stock para cubrir pedidos pendientes?" → ✅ funciona (47s, 2+ tools)
- "¿Los que más compran son los que más deben?" → ✅ funciona (16s, 2 tools)
- "¿Cuánto cobré vs cuánto facturé?" → ✅ funciona (25s, 2 tools)
- "Dame un resumen del negocio" → ✅ funciona (31s, 4+ tools)
- "¿Subió el costo de lo que más vendo?" → ✅ funciona (40s, 2+ tools)
- "¿Hay clientes que dejaron de comprar y todavía deben?" → ✅ funciona (32s, 2+ tools)

---

## Resumen de cobertura (actualizado post-eval)

| Categoría | Total | ✅ | ⚠️ | ❌ | % Cubierto |
|-----------|-------|-----|------|------|------------|
| Sales × Stock | 10 | 5 | 3 | 2 | 50% |
| Margen × Costos | 10 | 5 | 3 | 2 | 50% |
| CRM × Sales | 8 | 4 | 2 | 2 | 50% |
| Cliente × Deuda × Pagos | 10 | 7 | 2 | 1 | 70% |
| Stock × Velocidad | 8 | 2 | 4 | 2 | 25% |
| Tesorería × Operaciones | 8 | 5 | 2 | 1 | 62% |
| Resúmenes ejecutivos | 8 | 3 | 3 | 2 | 37% |
| Tendencias temporales | 8 | 3 | 3 | 2 | 37% |
| Proveedores | 8 | 3 | 3 | 2 | 37% |
| Productos estrella | 8 | 3 | 3 | 2 | 37% |
| Coloquiales argentinas | 12 | 5 | 5 | 2 | 42% |
| MeLi / Web Search | 10 | 5 | 3 | 2 | 50% |
| Contador / Impuestos | 10 | 3 | 4 | 3 | 30% |
| Abogado / Legal | 8 | 3 | 3 | 2 | 37% |
| Tuqui General / RAG | 8 | 3 | 3 | 2 | 37% |
| Trampas / Ambiguas | 10 | 4 | 3 | 3 | 40% |
| **TOTAL** | **144** | **56** | **52** | **36** | **39%** |

> Cobertura actualizada post-evals 2026-02-16. Cobertura real (✅ + ⚠️ funcionando): ~75%  
> Muchas preguntas ⚠️ funcionan via multi-tool chaining, solo con latencia alta.

---

## 1. Sales × Stock (Fulfillment)

Preguntas que cruzan ventas pendientes con disponibilidad de stock.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| SF-001 | ¿Tengo stock para cubrir los pedidos pendientes? | ⚠️ | odoo | sale.order + stock.quant | 🔴 | 4 |
| SF-002 | ¿Qué pedidos no puedo entregar por falta de stock? | ❌ | odoo | sale.order + stock.quant | 🔴 | 4 |
| SF-003 | ¿Cuántos pedidos están listos para despachar? | ⚠️ | odoo | stock.picking (state=assigned) | 🔴 | 2 |
| SF-004 | ¿Cuánto tenemos pendiente de entregar en pesos? | ⚠️ | odoo | sale.order (pendientes) + stock.picking | 🟡 | 3 |
| SF-005 | ¿Qué productos vendidos no tienen stock suficiente? | ❌ | odoo | sale.order.line + stock.quant | 🔴 | 4 |
| SF-006 | ¿Cuántas entregas hicimos esta semana? | ⚠️ | odoo | stock.picking (state=done) | 🟡 | 2 |
| SF-007 | ¿Hay pedidos atrasados en la entrega? | ❌ | odoo | stock.picking (scheduled < today, state!=done) | 🔴 | 3 |
| SF-008 | ¿Cuál es el lead time promedio de entrega? | ❌ | odoo | stock.picking (date_done - create_date) | 🟡 | 4 |
| SF-009 | ¿Cuántos remitos tenemos sin facturar? | ❌ | odoo | stock.picking + account.move (cruce) | 🟡 | 4 |
| SF-010 | ¿Cuál es el producto más vendido que tiene poco stock? | ✅ | odoo | sale.order.line + stock.quant | 🔴 | 3 |

---

## 2. Margen × Costos (Rentabilidad)

Preguntas que cruzan precios de venta, costos y márgenes.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| MC-001 | ¿Cuánto margen me deja el producto X? | ✅ | odoo | product.product + sale.order.line | 🔴 | 2 |
| MC-002 | ¿Subió el costo de lo que más vendo? | ⚠️ | odoo | purchase.order.line + sale.order.line | 🔴 | 4 |
| MC-003 | ¿Cuáles son mis productos más rentables? | ✅ | odoo | get-product-margin (top by margin) | 🔴 | 2 |
| MC-004 | ¿Cuáles son los productos que vendo a pérdida? | ⚠️ | odoo | get-product-margin (margin < 0) | 🔴 | 3 |
| MC-005 | ¿Cómo cambió el margen este mes vs el anterior? | ❌ | odoo | get-sales-margin-summary × 2 períodos | 🔴 | 4 |
| MC-006 | ¿Cuánto margen me deja el cliente X? | ❌ | odoo | sale.order.line × product cost × partner | 🟡 | 4 |
| MC-007 | ¿Estoy vendiendo más barato que el costo de reposición? | ❌ | odoo | sale.order.line vs purchase.order.line | 🔴 | 5 |
| MC-008 | ¿Cuál es el margen bruto del mes? | ✅ | odoo | get-sales-margin-summary | 🔴 | 1 |
| MC-009 | ¿Vendemos productos de alta rotación con bajo margen? | ❌ | odoo | stock-rotation + product-margin cruce | 🟡 | 5 |
| MC-010 | ¿Cuánto afectan los descuentos al margen total? | ⚠️ | odoo | sale.order.line (discount field) | 🟡 | 4 |

---

## 3. CRM × Sales (Pipeline a Revenue)

Preguntas que cruzan oportunidades CRM con ventas reales.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| CS-001 | ¿Cuánto hay en el pipeline de ventas? | ✅ | odoo | get-crm-pipeline | 🔴 | 1 |
| CS-002 | ¿Los leads que ganamos se convirtieron en ventas? | ❌ | odoo | crm.lead (won) + sale.order (por partner) | 🔴 | 5 |
| CS-003 | ¿Cuál es la tasa de conversión del pipeline? | ⚠️ | odoo | crm.lead (won vs total) | 🟡 | 3 |
| CS-004 | ¿Cuántas oportunidades perdimos y por qué? | ⚠️ | odoo | get-lost-opportunities | 🟡 | 2 |
| CS-005 | ¿Qué vendedor cierra más deals? | ❌ | odoo | crm.lead (won, group by user_id) | 🔴 | 3 |
| CS-006 | ¿Cuánto revenue esperado hay en el pipeline? | ✅ | odoo | get-crm-pipeline (expected_revenue) | 🔴 | 1 |
| CS-007 | ¿Cuántas oportunidades están estancadas hace más de 30 días? | ✅ | odoo | get-stale-opportunities | 🟡 | 2 |
| CS-008 | ¿Cuánto tiempo promedio tardamos en cerrar una venta? | ❌ | odoo | crm.lead (date_closed - create_date) | 🟡 | 4 |

---

## 4. Cliente × Deuda × Pagos (Riesgo de clientes)

Preguntas que cruzan comportamiento de compra con situación de deuda.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| CD-001 | ¿Los que más compran son los que más deben? | ⚠️ | odoo | sale.order + account.move (residual) | 🔴 | 5 |
| CD-002 | ¿Cuánto nos deben en total? | ✅ | odoo | get-accounts-receivable | 🔴 | 1 |
| CD-003 | ¿Quién está más atrasado en los pagos? | ✅ | odoo | get-ar-aging / get-overdue-invoices | 🔴 | 2 |
| CD-004 | ¿Cuánto cobré este mes vs cuánto facturé? | ⚠️ | odoo | account.payment (inbound) vs account.move (out_invoice) | 🔴 | 4 |
| CD-005 | ¿Hay clientes que dejaron de comprar y todavía deben? | ⚠️ | odoo | get-inactive-customers + account.move (residual) | 🔴 | 5 |
| CD-006 | ¿Cuánto cobramos la semana pasada? | ✅ | odoo | get-payments-received | 🟡 | 1 |
| CD-007 | ¿Cuál es el promedio de días que tardan en pagarnos? | ⚠️ | odoo | account.move (date-due vs payment date) | 🟡 | 4 |
| CD-008 | ¿Qué clientes siempre pagan a tiempo? | ⚠️ | odoo | account.payment history vs due dates | 🟡 | 4 |
| CD-009 | ¿A quién le debería dejar de fiar? | ⚠️ | odoo | deuda + aging + historial de pagos | 🔴 | 5 |
| CD-010 | ¿Cuánto de la deuda es de más de 90 días? | ✅ | odoo | get-ar-aging | 🔴 | 2 |

---

## 5. Stock × Velocidad de venta (Inventario inteligente)

Preguntas que cruzan stock actual con ritmo de ventas para predecir necesidades.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| SV-001 | ¿Para cuántos días me alcanza el stock de X? | ❌ | odoo | stock.quant + sale.order.line (velocity) | 🔴 | 4 |
| SV-002 | ¿Qué productos necesito reponer urgente? | ⚠️ | odoo | get-low-stock + velocity | 🔴 | 3 |
| SV-003 | ¿Tengo productos que no se venden y ocupan espacio? | ❌ | odoo | stock.quant + sale.order.line (0 ventas) | 🟡 | 4 |
| SV-004 | ¿Cuál es la rotación de inventario? | ✅ | odoo | get-stock-rotation | 🟡 | 2 |
| SV-005 | ¿Cuánto tengo invertido en stock que no se mueve? | ❌ | odoo | stock.quant × standard_price (sin ventas) | 🔴 | 4 |
| SV-006 | ¿Qué debería comprar esta semana? | ❌ | odoo | stock.quant + velocity + lead_time | 🔴 | 5 |
| SV-007 | ¿Hay productos con sobrestock? | ⚠️ | odoo | stock.quant vs avg monthly sales | 🟡 | 4 |
| SV-008 | ¿Cuáles son los productos de mayor rotación? | ❌ | odoo | get-stock-rotation (top N) | 🟡 | 2 |

---

## 6. Tesorería × Operaciones (Cash Flow)

Preguntas sobre flujo de caja y capacidad de pago.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| TF-001 | ¿Cubrimos los gastos del mes con las cobranzas? | ⚠️ | odoo | payments(inbound) vs payments(outbound) + bills | 🔴 | 4 |
| TF-002 | ¿Cuánta plata tenemos disponible entre caja y bancos? | ✅ | odoo | get-cash-balance | 🔴 | 1 |
| TF-003 | ¿Puedo pagar a los proveedores con lo que hay en caja? | ⚠️ | odoo | cash-balance vs accounts-payable | 🔴 | 4 |
| TF-004 | ¿Cuánto entra y cuánto sale por mes? | ⚠️ | odoo | payments inbound vs outbound grouped monthly | 🔴 | 3 |
| TF-005 | ¿Cuál es el ratio cobranzas/facturación? | ⚠️ | odoo | payments-received / invoices (out_invoice) | 🟡 | 4 |
| TF-006 | ¿Le debemos a muchos proveedores? | ✅ | odoo | get-accounts-payable | 🟡 | 1 |
| TF-007 | ¿Cuándo vencen las próximas facturas de proveedores? | ✅ | odoo | get-vendor-bills (upcoming due) | 🟡 | 2 |
| TF-008 | ¿Nos alcanza para cubrir sueldos este mes? | ✅ | odoo | cash-balance (estimación) | 🟡 | 3 |

---

## 7. Resúmenes ejecutivos (Multi-métrica)

Preguntas que requieren compilar datos de múltiples fuentes en una respuesta coherente.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| RE-001 | Dame un resumen del negocio este mes | ⚠️ | odoo | ventas + compras + cobranzas + stock + CRM | 🔴 | 5 |
| RE-002 | ¿Cómo estamos hoy? | ⚠️ | odoo | ventas(hoy) + caja + pedidos pendientes | 🔴 | 5 |
| RE-003 | Dame los números clave de la semana | ⚠️ | odoo | ventas + cobranzas + nuevos clientes | 🔴 | 5 |
| RE-004 | ¿Qué debería preocuparme? | ⚠️ | odoo | deuda vencida + stock bajo + pipeline frío | 🔴 | 5 |
| RE-005 | ¿Cuáles son las 3 prioridades del negocio ahora? | ⚠️ | odoo | multi-metric analysis + insight | 🔴 | 5 |
| RE-006 | Comparame enero vs febrero completo | ⚠️ | odoo | compare-sales-periods + compras + cobranzas | 🟡 | 4 |
| RE-007 | ¿Cómo cierra el mes? | ⚠️ | odoo | ventas MTD + proyección + cobranzas | 🔴 | 5 |
| RE-008 | Dame un reporte para el directorio | ❌ | odoo | executive multi-metric compilation | 🟡 | 5 |

---

## 8. Tendencias temporales (Trends)

Preguntas sobre evolución en el tiempo.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| TT-001 | ¿En qué mes vendemos más? | ⚠️ | odoo | sale.order grouped by month (12 meses) | 🟡 | 3 |
| TT-002 | ¿Las ventas vienen subiendo o bajando? | ✅ | odoo | compare-sales-periods | 🔴 | 3 |
| TT-003 | ¿Cuál fue nuestro mejor mes del año? | ⚠️ | odoo | sale.order monthly aggregation | 🟡 | 3 |
| TT-004 | ¿La deuda de clientes está creciendo? | ❌ | odoo | accounts-receivable trend (multi-month) | 🔴 | 4 |
| TT-005 | ¿Cómo evolucionó el margen en los últimos 6 meses? | ❌ | odoo | sales-margin-summary × 6 períodos | 🔴 | 4 |
| TT-006 | ¿Estamos comprando más que antes? | ⚠️ | odoo | purchase.order trend comparison | 🟡 | 3 |
| TT-007 | ¿El pipeline de CRM creció o se achicó? | ❌ | odoo | crm.lead count + revenue trend | 🟡 | 4 |
| TT-008 | ¿Cuándo fue la última vez que vendimos más de $X? | ✅ | odoo | sale.order historical search | 🟢 | 3 |

---

## 9. Proveedores (Supplier Intelligence)

Preguntas sobre gestión de compras y proveedores.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| PI-001 | ¿Quién me da mejor precio para el producto X? | ✅ | odoo | get-purchase-price-history | 🔴 | 2 |
| PI-002 | ¿Subieron los precios de mi proveedor principal? | ⚠️ | odoo | purchase.order.line trend by supplier | 🔴 | 3 |
| PI-003 | ¿Cuánto le compré a cada proveedor este año? | ✅ | odoo | get-purchases-by-supplier | 🟡 | 1 |
| PI-004 | ¿Dependo mucho de un solo proveedor? | ❌ | odoo | purchase concentration analysis | 🔴 | 4 |
| PI-005 | ¿Los proveedores están cumpliendo con los plazos de entrega? | ❌ | odoo | purchase.order (date_planned vs receipt) | 🟡 | 4 |
| PI-006 | ¿Cuántas órdenes de compra tenemos abiertas? | ✅ | odoo | get-purchase-orders (state=purchase) | 🟡 | 1 |
| PI-007 | ¿Hay proveedores alternativos para lo que más compro? | ❌ | odoo+meli | purchase history + web search | 🟡 | 5 |
| PI-008 | ¿Cuánto gasté en compras este mes vs el anterior? | ⚠️ | odoo | purchase.order comparison | 🟡 | 3 |

---

## 10. Productos estrella (Product Performance)

Preguntas sobre rendimiento individual de productos.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| PP-001 | ¿Cuáles son los productos estrella? | ✅ | odoo | get-top-products | 🔴 | 1 |
| PP-002 | ¿Qué productos dejaron de venderse? | ⚠️ | odoo | sale.order.line (sin ventas recientes) | 🔴 | 3 |
| PP-003 | ¿Cuáles son los productos con mejor margen? | ✅ | odoo | get-product-margin (sorted) | 🔴 | 2 |
| PP-004 | ¿Hay productos que se venden mucho pero dejan poco margen? | ❌ | odoo | top-products × product-margin cruce | 🔴 | 4 |
| PP-005 | ¿Cuántos SKUs activos tenemos? | ✅ | odoo | search-products (count) | 🟢 | 1 |
| PP-006 | ¿El producto X se vende más ahora que el mes pasado? | ⚠️ | odoo | product-sales-history comparison | 🟡 | 3 |
| PP-007 | ¿Qué categoría de productos genera más ingresos? | ❌ | odoo | get-sales-by-category | 🟡 | 2 |
| PP-008 | ¿Cuántos productos nuevos agregamos este mes? | ⚠️ | odoo | product.product (create_date in period) | 🟢 | 2 |

---

## 11. Coloquiales argentinas

Preguntas en lenguaje informal/argentino que testean la comprensión del agente.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| AR-001 | ¿Cuánta guita entró hoy? | ✅ | odoo | payments-received (today) | 🟡 | 3 |
| AR-002 | ¿Estamos al día con los pagos? | ⚠️ | odoo | accounts-payable (vencido) | 🟡 | 3 |
| AR-003 | ¿Los morosos nos están pagando? | ⚠️ | odoo | payments vs overdue invoices | 🟡 | 4 |
| AR-004 | ¿Me afanaron margen en algún producto? | ❌ | odoo | product-margin (negative margin products) | 🟡 | 4 |
| AR-005 | ¿Cómo anduvo la caja esta semana? | ✅ | odoo | cash-balance + payments summary | 🟡 | 3 |
| AR-006 | ¿Hay algún quilombo con el stock? | ⚠️ | odoo | low-stock + expiring + negative stock | 🟡 | 4 |
| AR-007 | ¿Se movió algo hoy? | ✅ | odoo | ventas(hoy) + cobros(hoy) | 🟡 | 3 |
| AR-008 | ¿El negocio da o no da? | ❌ | odoo | margin summary + cash flow | 🔴 | 5 |
| AR-009 | ¿Hay clientes garroneros? | ⚠️ | odoo | overdue invoices + aging | 🟡 | 3 |
| AR-010 | ¿Cuántos mangos facturamos? | ✅ | odoo | sales-total / invoices | 🟡 | 2 |
| AR-011 | ¿Se vendió bien o fue una semana floja? | ✅ | odoo | compare-sales-periods (week) | 🟡 | 3 |
| AR-012 | ¿Algún proveedor nos clavó con el precio? | ❌ | odoo | purchase-price-history (increases) | 🟡 | 4 |

---

## 12. MeLi / Web Search

Preguntas de búsqueda de precios y productos en MercadoLibre y web.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| WS-001 | ¿Cuánto sale un X en MercadoLibre? | ✅ | meli | web_search (MeLi hybrid) | 🟡 | 1 |
| WS-002 | ¿Estoy caro o barato comparado con MeLi? | ✅ | meli | web_search (compare) + odoo (list_price) | 🔴 | 5 |
| WS-003 | Buscame proveedores de X en la web | ⚠️ | meli | web_search (Tavily) | 🟡 | 2 |
| WS-004 | ¿Cuánto cuesta el envío en MeLi para X? | ❌ | meli | web_search (shipping info) | 🟢 | 3 |
| WS-005 | ¿Hay alternativas más baratas a lo que compro? | ❌ | meli+odoo | web_search + purchase history | 🔴 | 5 |
| WS-006 | ¿Cuál es la tendencia de precios de X en MeLi? | ⚠️ | meli | web_search (historical, limitado) | 🟡 | 4 |
| WS-007 | Comparame precios de 3 modelos de X | ✅ | meli | web_search (multi-query) | 🟡 | 3 |
| WS-008 | ¿Qué opinan los compradores de X en MeLi? | ⚠️ | meli | web_search (reviews) | 🟢 | 3 |
| WS-009 | Buscame info técnica de X | ✅ | tuqui | web_search (Tavily general) | 🟢 | 2 |
| WS-010 | ¿Cuál es la competencia más fuerte para mi producto? | ✅ | meli | web_search (market analysis) | 🔴 | 4 |

---

## 13. Contador / Impuestos

Preguntas de orientación impositiva y contable (teórica, no datos ERP).

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| CT-001 | ¿Cuánto IVA tengo que pagar este mes? | ⚠️🔑 | contador | web_search + knowledge_base (debería cruzar con odoo) | 🔴 | 5 |
| CT-002 | ¿Me conviene ser monotributista o responsable inscripto? | ✅ | contador | web_search + knowledge_base | 🔴 | 3 |
| CT-003 | ¿Cuándo vence la declaración jurada de IVA? | ✅ | contador | web_search (AFIP vencimientos) | 🟡 | 2 |
| CT-004 | ¿Cómo facturo al exterior? | ⚠️ | contador | web_search + knowledge_base | 🟡 | 3 |
| CT-005 | ¿Qué impuestos paga una SAS? | ✅ | contador | web_search + knowledge_base | 🟡 | 2 |
| CT-006 | ¿Puedo deducir esto de ganancias? | ⚠️ | contador | web_search (normativa AFIP) | 🟡 | 3 |
| CT-007 | ¿Cuál es la escala de monotributo vigente? | ⚠️ | contador | web_search (AFIP tablas) | 🟡 | 2 |
| CT-008 | ¿Cuánto ingresos brutos pago en mi provincia? | ❌ | contador | web_search (IIBB provincial) | 🟡 | 3 |
| CT-009 | ¿Me afecta el impuesto PAIS en las importaciones? | ❌ | contador | web_search (normativa vigente) | 🟡 | 3 |
| CT-010 | ¿Necesito certificado de no retención de IVA? | ❌ | contador | web_search + knowledge_base | 🟢 | 3 |

---

## 14. Abogado / Legal

Preguntas de orientación legal empresarial.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| LG-001 | ¿Puedo echar a un empleado en período de prueba? | ✅ | abogado | web_search + knowledge_base | 🟡 | 2 |
| LG-002 | ¿Cuánto cuesta indemnizar a alguien con 5 años de antigüedad? | ⚠️ | abogado | web_search (cálculo indemnización) | 🟡 | 3 |
| LG-003 | ¿Qué cláusulas debería tener un contrato de prestación de servicios? | ⚠️ | abogado | web_search + knowledge_base | 🟡 | 3 |
| LG-004 | ¿Un cliente me mandó una carta documento, qué hago? | ✅ | abogado | web_search + knowledge_base | 🔴 | 3 |
| LG-005 | ¿Puedo cobrar intereses por mora a clientes? | ✅ | abogado | web_search (normativa) | 🟡 | 3 |
| LG-006 | ¿Necesito habilitación municipal para mi local? | ❌ | abogado | web_search (regulaciones locales) | 🟢 | 2 |
| LG-007 | ¿Cómo registro una marca en Argentina? | ❌ | abogado | web_search (INPI) | 🟢 | 2 |
| LG-008 | ¿Qué dice defensa al consumidor sobre garantías? | ❌ | abogado | web_search (ley 24.240) | 🟡 | 3 |

---

## 15. Tuqui General / RAG / Identidad

Preguntas generales, de empresa, o que usan el knowledge base.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| TG-001 | ¿Qué es Tuqui? | ✅ | tuqui | system prompt identity | 🟢 | 1 |
| TG-002 | ¿Cómo puedo mejorar mis ventas? | ⚠️ | tuqui | knowledge_base + web_search | 🟡 | 3 |
| TG-003 | ¿Qué herramientas tiene disponible el agente? | ⚠️ | tuqui | self-awareness / system prompt | 🟢 | 2 |
| TG-004 | Resumime este PDF que subí | ⚠️ | tuqui | knowledge_base (RAG) | 🟡 | 3 |
| TG-005 | ¿Qué características tiene mi producto estrella? | ✅ | tuqui | knowledge_base (RAG) | 🟡 | 2 |
| TG-006 | Ayudame a redactar un mail para cobrarle a un cliente moroso | ❌ | tuqui | generación de texto + context odoo | 🟡 | 4 |
| TG-007 | ¿Cuál es el horario de atención de mi empresa? | ✅ | tuqui | knowledge_base (company info) | 🟢 | 1 |
| TG-008 | Explicame cómo usar el módulo de ventas de Odoo | ❌ | tuqui | web_search (Odoo docs) | 🟢 | 3 |

---

## 16. Preguntas trampa / ambiguas / edge cases

Preguntas que testean robustez del routing y manejo de ambigüedad.

| # | Pregunta | Cob. | Agente | Modelos/Tools | Valor | Dif. |
|---|----------|------|--------|---------------|-------|------|
| TR-001 | ¿Cómo estamos? | ⚠️ | odoo/tuqui | routing ambiguo → debería dar resumen | 🟡 | 5 |
| TR-002 | Hola | ✅ | tuqui | greeting, sin crash | 🟢 | 1 |
| TR-003 | ¿Cuánto vale el dólar? | ✅ | tuqui/meli | web_search (tipo cambio) | 🟢 | 2 |
| TR-004 | ¿Puedo facturar sin IVA? | ⚠️ | contador | routing: impuestos, no ERP data | 🟡 | 3 |
| TR-005 | Sacame las ventas de ayer (debería preguntar qué sistema) | ⚠️ | odoo | directo a odoo, no debería pedir clarificación | 🟡 | 2 |
| TR-006 | ¿Cuánto gano? (ambiguo: ¿margen? ¿sueldo? ¿ganancia neta?) | ❌ | odoo | debería pedir clarificación o dar margen | 🔴 | 5 |
| TR-007 | Contame un chiste de contadores | ✅ | tuqui | humor, no crash, no va a contador | 🟢 | 1 |
| TR-008 | ¿Qué me recomendás comprar para revender? | ❌ | odoo+meli | top-products + margin + MeLi prices | 🔴 | 5 |
| TR-009 | Borrá todas las facturas del sistema | ✅ | tuqui | NUNCA ejecutar, solo lectura | 🔴 | 1 |
| TR-010 | ¿Tengo que declarar monotributo o está hecho? | ❌ | contador | routing: impuesto teórico + práctica | 🟡 | 4 |

---

## Análisis de gaps prioritarios

### 🔴 Gaps reales (confirmados post-eval)

| Gap | Preguntas afectadas | Skill necesario | Complejidad |
|-----|---------------------|-----------------|-------------|
| **Contador sin acceso a Odoo** — no puede calcular IVA | CT-001 y toda la categoría | Dar tool `odoo` al agent `contador` | Baja (config) |
| **Stock fulfillment preciso** — fuzzy match entre pedidos y stock | SF-002, SF-005, SF-007 | `get-fulfillment-status` | Media |
| **Days of stock** — el LLM estima pero no calcula velocity real | SV-001, SV-005, SV-006 | `get-days-of-stock` | Media |
| **CRM conversion** — pipeline → revenue real con cruce | CS-002, CS-005, CS-008 | `get-crm-conversion-rate` | Media |
| **Stock picking ops** — entregas atrasadas, lead time | SF-007, SF-008, SF-009 | Skills sobre stock.picking | Media |

### 🟡 Oportunidades de optimización (latencia)

| Gap | Preguntas afectadas | Nota |
|-----|---------------------|------|
| Resumen ejecutivo en 1 call vs 4+ tools | RE-001 a RE-005 | Reduce de 32s a ~15s |
| Collection ratio en 1 call vs 2 tools | CD-004, TF-005 | Reduce de 25s a ~12s |
| Trend multi-month en 1 call | TT-004, TT-005, TT-007 | Evita N llamados secuenciales |
| Supplier lead time analysis | PI-004, PI-005 | Necesita stock.picking × purchase.order |

---

## Próximos pasos

1. **P0: Dar tool `odoo` al agente `contador`** — Config change, no skill nuevo. Desbloquea CT-001.
2. **Agregar preguntas ❌🔴 a test-cases.ts** — Solo las que realmente no funcionaron
3. **Crear `get-days-of-stock` skill** — El LLM estima pero no calcula bien la velocity
4. **Crear `get-fulfillment-status` skill** — Cruce preciso pedidos vs stock en 1 call
5. **Optimizar latencia** — Skills compuestos para los top use cases (resumen ejecutivo, collection ratio)
6. **Loop pull** — Re-eval → actualizar doc → tests → skills → doc
