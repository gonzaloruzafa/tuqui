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
            groups?: string[]
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
    const userGroups = activity?.groups || []

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
    if (userGroups.length) {
      // Filter to meaningful groups (skip technical/base groups)
      const meaningful = userGroups.filter(g => 
        !g.startsWith('base.') && !g.startsWith('Extra Rights') 
        && g.length > 3 && !g.includes('Technical')
      )
      if (meaningful.length) dataParts.push(`Permisos/grupos habilitados en Odoo (señal fuerte de rol):\n${meaningful.join(', ')}`)
    }
    if (messageSample) dataParts.push(`Mensajes escritos por el usuario (muestra):\n${messageSample}`)
    if (activitySample) dataParts.push(`Actividades programadas:\n${activitySample}`)

    const realMessageCount = allMessages.filter(m => m.bodyPreview && m.bodyPreview.length > 10).length
    return await synthesizeUserProfile(odooUser.name, dataParts.join('\n\n'), realMessageCount)
  } catch (e) {
    console.error('[UserDiscovery] Error:', e)
    return null
  }
}

async function synthesizeUserProfile(
  name: string,
  data: string,
  messageCount: number
): Promise<UserDiscoveryResult> {
  const { GoogleGenAI } = await import('@google/genai')
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  const hasMessages = messageCount >= 5

  const prompt = `Analizá la actividad real de ${name} en Odoo durante el último año y generá su perfil profesional${hasMessages ? ' y de personalidad' : ''}.

Respondé SOLO con JSON válido, sin markdown:
{
  "display_name": "Nombre real (como aparece en Odoo)",
  "role_title": "Cargo/rol. Si hay dato de RRHH, usá ese. Si no, inferilo de los módulos que más usa.",
  "area": "Área principal (ej: 'Ventas', 'Administración'). Una sola.",
  "bio": "3-5 oraciones: qué hace operativamente, con quiénes interactúa, en qué procesos está más metido/a, cómo es su ritmo de trabajo.${hasMessages ? ' Cerrá con una oración sobre su tipo de personalidad Jung/MBTI (ej: ESTJ, INFP, ENTP) inferido ÚNICAMENTE del tono, longitud y estilo de sus mensajes reales de chatter/email. Justificá brevemente por qué ese tipo (ej: mensajes cortos y directos, inicia temas → ESTJ). Si los mensajes no son suficientemente claros para inferir, no lo pongas.' : ''}",
  "interests": "Síntesis para que un colega sepa cómo trabajar con esta persona: foco principal, estilo de comunicación (directo/detallado, breve/extenso, formal/informal), si es más proactivo o reactivo, y recomendación concreta de cómo comunicarse (ej: 'mensajes cortos con acción clara', 'dar contexto antes de pedir algo')"
}

REGLAS:
- Basate SOLO en datos reales — no inventes
- "bio" debe leerse como ficha de persona, no como CV
${hasMessages ? '- El perfil Jung/MBTI se infiere de los MENSAJES: cortos/directos → T/J, largos con contexto → F/N, inicia conversaciones → E, solo responde → I, planifica → J, variedad de temas → P. Si no hay señales claras, NO pongas tipo Jung.' : '- NO menciones Jung, MBTI ni personalidad — no hay suficientes mensajes para inferirlo.'}
- "interests" es para que cualquier colega entienda en 2 segundos cómo comunicarse
- Español argentino, directo

DATOS DE ACTIVIDAD:
${data}`

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
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
