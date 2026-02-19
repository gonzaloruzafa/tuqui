# TUQUI INTELLIGENCE LAYER — Curious Analyst Agent

> **Última actualización:** 2026-02-19  
> **Principio:** La inteligencia está en el LLM, no en el código  
> **Referencia:** TUQUI_REFACTOR_PLAN.md § F7.6  
> **Depende de:** F5 (PWA + Push) ya implementado — el delivery incluye push notification  
> **Modelos:** gemini-2.5-flash (investigator + synthesizer)  
> **Estado previo:** ✅ Phase 0 + Security P2 completados, 557 tests, 59 skills, main limpio (c09ba93)
>
> ### ⚠️ Notas de reconciliación (2026-02-19)
>
> **user_profiles ya existe** (migration 211 + 213). Schema actual: `display_name`, `role_title`,
> `area`, `bio`, `interests`. El schema de § 8 propone campos diferentes: `role`, `pain_points[]`,
> `watchlist[]`, `communication_style`, `onboarded`, `raw_onboarding_text`.  
> **Acción:** Migration 212 debe hacer ALTER TABLE para agregar las columnas faltantes, no CREATE TABLE.
>
> **Push sender:** El plan referencia `lib/push/sender.ts` que no existe como archivo separado.
> La funcionalidad existe en `lib/prometeo/notifier.ts` como `sendPushNotification()` (private).
> **Acción:** En F5, extraer a `lib/push/sender.ts` con exports `sendPushToUser()` y `sendPushToTenant()`.
>
> **WhatsApp:** Ahora funcional con Twilio signature validation + phone normalization (Security P2).
> El webhook está en `/api/webhooks/twilio` con `after()` para Vercel safety.
>
> **Skills:** 59 Odoo skills disponibles para el investigator (incluye nuevo `getBelowReorderPoint`).
> Esto enriquece significativamente lo que el analista curioso puede investigar.

---

## Visión

Tuqui no espera preguntas. **Tuqui investiga.**

Cada vez que el usuario abre el chat, hay algo nuevo: un dato de su ERP, un precio 
de mercado, una novedad legal, una noticia del rubro. Nunca se repite. Siempre 
personalizado. Siempre con una pregunta disparadora que invita a profundizar.

**El dopamine loop:** el usuario no sabe qué va a encontrar → abre para ver → 
encuentra algo interesante → pregunta más → Tuqui aprende sus intereses → 
mañana le muestra algo mejor.

---

## Principio: NO hardcodear discoveries

```
❌ 38 archivos (cliente-fantasma.ts, capital-dormido.ts, vencimiento.ts...)
   Cada insight es código que hay que mantener.
   Agregar un insight = PR + review + deploy.

✅ 1 agente curioso que usa las tools que YA EXISTEN
   El LLM decide qué buscar, qué es interesante, cómo presentarlo.
   Nuevo tipo de insight = mejor contexto, no más código.
```

---

## Arquitectura: Curious Analyst Agent

No es un pipeline con 4 collectors fijos. Es un **agente** — un agentic loop 
que recibe contexto rico y tiene acceso a las mismas herramientas del chat 
(Odoo skills, MeLi, Tavily, RAG). El LLM decide qué investigar.

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE LAYER                           │
│                                                                 │
│  1. CONTEXT ASSEMBLER                                           │
│     ┌───────────────────────────────────────────────────────┐   │
│     │ Company profile  → industria, escala, productos clave │   │
│     │ User profile     → rol, pain points, watchlist        │   │
│     │ Recent chats     → títulos de sesiones + mensajes     │   │
│     │ Memories         → notas guardadas del usuario        │   │
│     │ Insight history  → qué ya se mostró (para no repetir)│   │
│     └───────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  2. INVESTIGATOR (agentic loop)                                 │
│     ┌───────────────────────────────────────────────────────┐   │
│     │ System: "Sos un analista curioso. Investigá qué       │   │
│     │ cosas interesantes hay para este usuario."            │   │
│     │                                                       │   │
│     │ Tools disponibles (las MISMAS del chat):              │   │
│     │   • 50 Odoo skills (ventas, deuda, stock, CRM...)     │   │
│     │   • MeLi hybrid (precios de mercado)                  │   │
│     │   • Tavily (noticias, novedades legales)              │   │
│     │   • RAG (documentos de conocimiento)                  │   │
│     │   • [F7.7] Google Calendar + Gmail (si conectado)     │   │
│     │                                                       │   │
│     │ maxSteps: 8 — el LLM decide cuántas tools llamar     │   │
│     │ Output: texto libre con hallazgos                     │   │
│     └───────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  3. SYNTHESIZER                                                 │
│     ┌───────────────────────────────────────────────────────┐   │
│     │ Input: hallazgos + contexto + historial               │   │
│     │ Output: 2-3 teasers estructurados                     │   │
│     │                                                       │   │
│     │ Teaser = {                                            │   │
│     │   emoji: "👻",                                        │   │
│     │   dato: "Macrodental no compra hace 47 días",         │   │
│     │   pregunta: "¿Qué dejó de llevar?"                    │   │
│     │ }                                                     │   │
│     │                                                       │   │
│     │ El dato es el HOOK — genera curiosidad.               │   │
│     │ La pregunta es el ENGAGEMENT — da ganas de tocar.     │   │
│     └───────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  4. DELIVERY (session opener + push matutino)                    │
│     ┌───────────────────────────────────────────────────────┐   │
│     │ Cron matutino → pre-computa y cachea teasers          │   │
│     │ Push PWA → envía el teaser más impactante al celu     │   │
│     │ Session opener → al abrir, muestra 2-3 teasers        │   │
│     │ Suggested questions clickeables debajo                │   │
│     │ On-demand → refresca si ya se mostró                  │   │
│     │                                                       │   │
│     │ ⚡ F6 (Briefings) absorbido acá — un solo flujo       │   │
│     └───────────────────────────────────────────────────────┘   │
│                                                                 │
│  5. PERFILES (alimentan el contexto)                            │
│     ┌───────────────────────────────────────────────────────┐   │
│     │ User profile  → onboarding conversacional, no form    │   │
│     │ Auto-watchlist → menciones repetidas = interés        │   │
│     │ Company profile → ya existe en company_contexts       │   │
│     └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Por qué un agente y no collectors fijos

