/**
 * User Discovery — Infer user profile from Odoo activity
 * 
 * Fetches 1 year of chatter messages, scheduled activities, and HR data
 * to synthesize a functional + psychological profile of the user.
 */

import { loadSkillsForAgent } from '@/lib/skills/loader'

export interface UserDiscoveryResult {
  display_name: string
  role_title: string
  area: string
  bio: string
  interests: string
}

export async function discoverUserProfile(
  tenantId: string,
  userEmail: string,
  targetName: string
): Promise<UserDiscoveryResult | { notFound: true; debug: string } | null> {
  try {
    const skills = await loadSkillsForAgent(tenantId, userEmail, ['odoo_hr', 'odoo_mail'])

    // 1. Find user in Odoo by name or login
    const getUsersFn = skills['get_users']
    if (!getUsersFn?.execute) return null

    const usersResult = await getUsersFn.execute({ activeOnly: false, internalOnly: true, limit: 500 }) as {
      success: boolean
      data?: { users?: { id: number; name: string; login: string }[] }
    }

    const allUsers = usersResult.data?.users || []
    console.log(`[UserDiscovery] Got ${allUsers.length} users from Odoo, searching for "${targetName}"`)

    // Normalize accents for comparison (e.g. "martin" matches "Martín")
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const nameNorm = normalize(targetName)
    const odooUser = allUsers.find(u => {
      const uNameNorm = normalize(u.name || '')
      const uLoginNorm = normalize(u.login || '')
      return uLoginNorm === nameNorm
        || uLoginNorm.startsWith(nameNorm)
        || (nameNorm.length >= 3 && uNameNorm.includes(nameNorm))
        || (nameNorm.length >= 3 && uLoginNorm.includes(nameNorm))
    })

    if (!odooUser) {
      const sample = allUsers.slice(0, 5).map(u => `${u.name} (${u.login})`).join(', ')
      return { notFound: true, debug: `${allUsers.length} usuarios en Odoo. Primeros: ${sample || 'ninguno'}` }
    }

    // 2. Fetch 1 year of activity — messages + activities + model distribution
    const getActivityFn = skills['get_user_activity']
    const activityResult = getActivityFn?.execute
      ? await getActivityFn.execute({ userId: odooUser.id, daysBack: 365, limit: 100 }) as {
          success: boolean
          data?: {
            _descripcion?: string
            modelInteractions?: Record<string, number>
            messages?: { subject: string | null; bodyPreview: string; model: string | null; date: string; type: string }[]
            activities?: { summary: string | null; type: string; deadline: string; model: string; state: string }[]
            totalMessages?: number
            totalActivities?: number
          }
        }
      : null

    // 3. Fetch HR data (job title, department)
    const getEmployeesFn = skills['get_employees']
    let employeeInfo = ''
    if (getEmployeesFn?.execute) {
      const empResult = await getEmployeesFn.execute({ limit: 200 }) as {
        success: boolean
        data?: { employees?: { name: string; department?: string; job_title?: string }[] }
      }
      const firstWord = normalize(odooUser.name.split(' ')[0])
      const emp = empResult.data?.employees?.find(
        e => normalize(e.name || '').includes(firstWord)
      )
      if (emp) {
        const parts: string[] = []
        if (emp.job_title) parts.push(`Cargo RRHH: ${emp.job_title}`)
        if (emp.department) parts.push(`Departamento: ${emp.department}`)
        employeeInfo = parts.join('. ')
      }
    }

    // 4. Build rich data package
    const activity = activityResult?.data
    const allMessages = activity?.messages || []
    const allActivities = activity?.activities || []
    const modelInteractions = activity?.modelInteractions || {}

    // Model interaction summary (sorted by frequency)
    const modelSummary = Object.entries(modelInteractions)
      .sort((a, b) => b[1] - a[1])
      .map(([model, count]) => `${model}: ${count} interacciones`)
      .join('\n')

    // Sample messages — full body for communication style analysis
    const messageSample = allMessages
      .filter(m => m.bodyPreview && m.bodyPreview.length > 10)
      .slice(0, 30)
      .map(m => {
        const parts = []
        if (m.subject) parts.push(`[${m.subject}]`)
        if (m.model) parts.push(`(${m.model})`)
        parts.push(m.bodyPreview)
        return parts.join(' ')
      })
      .join('\n---\n')

    // Activity summaries
    const activitySample = allActivities
      .slice(0, 20)
      .map(a => `[${a.type}] ${a.summary || 'sin resumen'} — ${a.model} (${a.state})`)
      .join('\n')

    const dataParts: string[] = [
      `Nombre en Odoo: ${odooUser.name}`,
      `Login: ${odooUser.login}`,
    ]
    if (employeeInfo) dataParts.push(employeeInfo)
    dataParts.push(`Estadísticas: ${activity?.totalMessages || 0} mensajes, ${activity?.totalActivities || 0} actividades en el último año`)
    if (modelSummary) dataParts.push(`Interacciones por módulo Odoo:\n${modelSummary}`)
    if (messageSample) dataParts.push(`Mensajes escritos por el usuario (muestra):\n${messageSample}`)
    if (activitySample) dataParts.push(`Actividades programadas:\n${activitySample}`)

    return await synthesizeUserProfile(odooUser.name, dataParts.join('\n\n'))
  } catch (e) {
    console.error('[UserDiscovery] Error:', e)
    return null
  }
}

