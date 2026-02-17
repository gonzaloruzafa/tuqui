/**
 * Company Briefing Generator
 * 
 * Transforms structured company data into a narrative "insider briefing"
 * that reads like an onboarding memo for a new employee.
 * Generated once on form save, stored in DB, injected into every chat.
 */

interface BriefingInput {
  name: string
  industry: string
  description: string
  toneOfVoice: string
  keyCustomers: { name: string; notes: string }[]
  keyProducts: { name: string; notes: string }[]
  keySuppliers: { name: string; notes: string }[]
  businessRules: string[]
  webSummary: string
}

/**
 * Generate a narrative company briefing from structured data.
 * Returns null if insufficient data to generate a meaningful briefing.
 */
export async function generateCompanyBriefing(input: BriefingInput): Promise<string | null> {
  const hasData = input.description || input.industry || input.keyCustomers.length > 0 || input.keyProducts.length > 0
  if (!hasData) return null

  const { GoogleGenAI } = await import('@google/genai')
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  const dataParts: string[] = []
  if (input.name) dataParts.push(`EMPRESA: ${input.name}`)
  if (input.industry) dataParts.push(`RUBRO: ${input.industry}`)
  if (input.description) dataParts.push(`DESCRIPCIÓN:\n${input.description}`)
  if (input.webSummary) dataParts.push(`INFO WEB:\n${input.webSummary}`)

  if (input.keyCustomers.length > 0) {
    dataParts.push(`CLIENTES:\n${input.keyCustomers.map(c => `- ${c.name}: ${c.notes}`).join('\n')}`)
  }
  if (input.keyProducts.length > 0) {
    dataParts.push(`PRODUCTOS:\n${input.keyProducts.map(p => `- ${p.name}: ${p.notes}`).join('\n')}`)
  }
  if (input.keySuppliers.length > 0) {
    dataParts.push(`PROVEEDORES:\n${input.keySuppliers.map(s => `- ${s.name}: ${s.notes}`).join('\n')}`)
  }
  if (input.businessRules.length > 0) {
    dataParts.push(`REGLAS DE NEGOCIO:\n${input.businessRules.map(r => `- ${r}`).join('\n')}`)
  }
  if (input.toneOfVoice) {
    dataParts.push(`TONO DE COMUNICACIÓN: ${input.toneOfVoice}`)
  }

  const prompt = `Sos un redactor interno de la empresa ${input.name || 'esta empresa'}. Escribí un BRIEFING DE ONBOARDING para que alguien que se suma al equipo entienda rápidamente cómo opera la empresa.

OBJETIVO: Quien lea esto debe sentirse como si llevara meses trabajando acá. No es un análisis externo — es una explicación interna, de alguien que conoce la empresa por dentro.

FORMATO: Texto corrido en ESPAÑOL ARGENTINO, 300-500 palabras. Sin títulos, sin bullets, sin JSON. Párrafos fluidos.

DEBE CUBRIR (en la medida que haya datos):
1. Qué hace la empresa, a qué se dedica, en qué rubro opera
2. A quién le vende — perfil de clientes, sectores, nombres de los más importantes con datos concretos
3. Qué vende — productos/servicios principales, cuáles son estrella, cuáles dan buen margen
4. A quién le compra — proveedores principales, qué proveen, relación comercial
5. De qué tamaño es — facturación, cantidad de clientes, empleados
6. Cómo está organizada — equipos, departamentos, estructura
7. Situación financiera — general, sin ser un balance (caja, deuda, cobranza)
8. Reglas internas que hay que conocer
9. Cómo se comunican — tono, formalidad, particularidades
10. Cualquier otra cosa que alguien nuevo debería saber

TONO: Como si un compañero de trabajo te estuviera explicando cómo es la empresa tu primer día. Directo, concreto, con datos reales. Nada de frases genéricas como "es una empresa líder" o "comprometida con la excelencia". Solo hechos.

Si algún dato no está disponible, simplemente no lo menciones — no digas "no hay información sobre X".

DATOS DE LA EMPRESA:
${dataParts.join('\n\n')}`

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 2048 },
    })

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return text || null
  } catch (e) {
    console.error('[generateCompanyBriefing] Error:', e)
    return null
  }
}