| Collectors fijos (antes) | Curious Agent (ahora) |
|---|---|
| Siempre corre las mismas 15 queries Odoo | El LLM elige qué buscar según el contexto |
| Si el usuario no tiene stock, corre getLowStock igual | Si ve que el user es de servicios, busca horas/proyectos |
| Agregar fuente nueva = nuevo collector (~50 líneas) | Agregar fuente = darle acceso a un tool que ya existe |
| Cross-source requiere lógica explícita | El LLM cruza datos naturalmente |
| 4 collectors × N queries = costo fijo | El LLM hace 3-8 calls según lo que necesita |
| ~12 archivos, ~570 líneas | ~13 archivos, ~520 líneas, más flexible |

**El LLM ya sabe hacer esto.** Cuando el usuario pregunta "¿cómo estamos?", 
el agente Odoo llama 3-4 skills y arma un resumen. El Curious Analyst hace lo 
mismo pero sin que el usuario pregunte.

---

## 1. PERFILES

### 1.1 User Profile (onboarding conversacional)

No es un formulario. Es una conversación libre al primer uso.

```
Tuqui: ¡Hola! Soy Tuqui, tu asistente para Cedent.
       Contame un poco: ¿qué hacés acá, qué te interesa seguir,
       qué te preocupa del negocio?

Usuario: "Soy Martín, el dueño. Me mata la cobranza, tenemos mucha
         guita en la calle. Quiero entender el stock que no se mueve,
         sobre todo siliconas. Córdoba me tiene intrigado."
```

LLM extrae:

```json
{
  "role": "dueno",
  "painPoints": ["cobranza", "stock_sin_movimiento"],
  "watchlist": ["siliconas", "Córdoba"],
  "communicationStyle": "directo, informal"
}
```

Se guarda en `user_profiles`. Se usa en el contexto del investigator para 
que priorice lo que le importa al usuario.

### 1.2 Auto-watchlist (menciones repetidas)

```
Día 1: "¿Cuánto nos debe Macrodental?"       → mention_count = 1
Día 5: "¿Macrodental pagó?"                   → mention_count = 2
Día 8: "Che, Macrodental compró algo?"         → mention_count = 3 → AUTO-WATCHLIST ⭐
Día 9: Tuqui abre con insight sobre Macrodental sin que lo pida.
```

Entidad mencionada ≥3 veces → se agrega al watchlist del user profile.
El investigator ve el watchlist → prioriza buscar data sobre esas entidades.

### 1.3 User Discovery desde Odoo (nuevo — pre-intelligence)

Complementa el onboarding conversacional con data REAL de Odoo.
Usando el skill `get_user_activity`, Tuqui infiere automáticamente:

- **Rol real** del usuario (por actividades, mensajes, órdenes que genera)
- **Áreas de interés** (modelos con los que más interactúa: ventas, stock, CRM...)
- **Tono de comunicación** (análisis de mensajes del chatter)
- **Contexto profesional** (departamento, cargo, equipo según `hr.employee`)