async function synthesizeUserProfile(
  name: string,
  data: string
): Promise<UserDiscoveryResult> {
  const { GoogleGenAI } = await import('@google/genai')
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  const prompt = `Analizá la actividad real de ${name} en Odoo durante el último año y generá su perfil profesional y psicológico.

Tu objetivo NO es listar qué hace, sino ENTENDER QUIÉN ES como persona y cómo trabaja: su foco, su estilo, su personalidad funcional.

Respondé SOLO con JSON válido, sin markdown:
{
  "display_name": "Nombre real de la persona (tal como aparece en Odoo, sin apellidos técnicos ni iniciales raras)",
  "role_title": "Cargo/rol inferido. Si hay dato de RRHH, usá ese. Si no, inferilo de los módulos que más usa.",
  "area": "Área principal (ej: 'Ventas', 'Administración', 'Contabilidad'). Una sola área principal.",
  "bio": "2-3 oraciones. Describí qué hace esta persona, en qué procesos está metida, y algo de cómo trabaja. Basate en patrones reales, no en el cargo. Ej: 'Gestiona la facturación y el seguimiento de cobranza. Tiene un ritmo de trabajo constante y metódico, con foco en el cierre de operaciones. Interactúa principalmente con clientes de Cedent SRL.'",
  "interests": "Perfil funcional y psicológico para comunicarse mejor con esta persona. Incluí: (1) en qué procesos tiene más foco, (2) si es más pragmático/directo o detallista/cuidadoso, (3) si parece proactivo (inicia cosas) o reactivo (responde cosas), (4) cómo comunicarse bien con él/ella (ej: 'directo y con datos concretos', 'con contexto y paciencia', 'mensajes cortos y accionables'). Separado por coma. Ej: 'foco en facturación y cobranza, estilo directo y pragmático, proactivo, comunicarse con datos concretos y sin rodeos'"
}

REGLAS CRÍTICAS:
- Basate SOLO en los datos reales de actividad — no inventes
- El campo "interests" es el más importante: tiene que ayudar a un colega a entender CÓMO trabajar con esta persona
- Si los mensajes muestran textos cortos → mencionar estilo directo. Si son largos y detallados → mencionar que aprecia contexto
- Si el usuario tiene muchas actividades en un módulo específico → inferir foco
- Español argentino, directo

DATOS DE ACTIVIDAD:
${data}`

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 2048 },
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned) as UserDiscoveryResult
  } catch {
    return { display_name: '', role_title: '', area: '', bio: '', interests: '' }
  }
}
