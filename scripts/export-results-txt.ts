/**
 * Exportar resultados de test a TXT para compartir
 */
import * as fs from 'fs'

const resultsFile = 'business-test-results-2025-12-29.json'
const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'))

let output = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    TUQUI - Agente BI para Odoo                               ║
║                    Demo de 100 Preguntas de Negocio                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

📊 RESUMEN DE RESULTADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fecha del test: ${new Date(results.timestamp).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

✅ Preguntas individuales: ${results.summary.individual.success}/${results.summary.individual.total} (${results.summary.individual.successRate})
✅ Conversaciones encadenadas: ${results.summary.chains.success}/${results.summary.chains.total} (${results.summary.chains.successRate})

Por categoría:
  • Vendedores: ${results.summary.byCategory.vendedores.success}/${results.summary.byCategory.vendedores.total} (90%)
  • Comparativas: ${results.summary.byCategory.comparativas.success}/${results.summary.byCategory.comparativas.total} (90%)
  • Clientes: ${results.summary.byCategory.clientes.success}/${results.summary.byCategory.clientes.total} (80%)
  • Facturación: ${results.summary.byCategory.facturacion.success}/${results.summary.byCategory.facturacion.total} (80%)
  • Ventas: ${results.summary.byCategory.ventas.success}/${results.summary.byCategory.ventas.total} (80%)
  • Stock: ${results.summary.byCategory.stock.success}/${results.summary.byCategory.stock.total} (70%)
  • Productos: ${results.summary.byCategory.productos.success}/${results.summary.byCategory.productos.total} (70%)
  • Tendencias: ${results.summary.byCategory.tendencias.success}/${results.summary.byCategory.tendencias.total} (70%)
  • Alertas: ${results.summary.byCategory.alertas.success}/${results.summary.byCategory.alertas.total} (50%)
  • Operaciones: ${results.summary.byCategory.operaciones.success}/${results.summary.byCategory.operaciones.total} (30%)


═══════════════════════════════════════════════════════════════════════════════
                        PREGUNTAS Y RESPUESTAS EXITOSAS
═══════════════════════════════════════════════════════════════════════════════

`

// Filtrar solo respuestas exitosas y formatear
const successfulResults = results.individualResults.filter((r: any) => r.success)

for (const r of successfulResults) {
    // Limpiar la respuesta de JSON/código
    let cleanResponse = r.response
        .replace(/```json[\s\S]*?```/g, '[Consulta Odoo]')
        .replace(/```tool_code[\s\S]*?```/g, '[Consulta Odoo]')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    
    // Limitar longitud
    if (cleanResponse.length > 500) {
        cleanResponse = cleanResponse.substring(0, 500) + '...'
    }
    
    output += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Pregunta #${r.id} [${r.category.toUpperCase()}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ ${r.question}

💬 ${cleanResponse}

`
}

output += `

═══════════════════════════════════════════════════════════════════════════════
                     EJEMPLOS DE CONVERSACIONES ENCADENADAS
═══════════════════════════════════════════════════════════════════════════════

Tuqui mantiene el contexto de la conversación, permitiendo preguntas de seguimiento:

`

const successfulChains = results.chainResults.filter((r: any) => r.usedContext)

for (const r of successfulChains) {
    let cleanResponse = r.response
        .replace(/```json[\s\S]*?```/g, '[Consulta Odoo]')
        .replace(/```tool_code[\s\S]*?```/g, '[Consulta Odoo]')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    
    if (cleanResponse.length > 300) {
        cleanResponse = cleanResponse.substring(0, 300) + '...'
    }
    
    output += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 ${r.id} - Ejemplo de continuidad conversacional
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ Pregunta de seguimiento: "${r.question}"

💬 ${cleanResponse}

`
}

output += `

═══════════════════════════════════════════════════════════════════════════════
                              SOBRE TUQUI
═══════════════════════════════════════════════════════════════════════════════

Tuqui es un agente de Business Intelligence para Odoo que permite:

✅ Hacer preguntas en lenguaje natural sobre tu negocio
✅ Obtener métricas de ventas, stock, facturación, clientes, vendedores
✅ Comparar períodos (semana vs semana, mes vs mes, año vs año)
✅ Analizar tendencias y detectar alertas
✅ Mantener conversaciones con contexto (preguntas de seguimiento)

Tecnología:
• Google Gemini 2.5 Flash
• Integración nativa con Odoo JSON-RPC
• Vercel AI SDK
• Descubrimiento dinámico de campos

Contacto: gonzalo@adhoc.com.ar

═══════════════════════════════════════════════════════════════════════════════
`

fs.writeFileSync('tuqui-demo-resultados.txt', output)
console.log('✅ Archivo generado: tuqui-demo-resultados.txt')
console.log(`   ${successfulResults.length} preguntas exitosas`)
console.log(`   ${successfulChains.length} conversaciones exitosas`)