```
Odoo activity del usuario
  ├─ mail.message  → temas frecuentes, tono, con quién habla
  ├─ mail.activity → tareas asignadas, deadlines, tipo de trabajo
  ├─ sale.order    → si genera pedidos (es comercial)
  ├─ purchase.order → si genera compras (es de compras)
  └─ hr.employee   → cargo, departamento, manager
```

El LLM sintetiza un mini-perfil (~100 tokens) que se guarda en `user_profiles.bio`
y se usa como contexto en todas las conversaciones.

**Implementación:**
- Skill `get_user_activity` → trae actividad reciente filtrando por user_id de Odoo
- `lib/user/discovery.ts` → orquesta queries + LLM synthesis (análogo a company discovery)
- Botón "Detectar perfil desde Odoo" en la UI de perfil de usuario
- Se ejecuta también como parte del onboarding (post-conexión Odoo)

**Timing:** Se implementa en F7.5 (pre-intelligence) para que el intelligence layer
arranche con perfiles ricos desde el día 1.

### 1.4 Company profile (ya existe)

`company_contexts` ya tiene: industry, key_products, key_customers, business_rules.
`getCompanyContext()` en `context-injector.ts` ya lo arma.
El investigator lo recibe como parte del contexto.

### 1.5 Chats recientes (ya existe)

`chat_sessions.title` tiene títulos auto-generados de cada conversación.
`getRecentUserMessages()` en `chat-history.ts` existe pero no se usa.
El context assembler usa ambas para saber "de qué viene hablando el usuario".

---

## 2. CONTEXT ASSEMBLER

Junta TODO el contexto en un string para el investigator. (~60 líneas)

```typescript
// lib/intelligence/context-assembler.ts

async function assembleInvestigationContext(
  tenantId: string,
  userId: string,
  userEmail: string
): Promise<string> {
  const [company, profile, recentMessages, memories, history] = 
    await Promise.all([
      getCompanyContext(tenantId),           // ya existe
      getUserProfile(userId),                // nuevo
      getRecentUserMessages(tenantId, userEmail, 10), // ya existe, no se usa
      getMemories(userId),                   // query directa
      getInsightHistory(userId, 7),          // últimos 7 días
    ]);

  // También: títulos de las últimas 10 sesiones
  const recentSessions = await getRecentSessionTitles(tenantId, userEmail, 10);

  return `
EMPRESA:
${company}

PERFIL DEL USUARIO:
Rol: ${profile?.role ?? 'desconocido'}
Le preocupa: ${profile?.painPoints?.join(', ') ?? 'no definido'}
Sigue de cerca: ${profile?.watchlist?.join(', ') ?? 'nada específico'}
Estilo: ${profile?.communicationStyle ?? 'profesional'}

ÚLTIMAS CONVERSACIONES:
${recentSessions.map(s => `- ${s.title} (${formatRelative(s.updatedAt)})`).join('\n')}

${recentMessages.length > 0 ? `ÚLTIMOS MENSAJES:
${recentMessages.map(m => `[${m.role}]: ${m.content?.slice(0, 200)}`).join('\n')}` : ''}

${memories.length > 0 ? `NOTAS GUARDADAS:
${memories.map(m => `- ${m.entity_name}: ${m.content}`).join('\n')}` : ''}

INSIGHTS YA MOSTRADOS (NO REPETIR):
${history.map(h => `- ${h.dato} (${formatRelative(h.shownAt)})`).join('\n')}
  `.trim();
}
```

---

## 3. INVESTIGATOR

El corazón. Es un master agent `analista` cuyo prompt vive en DB (igual 
que `odoo`, `contador`, `abogado`). El cron lo invoca con `generateText()` 
y `maxSteps: 8`. (~50 líneas de código — el prompt está en la DB)

```typescript
// lib/intelligence/investigator.ts

async function investigate(
  tenantId: string,
  userId: string,
  context: string
): Promise<string> {
  // 1. Cargar agente desde DB (prompt + tools editables en super-admin)
  const agent = await getAgentBySlug(tenantId, 'analista');
  const tools = await getToolsForAgent(tenant, agent, userId, tenantId);
  const systemPrompt = buildMergedPrompt(agent); // master + custom_instructions

  // 2. Agentic loop — el LLM decide qué tools llamar
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    maxSteps: 8,
    tools,
    system: `${systemPrompt}\n\nCONTEXTO DEL USUARIO Y EMPRESA:\n${context}`,
    prompt: 'Investigá qué datos interesantes hay para este usuario hoy.',
  });

  return text;
}
```

