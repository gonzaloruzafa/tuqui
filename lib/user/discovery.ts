/**
 * User Discovery — Infer user profile from Odoo activity
 * 
 * 1. Locate user by email in Odoo
 * 2. Fetch activity (messages, activities, model interactions)
 * 3. Fetch HR data (department, job title) if available
 * 4. LLM synthesizes: role_title, area, bio, interests
 */

import { loadSkillsForAgent } from '@/lib/skills/loader'

export interface UserDiscoveryResult {
  role_title: string
  area: string
  bio: string
  interests: string
}

export async function discoverUserProfile(
  tenantId: string,
  userEmail: string,
  targetName: string
): Promise<UserDiscoveryResult | null> {
  try {
    const skills = await loadSkillsForAgent(tenantId, userEmail, ['odoo_hr', 'odoo_mail'])

    // 1. Find user in Odoo by name
    const getUsersFn = skills['get_users']
    if (!getUsersFn?.execute) return null

    const usersResult = await getUsersFn.execute({ internalOnly: false, limit: 200 }) as {
      success: boolean
      data?: { users?: { id: number; name: string; login: string }[] }
    }

    const nameLower = targetName.toLowerCase()
    const odooUser = usersResult.data?.users?.find(u => {
      const uName = u.name?.toLowerCase() || ''
      const uLogin = u.login?.toLowerCase() || ''
      // Match by login (exact) or name (bidirectional contains, min 3 chars to avoid false positives)
      return uLogin === nameLower
        || uLogin.startsWith(nameLower)
        || (nameLower.length >= 3 && uName.includes(nameLower))
        || (nameLower.length >= 3 && uLogin.includes(nameLower))
    })
    if (!odooUser) return null

    // 2. Fetch activity
    const getActivityFn = skills['get_user_activity']
    const activityResult = getActivityFn?.execute
      ? await getActivityFn.execute({ userId: odooUser.id, daysBack: 90, limit: 100 }) as {
          success: boolean
          data?: { _descripcion?: string; modelInteractions?: Record<string, number>; messages?: { subject: string | null; bodyPreview: string }[] }
        }
      : null

    // 3. Fetch employee data (department, job title)
    const getEmployeesFn = skills['get_employees']
    let employeeInfo = ''
    if (getEmployeesFn?.execute) {
      const empResult = await getEmployeesFn.execute({ limit: 200 }) as {
        success: boolean
        data?: { _descripcion?: string; employees?: { name: string; department?: string; job_title?: string }[] }
      }
      const emp = empResult.data?.employees?.find(
        e => e.name?.toLowerCase().includes(odooUser.name.split(' ')[0].toLowerCase())
      )
      if (emp) {
        const parts: string[] = []
        if (emp.job_title) parts.push(`Cargo en Odoo: ${emp.job_title}`)
        if (emp.department) parts.push(`Departamento: ${emp.department}`)
        employeeInfo = parts.join('. ')
      }
    }

    // 4. Synthesize with LLM
    const dataParts: string[] = []
    dataParts.push(`Nombre: ${odooUser.name}`)
    dataParts.push(`Email: ${odooUser.login}`)
    if (employeeInfo) dataParts.push(employeeInfo)
    if (activityResult?.data?._descripcion) {
      dataParts.push(`Actividad Odoo: ${activityResult.data._descripcion}`)
    }
    if (activityResult?.data?.messages?.length) {
      const sampleMsgs = activityResult.data.messages
        .filter(m => m.bodyPreview)
        .slice(0, 10)
        .map(m => m.subject ? `[${m.subject}] ${m.bodyPreview}` : m.bodyPreview)
        .join('\n')
      dataParts.push(`Mensajes recientes:\n${sampleMsgs}`)
    }

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

  const prompt = `Analizá la actividad real de ${name} en Odoo y generá su perfil profesional.

Respondé SOLO con JSON válido, sin markdown:
{
  "role_title": "Cargo/rol inferido de su actividad (ej: 'Responsable Comercial', 'Administrativo Contable'). Si hay cargo de RRHH, usá ese.",
  "area": "Área principal donde trabaja (ej: 'Ventas', 'Administración', 'Logística'). Inferir del departamento o de los modelos que más usa.",
  "bio": "1-2 oraciones describiendo qué hace esta persona en la empresa, basado en sus interacciones reales. Ej: 'Se encarga del seguimiento comercial de clientes grandes y la gestión de pedidos. Tiene foco en la cobranza y los márgenes.'",
  "interests": "Temas/procesos en los que más se enfoca, separados por coma. Inferir de los modelos y temas de sus mensajes. Ej: 'seguimiento de pedidos, pipeline CRM, cobranza a clientes'"
}

REGLAS:
- Basate SOLO en los datos proporcionados, no inventes
- Si no hay suficiente info para un campo, dejá string vacío
- Español argentino, directo, sin florituras

DATOS DE ACTIVIDAD:
${data}`

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 1024 },
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned) as UserDiscoveryResult
  } catch {
    return { role_title: '', area: '', bio: '', interests: '' }
  }
}