**Clave:** El prompt del analista se edita desde `/super-admin/agents/analista`, 
igual que cualquier otro master agent. Custom instructions por tenant permiten 
personalizar: "para Cedent priorizá stock de vencibles y MeLi".

### Master agent `analista` (INSERT, no código)

```sql
INSERT INTO master_agents (slug, name, icon, description, system_prompt, tools, is_published, is_deletable)
VALUES (
  'analista',
  'Analista Curioso',
  '🔍',
  'Agente de background que investiga datos interesantes para el usuario.
   También disponible en chat para análisis profundos bajo demanda.
   Se ejecuta via cron y genera teasers diarios.',
  'Sos un analista de negocios curioso y perspicaz.
   Tu trabajo es investigar datos interesantes para el usuario.

   INSTRUCCIONES:
   1. Usá las herramientas para buscar datos que le IMPORTEN al usuario
   2. Priorizá lo que aparece en "Le preocupa" y "Sigue de cerca"
   3. Buscá VARIEDAD: no todo del ERP — también mercado, legal, noticias
   4. Buscá SORPRESAS: anomalías, cambios bruscos, oportunidades ocultas
   5. Buscá URGENCIAS: vencimientos, deuda que crece, stock que se acaba
   6. NO repitas lo que ya se mostró (ver "INSIGHTS YA MOSTRADOS")
   7. Hacé entre 3 y 8 consultas. No más.
   8. PRIORIZACIÓN POR ROL:
      - dueno/gerente → visión macro: ventas totales, cobranza, anomalías
      - comercial → su pipeline, sus clientes, oportunidades, precios de mercado
      - compras → stock bajo, OC pendientes, precios de proveedores
      - contador → deuda vencida, vencimientos impositivos, pagos recibidos
      Adaptá los teasers al rol del usuario.
   9. Si tenés acceso a Google Calendar, cruzá reuniones del día con datos del ERP
      (ej: "Tenés reunión con Dental Sur — hace 23 días que no compran")

   Al final, escribí un resumen de tus hallazgos más interesantes.',
  ARRAY['odoo', 'web_search', 'knowledge_base'],
  true,   -- is_published
  false   -- is_deletable (no se puede borrar)
);
```

El campo `is_deletable` se agrega en la migration 212:

```sql
ALTER TABLE master_agents ADD COLUMN is_deletable BOOLEAN DEFAULT true;
```

Los master agents del sistema (`analista`, y potencialmente otros de background)
se crean con `is_deletable = false`. La UI de super-admin y delete bloquean 
el borrado si `is_deletable = false`.

Editar el prompt = editar en UI, no deploy.
Nuevo tenant = `sync_agents_from_masters()` le crea su instancia.
Custom instructions = "para Cedent priorizá stock de vencibles".

### ¿Qué tools se cargan?

Las mismas que cualquier agente. Se reutiliza la infra existente.
El toggle de tools se configura en la UI del super-admin.

---

## 4. SYNTHESIZER

Toma los hallazgos del investigator → genera teasers estructurados. (~50 líneas)

```typescript
// lib/intelligence/synthesizer.ts

interface Teaser {
  emoji: string;
  dato: string;       // 1 línea, el hook — genera curiosidad
  pregunta: string;   // pregunta sugerida — da ganas de tocar
  actionHint?: string; // acción sugerida: "Enviar recordatorio", "Crear OC"
                       // se muestra como chip secundario, futuro-proof para
                       // acciones directas cuando haya Odoo bidireccional
}

async function synthesize(
  findings: string,
  context: string,
  previousInsights: string[]
): Promise<Teaser[]> {
  const { object } = await generateObject({
    model: google('gemini-2.5-flash'),
    schema: z.object({
      teasers: z.array(z.object({
        emoji: z.string(),
        dato: z.string().describe('1 línea concisa, el hook — genera curiosidad'),
        pregunta: z.string().describe('pregunta sugerida que invite a profundizar'),
        actionHint: z.string().optional().describe('acción concreta sugerida: "Enviar recordatorio", "Crear OC", etc.'),
      })).min(2).max(3),
    }),
    system: `Convertí hallazgos en teasers irresistibles.

Reglas:
- Cada teaser = emoji + dato concreto + pregunta disparadora
- El DATO tiene un número, nombre o hecho específico (no vaguedades)
- La PREGUNTA invita a abrir el chat y preguntar más
- NUNCA repitas algo ya mostrado: ${previousInsights.join(' | ')}
- VARIÁ las fuentes: si hay datos del ERP y del mercado, usá ambos
- Tono: español argentino, directo, informal
- Priorizá: urgencias > sorpresas > oportunidades`,
    prompt: `Hallazgos del investigador:\n${findings}\n\nContexto:\n${context}`,
  });

  return object.teasers;
}
```

---

## 5. ENGINE

Orquesta todo: context → investigate → synthesize → cache. (~40 líneas)

```typescript
// lib/intelligence/engine.ts

async function generateInsights(
  tenantId: string,
  userId: string,
  userEmail: string
): Promise<Teaser[]> {
  // 1. Armar contexto
  const context = await assembleInvestigationContext(tenantId, userId, userEmail);

  // 2. Cargar tools (reutiliza infra del chat)
  const tools = await loadInvestigatorTools(tenantId, userId);

  // 3. Investigar (agentic loop, 3-8 tool calls)
  const findings = await investigate(context, tools);

  // 4. Sintetizar en teasers
  const history = await getInsightHistory(userId, 7);
  const teasers = await synthesize(findings, context,
    history.map(h => h.dato));

  // 5. Cachear
  await cacheInsights(tenantId, userId, teasers);

  return teasers;
}
```

---

## 6. DELIVERY

> **F6 (Briefings Matutinos) está absorbido acá.** No existe como fase separada.
> Un solo flujo: analista investiga → teasers → cache → push + session opener.

### 6.1 Session Opener

Al abrir el chat, se muestran 2 teasers + preguntas sugeridas clickeables.

```typescript
// lib/intelligence/delivery.ts

async function getSessionOpener(
  tenantId: string,
  userId: string,
  userEmail: string
): Promise<SessionOpener | null> {
  // 1. Buscar en cache (pre-computado por cron)
  const cached = await getCachedInsights(tenantId, userId);

  let teasers: Teaser[];

  if (cached && !cached.served && isRecent(cached.generatedAt, 12)) {
    // Cache fresco, no servido → usar
    teasers = cached.teasers;
  } else {
    // No hay cache o ya se sirvió → generar on-demand
    teasers = await generateInsights(tenantId, userId, userEmail);
  }

  if (teasers.length === 0) return null;

  // 2. Marcar como servido + guardar en historial
  await markAsServed(tenantId, userId);
  await saveToHistory(userId, teasers);

  // 3. Armar respuesta
  return {
    content: teasers.map(t => `${t.emoji} ${t.dato}`).join('\n\n'),
    suggestedQuestions: teasers.map(t => t.pregunta),
  };
}
```

### 6.2 Cron Matutino + Push Delivery

Pre-computa insights Y los envía como push notification.
El push es el HOOK matutino — 1 línea con el dato más impactante.
El session opener es el CONTENIDO completo al abrir.

```typescript
// app/api/cron/intelligence/route.ts

export async function GET(request: Request) {
  // Verificar CRON_SECRET
  // Para cada tenant activo:
  //   Para cada user que usó Tuqui en los últimos 7 días:
  //     1. generateInsights(tenantId, userId, userEmail)
  //        → queda en insight_cache, served = false
  //     2. Enviar push con el teaser más impactante:
  //        sendPushToUser(db, tenantId, userEmail, {
  //          title: '🌅 Buenos días',
  //          body: teasers[0].emoji + ' ' + teasers[0].dato,
  //          link: '/chat/tuqui'
  //        })
  //        → usa infra de F5 (lib/push/sender.ts)
}
```

**Flujo completo:**

```
7:00 AM  → Cron → generateInsights() → cache (served=false)
7:01 AM  → Push al celu: "👻 Macrodental no compra hace 47 días"
9:15 AM  → Usuario toca push → abre Tuqui PWA (ya logueado)
         → getSessionOpener() → lee cache → 2-3 teasers completos
         → Usuario toca pregunta → chat normal → Tuqui responde
         → cache marcado served=true
13:00    → Abre de nuevo → cache ya served → on-demand refresh
         → Nuevos teasers generados → sorpresa diferente
```

**¿Por qué absorber F6 acá?**

F6 planteaba un `lib/briefings/generator.ts` + migration `220_briefing_config.sql` + 
cron separado + UI de config. Todo eso es redundante porque:
- El intelligence layer YA genera contenido matutino personalizado
- La personalización viene de `user_profiles` (pain_points, watchlist, role)
- El canal de delivery es push (F5) que ya existe
- Un solo cron, un solo flujo, cero duplicación

**Archivos eliminados (antes en F6):**
- ~~`lib/briefings/generator.ts`~~ → absorbido por `lib/intelligence/engine.ts`
- ~~`app/api/cron/briefings/route.ts`~~ → absorbido por `app/api/cron/intelligence/route.ts`
- ~~`components/BriefingSettings.tsx`~~ → absorbido por onboarding conversacional
- ~~`migration 220_briefing_config.sql`~~ → no se necesita

---

## 7. EL DOPAMINE LOOP EN ACCIÓN

```
LUNES
  👻 Macrodental no compra hace 47 días — era tu 3er cliente
  ¿Qué dejó de llevar?

  📦 Siliconas Vericom: stock para 12 días, sin OC abierta
  ¿Querés que busque alternativas de proveedor?  ✨ Acción sugerida: Crear OC a proveedor alternativo
MARTES
  🛒 Composite 3M: lo vendés a $45.000, en MeLi el más barato está $62.000
  ¿Estoy regalando margen?
  ✨ Acción sugerida: Actualizar precio

  ⚖️ ARCA: nuevas retenciones de IVA para contribuyentes intensivos
  ¿Me afecta?

MIÉRCOLES
  📰 3M lanzó Filtek Universal Flow — ya tiene 23 publicaciones en MeLi
  ¿Lo tenemos en catálogo?

  👥 14 clientes en Córdoba, $0 facturado en febrero
  ¿Qué pasó en la zona?

JUEVES
  💡 146 oportunidades en CRM llevan más de 1 año abiertas
  ¿Las limpiamos?

  📊 Cobranza: entraron $11M de los $18M facturados (61%)
  ¿Quién es el que más debe?
  ✨ Acción sugerida: Enviar recordatorios de pago

VIERNES
  🦷 "Alineadores estéticos" creció 23% en búsquedas en Argentina
  ¿Tenemos algo en esa línea?

  ✅ Esta semana facturaste $18.2M (+8% vs semana pasada)
  ¿Cómo vamos contra el mes pasado?
```

**Cada día diferente. Cada día desde distintas fuentes. Cada día con una 
pregunta que invita a profundizar. El usuario abre por curiosidad.**

---

## 8. ESQUEMA DE DATOS

> **⚠️ NOTA:** `user_profiles` ya existe (migrations 211 + 213) con schema:
> `id, user_id, tenant_id, display_name, role_title, area, bio, interests, created_at, updated_at`.
> La migration 212 debe usar ALTER TABLE para agregar columnas faltantes.

```sql
-- Migration 212_intelligence.sql

-- Agregar columnas de intelligence a user_profiles (ya existe desde migration 211)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pain_points TEXT[] DEFAULT '{}';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS watchlist TEXT[] DEFAULT '{}';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS communication_style TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS raw_onboarding_text TEXT;

-- Auto-watchlist: trackea menciones repetidas
CREATE TABLE entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entity_name TEXT NOT NULL,
  mention_count INT DEFAULT 1,
  last_mentioned TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, entity_name)
);

-- Historial de insights mostrados (cooldown + feedback)
CREATE TABLE insight_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  dato TEXT NOT NULL,
  emoji TEXT,
  pregunta TEXT,
  shown_at TIMESTAMPTZ DEFAULT now(),
  tapped BOOLEAN DEFAULT false        -- ¿el user hizo click en la pregunta?
);

-- Cache de insights pre-computados (cron escribe, delivery lee)
CREATE TABLE insight_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  teasers JSONB NOT NULL,             -- [{emoji, dato, pregunta}]
  generated_at TIMESTAMPTZ DEFAULT now(),
  served BOOLEAN DEFAULT false,
  UNIQUE(tenant_id, user_id)          -- 1 cache por user
);

-- RLS: cada user solo ve sus propios datos
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_cache ENABLE ROW LEVEL SECURITY;

-- Policies: service_role para cron, authenticated para lectura propia
CREATE POLICY "Users see own profile" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own profile" ON user_profiles
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users see own mentions" ON entity_mentions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users see own insights" ON insight_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users see own cache" ON insight_cache
  FOR SELECT USING (user_id = auth.uid());

-- Service role bypass para cron + engine
CREATE POLICY "Service manages all" ON insight_cache
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service manages history" ON insight_history
  FOR ALL USING (true) WITH CHECK (true);
```

---

## 9. ESTRUCTURA DE ARCHIVOS

```
lib/intelligence/
  types.ts                  # ~30 líneas — Teaser, UserProfile, SessionOpener
  context-assembler.ts      # ~60 líneas — junta todo el contexto
  investigator.ts           # ~80 líneas — agentic loop con tools existentes
  synthesizer.ts            # ~50 líneas — hallazgos → teasers estructurados
  engine.ts                 # ~40 líneas — orquesta context→investigate→synthesize
  delivery.ts               # ~60 líneas — session opener + push + cache logic
  history.ts                # ~40 líneas — insight_history CRUD + cooldown

lib/intelligence/profiles/
  user-profile.ts           # ~50 líneas — CRUD user_profiles
  extract-profile.ts        # ~40 líneas — LLM extrae de texto libre
  memory-enricher.ts        # ~50 líneas — auto-watchlist por menciones

app/api/cron/intelligence/
  route.ts                  # ~30 líneas — cron matutino

supabase/migrations/
  212_intelligence.sql      # tablas: user_profiles, entity_mentions,
                            # insight_history, insight_cache + RLS

tests/unit/intelligence/
  extract-profile.test.ts
  context-assembler.test.ts
  investigator.test.ts      # con tools mockeadas
  synthesizer.test.ts
  engine.test.ts
  delivery.test.ts
  memory-enricher.test.ts

Total: ~13 archivos de código, ~530 líneas
       + 1 migration, 7 tests
       + push delivery reutiliza lib/push/sender.ts de F5
```

---

## 10. INTEGRACIÓN CON CÓDIGO EXISTENTE

### Qué se reutiliza (no se toca)

| Componente | Archivo | Uso |
|---|---|---|
| Company context | `lib/company/context-injector.ts` | `getCompanyContext()` → contexto empresa |
| Tool loading | `lib/tools/executor.ts` | `getToolsForAgent()` → mismas tools del chat |
| Skill registry | `lib/skills/registry.ts` | `globalRegistry` → 50 Odoo skills |
| MeLi hybrid | `lib/skills/web-search/mercadolibre/` | Via `web_search` tool |
| Tavily | `lib/tools/web-search.ts` | Via `web_search` tool |
| RAG search | `lib/rag/search.ts` | Via `knowledge_base` tool |
| Memory | `lib/skills/memory/` | Via query directa a `memories` table |
| Chat history | `lib/supabase/chat-history.ts` | `getRecentUserMessages()` + session titles |
| Agent service | `lib/agents/service.ts` | `getAgentBySlug('analista')` → prompt + tools de DB |
| Merged prompt | `lib/agents/service.ts` | `buildMergedPrompt()` → master + custom_instructions |
| Agent sync | `sync_agents_from_masters()` | Propaga analista a todos los tenants |
| Push sender | `lib/push/sender.ts` | `sendPushToUser()` — extraer de `lib/prometeo/notifier.ts` en F5 |

### Qué se modifica (mínimo)

| Archivo | Cambio | Líneas |
|---|---|---|
| `lib/chat/engine.ts` | Llamar `enrichFromMessage()` post-mensaje | ~5 líneas |
| `app/chat/[slug]/page.tsx` | Llamar `getSessionOpener()` al abrir sesión nueva | ~10 líneas |
| `vercel.json` | Agregar cron schedule para `/api/cron/intelligence` | ~3 líneas |

### Qué se reutiliza de F5 (PWA + Push)

| Componente | Archivo | Uso |
|---|---|---|
| Push sender | `lib/push/sender.ts` | `sendPushToUser()` envía el teaser matutino (extraer en F5) |
| Push subscribe | `app/api/push/subscribe/route.ts` | Suscripción ya gestionada por F5 |
| Service worker | `public/sw.js` | Ya maneja push events + click → open app |

### Integración futura: Google Tools (F7.7)

Cuando F7.7 (Google Calendar + Gmail) esté implementado, el investigator
automáticamente los puede usar si el agente `analista` tiene acceso a esos tools.
No requiere cambios en el intelligence layer — solo agregar los tools al array
del master agent: `ARRAY['odoo', 'web_search', 'knowledge_base', 'google']`.

**Per-user connections:** Los Google tools son per-user (cada usuario conecta
SU cuenta desde `/herramientas`). El investigator recibe `userId` en el context
→ `loadUserConnection(userId, 'google_calendar')` → si el user no conectó,
el skill retorna `{ available: false }` y el investigator lo omite.
Esto es transparente para el intelligence layer — el skill se encarga.

Cruce de ejemplo: "Tenés reunión con Dental Sur a las 11 — hace 23 días que
no compran, llevan $45K en deuda vencida."

### Nota sobre Prometeo

Prometeo (`lib/prometeo/`) ya tiene infra completa para alertas condicionales
(cron polling, AI evaluation, multi-channel notifications). Por ahora el
intelligence layer opera de forma independiente. En el futuro, se puede evaluar
si conectar el investigator con Prometeo para alertas real-time (ej: venta grande,
stock crítico) tiene sentido como extensión. Por ahora, el cron matutino +
push + session opener cubren el caso de uso.

---

## 11. FASES DE IMPLEMENTACIÓN

### F7.6a: Profiles + Engine + Session Opener (2 sesiones)

**Sesión 1: DB + Profiles + Context + Master Agent**
- [ ] Migration `212_intelligence.sql` (4 tablas + RLS)
- [ ] INSERT master agent `analista` (prompt + tools en DB, no en código)
- [ ] `types.ts` — interfaces
- [ ] `profiles/extract-profile.ts` — LLM extrae de texto
- [ ] `profiles/user-profile.ts` — CRUD
- [ ] `profiles/memory-enricher.ts` — auto-watchlist
- [ ] `context-assembler.ts` — junta todo el contexto
- [ ] Tests: extract-profile, user-profile, memory-enricher, context-assembler

**Sesión 2: Investigator + Synthesizer + Delivery**
- [ ] `investigator.ts` — agentic loop con tools
- [ ] `synthesizer.ts` — hallazgos → teasers
- [ ] `engine.ts` — orquesta todo
- [ ] `history.ts` — insight_history CRUD
- [ ] `delivery.ts` — session opener + cache
- [ ] Tests: investigator (con mocks), synthesizer, engine, delivery
- [ ] Integrar: session opener en `app/chat/[slug]/page.tsx`
- [ ] Integrar: memory-enricher en `lib/chat/engine.ts`
- [ ] Probar con Cedent: verificar insights con data real

### F7.6b: Cron + Push Delivery + Polish (1 sesión)

- [ ] `app/api/cron/intelligence/route.ts` — cron matutino + push delivery
- [ ] Configurar en `vercel.json`
- [ ] Push delivery: después de cachear, enviar push con teaser más impactante
- [ ] Feedback tracking: guardar `tapped` cuando user hace click
- [ ] Onboarding flow: detectar user sin profile → mostrar pregunta inicial
- [ ] Tests: cron, push delivery, feedback tracking
- [ ] Eval: correr contra Cedent 5 días, medir variedad + relevancia

---

## 12. TESTS

| Test | Qué valida |
|------|-----------|
| `extractProfile("soy el dueño, me mata la cobranza")` | `role=dueno`, `painPoints` includes `cobranza` |
| `extractProfile("quiero seguir siliconas y Córdoba")` | `watchlist` includes `siliconas`, `Córdoba` |
| `assembleContext()` con mocks | Incluye company + profile + sessions + memories + history |
| `investigate()` con tools mockeadas | Hace ≥3 tool calls, retorna texto con hallazgos |
| `synthesize()` con hallazgos variados | 2-3 teasers, cada uno tiene emoji + dato + pregunta |
| `synthesize()` con historial | No repite insights ya mostrados |
| Mention 3x "Macrodental" | Auto-agrega a watchlist |
| `getSessionOpener()` con cache fresco | Retorna teasers del cache, marca served |
| `getSessionOpener()` sin cache | Genera on-demand, cachea |
| Push delivery envía teaser más impactante | `sendPushToUser` llamado post-cache |
| `generateInsights()` E2E con Cedent | Teasers con datos reales y relevantes |

---

## 13. COSTOS

```
Por generación de insights (1 usuario):
  Context assembler:  ~0 (queries a DB)
  Investigator:       ~3-8 tool calls × ~200 tokens = ~1600 tokens input
                      + LLM reasoning: ~500 tokens
                      = ~$0.002 per run (gemini-2.5-flash)
  Synthesizer:        ~800 tokens input, ~200 output = ~$0.001

  Total por usuario por día: ~$0.003
  10 usuarios: ~$0.03/día = ~$0.90/mes

Conclusión: negligible. Menos que una conversación normal.
```

---

## 14. MÉTRICAS DE ÉXITO

| Métrica | Target |
|---------|--------|
| DAU / MAU ratio | >40% |
| Tap rate en preguntas sugeridas | >30% |
| Push open rate | >40% |
| Variedad de sources por semana | ≥2 tipos distintos |
| Session length post-teaser | ≥3 mensajes |
| "No sabía esto" rate (feedback) | >50% |

---

## 15. EL PITCH

**"Tuqui no te muestra datos. Te dice lo que no sabías que tenías que preguntar."**

Es un agente curioso que investiga tu negocio todos los días. A veces encuentra 
algo en tu ERP. A veces en el mercado. A veces en las noticias legales. Siempre 
personalizado a lo que te importa. Siempre con una pregunta que te invita a 
profundizar.

~13 archivos, ~530 líneas. El LLM hace el trabajo pesado.
Las tools ya existen. El código nuevo es solo orquestación.
El push matutino reusa la infra de F5. F6 no existe como fase separada.

Cuando F7.7 (Google) esté listo, el analista cruza tu agenda con tu ERP
sin tocar una línea del intelligence layer.

---

*Spec técnica completa. Úsese como guía de implementación.*
*Referencia: TUQUI_REFACTOR_PLAN.md § F7.6*
