# 🏢 Tuqui Central — Super Admin UI

> **Objetivo:** UI simple para gestionar tenants, master agents y prompts sin tocar SQL ni hacer deploys.
> **Enfoque pre-PMF:** Sin billing, sin analytics fancy, sin Stripe. Solo lo operativo.
> **Filosofía:** Config en DB, no en código. La UI más simple que funcione.

---

## 📊 Estado Actual vs Objetivo

### Qué HAY hoy en `/super-admin/tenants`

| Feature | Estado | Problema |
|---------|--------|----------|
| Lista de tenants | ✅ Tabla básica | Sin métricas, sin filtros, sin búsqueda |
| Crear tenant | ✅ Modal | Solo pide nombre + email + password. No genera slug |
| Sync master agents | ✅ Botón | Syncea TODO a TODOS. Sin granularidad |
| Ver detalle de tenant | ❌ | No existe click-through |
| Editar tenant | ❌ | No se puede editar nombre, estado, nada |
| Desactivar tenant | ❌ | Badge "Activo" hardcodeado en verde |
| CRUD master agents | ❌ | Solo se crean/editan via SQL migrations |
| Editar prompts master | ❌ | Requiere: editar SQL → commit → deploy → sync |
| Ver uso de tokens | ❌ | La data existe en `usage_stats` pero es invisible |
| Gestionar usuarios cross-tenant | ❌ | Solo desde admin de cada tenant |

### Qué QUEREMOS

Un super-admin que permita en **3 pantallas**:

1. **Tenants** → listar, crear, editar, desactivar, ver detalle rápido
2. **Master Agents** → CRUD completo con editor de prompts, sync selectivo
3. **Overview** → métricas mínimas de tokens para saber qué pasa

---

## 🏗️ Arquitectura

### Rutas nuevas

```
app/super-admin/
├── layout.tsx                          # YA EXISTE — refactorear auth
├── page.tsx                            # NUEVO — Overview/dashboard mínimo
├── tenants/
│   ├── page.tsx                        # YA EXISTE — mejorar tabla
│   └── [id]/
│       └── page.tsx                    # NUEVO — Detalle de tenant
└── agents/
    ├── page.tsx                        # NUEVO — Lista master agents
    └── [slug]/
        └── page.tsx                    # NUEVO — Editor de master agent
```

### API routes nuevas

```
app/api/super-admin/
├── tenants/
│   ├── route.ts                        # YA EXISTE — mejorar GET, agregar PATCH
│   └── [id]/
│       └── route.ts                    # NUEVO — GET detail, PATCH update
└── agents/
    ├── route.ts                        # NUEVO — GET list, POST create
    └── [slug]/
        ├── route.ts                    # NUEVO — GET detail, PUT update
        └── sync/
            └── route.ts               # NUEVO — POST sync a tenants
```

### Componentes nuevos

```
components/super-admin/
├── TenantTable.tsx                     # Tabla mejorada con métricas
├── TenantDetail.tsx                    # Vista de detalle
├── TenantCreateModal.tsx               # Modal mejorado
├── MasterAgentList.tsx                 # Lista de master agents
├── MasterAgentEditor.tsx               # Editor de prompt + config
└── UsageOverview.tsx                   # Métricas mínimas
```

### Helper nuevo

```
lib/platform/
└── auth.ts                             # getPlatformAdmin(), requirePlatformAdmin()
```

---

## Fase 1 — Fundaciones (medio día)

### 1.1 — Helper de platform admin

Extraer la lógica duplicada de check de super-admin a un solo lugar.

**Archivo nuevo: `lib/platform/auth.ts`**

```typescript
const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS || 'gr@adhoc.inc')
  .split(',')
  .map(e => e.trim())

export function isPlatformAdmin(email: string | null | undefined): boolean {
  return !!email && PLATFORM_ADMIN_EMAILS.includes(email)
}

export async function requirePlatformAdmin() {
  const session = await auth()
  if (!session?.user?.email || !isPlatformAdmin(session.user.email)) {
    redirect('/')
  }
  return session
}
```

> Hoy este check está duplicado en `layout.tsx` Y en `route.ts` con lógica ligeramente diferente. Centralizar.

**Impacto:** Tocar `app/super-admin/layout.tsx` y `app/api/super-admin/tenants/route.ts`.

### 1.2 — Limpiar super-admin existente

- Sacar todos los `console.log` de debug del tenants page y API route
- Sacar la query duplicada "simple query" del GET de tenants
- Agregar manejo de error consistente (hoy mezcla try/catch con .error checks)

### 1.3 — Fix: createTenant no genera slug

**Problema:** `createTenant()` en `lib/tenants/service.ts` no recibe ni genera `slug`,
pero la tabla `tenants` tiene `slug TEXT UNIQUE NOT NULL`. Esto probablemente falla o
se setea por defecto.

**Fix:** Generar slug automático desde el nombre:

```typescript
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
```

---

## Fase 2 — Tenants mejorado (2-3 días)

### 2.1 — Tabla de tenants con métricas

Mejorar la tabla existente en `/super-admin/tenants` para mostrar info útil de un vistazo.

**Columnas:**

| Columna | Source | Cómo |
|---------|--------|------|
| Nombre | `tenants.name` | Ya existe |
| Slug | `tenants.slug` | Agregar |
| Usuarios | `COUNT(users)` | Join/subquery |
| Tokens (mes) | `SUM(usage_stats.total_tokens)` | Join WHERE year_month = current |
| Estado | `tenants.is_active` | Ya existe la columna, mostrarla real |
| Creado | `tenants.created_at` | Ya existe, formatear relativo |
| Acciones | — | Ver detalle, desactivar |

**Query del GET mejorado:**

```sql
SELECT
  t.id, t.name, t.slug, t.is_active, t.created_at,
  (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as user_count,
  (SELECT COALESCE(SUM(us.total_tokens), 0)
   FROM usage_stats us
   WHERE us.tenant_id = t.id
   AND us.year_month = to_char(now(), 'YYYY-MM')
  ) as tokens_this_month
FROM tenants t
ORDER BY t.created_at DESC
```

> **Nota:** Un solo query con subqueries escalares, no N+1.

**Búsqueda:** Input de texto que filtre por nombre o slug (client-side, con pocos tenants alcanza).

### 2.2 — Modal de creación mejorado

Agregar al modal existente:

| Campo | Tipo | Notas |
|-------|------|-------|
| Nombre | Text input | Ya existe |
| Slug | Text input | Auto-generado desde nombre, editable |
| Admin email | Email input | Ya existe |
| Admin password | Password input | Ya existe |
| Agentes | Checkboxes | Lista de master agents publicados, todos checked por default |

**Cambio en `createTenant()`:**
- Recibir `slug` como parámetro (hoy no lo recibe)
- Recibir `selectedAgentSlugs?: string[]` — si se pasa, solo clonar esos (hoy clona todos)

### 2.3 — Tenant detail view

**Ruta:** `/super-admin/tenants/[id]`

Server Component. Toda la info de un tenant en una sola página (sin tabs, sin SPA).
Secciones apiladas:

```
┌─────────────────────────────────────────────┐
│ ← Volver a tenants                          │
│                                             │
│ Adhoc SA                           🟢 Activo│
│ slug: adhoc · creado: hace 3 meses          │
│                                             │
│ ─── Info ────────────────────────────────── │
│ Nombre: [Adhoc SA          ] [Guardar]      │
│ Estado: [● Activo ▾]                        │
│                                             │
│ ─── Usuarios (5) ────────────────────────── │
│ gr@adhoc.inc          admin    120k tokens   │
│ juan@adhoc.inc        member    45k tokens   │
│ maria@adhoc.inc       member    32k tokens   │
│                                             │
│ ─── Agentes (4 activos / 5 total) ───────── │
│ ✅ Orchestrator     v3 (synced)             │
│ ✅ Odoo ERP         v2 (synced)  📝 custom  │
│ ✅ Tuqui Chat       v1 (synced)             │
│ ❌ MeLi Precios     v1 (desactivado)        │
│ ✅ Tuqui Contador   v1 (synced)             │
│                                             │
│ ─── Uso del mes ─────────────────────────── │
│ Total tokens: 197,000                       │
│ Total mensajes: 342                         │
│ Promedio por usuario: 39,400 tokens         │
│                                             │
│ ─── Integraciones ───────────────────────── │
│ Odoo: ✅ Configurado                        │
│ MeLi: ❌ No configurado                     │
│ Twilio: ✅ +54 11 1234-5678                 │
└─────────────────────────────────────────────┘
```

**Datos (todos ya en la DB, paralelos):**

```typescript
const [tenant, users, agents, usage, integrations] = await Promise.all([
  db.from('tenants').select('*').eq('id', id).single(),
  db.from('users').select('id, email, name, is_admin').eq('tenant_id', id),
  db.from('agents').select('slug, name, is_active, master_agent_id, master_version_synced, custom_instructions')
    .eq('tenant_id', id),
  db.from('usage_stats').select('user_email, total_tokens, total_requests')
    .eq('tenant_id', id).eq('year_month', currentMonth),
  db.from('integrations').select('type, is_active').eq('tenant_id', id),
])
```

**Acciones desde el detail:**
- Editar nombre del tenant (inline edit + server action)
- Activar/desactivar tenant (toggle)
- Ver qué agentes tienen custom_instructions (badge "📝 custom")
- Ver qué agentes están desactualizados (comparar `master_version_synced` vs `master.version`)

---

## Fase 3 — Master Agents CRUD (2-3 días) ⭐

> **Esta es la fase más importante.** Poder editar prompts sin deploy cambia
> completamente la velocidad de iteración.

### 3.1 — Lista de master agents

**Ruta:** `/super-admin/agents`

```
┌────────────────────────────────────────────────────┐
│ Master Agents                    [+ Nuevo Agent]   │
│                                                    │
│ ┌──────────────────────────────────────────────┐   │
│ │ 🤖 Orchestrator                    v3  ✅    │   │
│ │ Asistente general con búsqueda web           │   │
│ │ Tools: web_search, tavily     5/5 tenants    │   │
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ 📊 Odoo ERP                        v2  ✅    │   │
│ │ Business Intelligence para Odoo              │   │
│ │ Tools: odoo_intelligent_query 3/5 tenants    │   │
│ └──────────────────────────────────────────────┘   │
│ ...                                                │
└────────────────────────────────────────────────────┘
```

**Datos por agent:**
- Nombre, descripción, icon, version
- Tools asignados
- Count de tenants que lo tienen activo vs total
- `is_published` (✅ / borrador)

### 3.2 — Editor de master agent

**Ruta:** `/super-admin/agents/[slug]`

Server Component con Server Actions (mismo patrón que `admin/agents/[slug]`).

```
┌────────────────────────────────────────────────────┐
│ ← Master Agents                                   │
│                                                    │
│ Orchestrator                              v3       │
│                                                    │
│ ─── Configuración ───────────────────────────────  │
│ Nombre:      [Orchestrator              ]          │
│ Descripción: [Asistente general...      ]          │
│ Slug:        orchestrator (read-only)              │
│ Publicado:   [✅]                                  │
│                                                    │
│ ─── System Prompt ───────────────────────────────  │
│ ┌────────────────────────────────────────────┐     │
│ │ Sos un asistente de IA llamado Tuqui.      │     │
│ │ Tu rol es ayudar al usuario respondiendo   │     │
│ │ preguntas generales con información        │     │
│ │ actualizada usando búsqueda web.           │     │
│ │                                            │     │
│ │ ## Reglas                                  │     │
│ │ - Respondé en español argentino            │     │
│ │ - Sé conciso y directo                     │     │
│ │ ...                                        │     │
│ └────────────────────────────────────────────┘     │
│                                                    │
│ ─── Tools ───────────────────────────────────────  │
│ ☑ web_search — Búsqueda web con Tavily            │
│ ☐ odoo_intelligent_query — Queries a Odoo ERP     │
│ ☐ meli_search — Precios en MercadoLibre           │
│ ☑ knowledge_base — Base de conocimiento (RAG)     │
│                                                    │
│ ─── Mensajes ────────────────────────────────────  │
│ Welcome:     [¡Hola! Soy Tuqui...       ]         │
│ Placeholder: [Preguntame lo que quieras  ]         │
│                                                    │
│ ─── RAG ─────────────────────────────────────────  │
│ Habilitado:  [✅]                                  │
│                                                    │
│ [💾 Guardar]  [🔄 Sync a todos los tenants]       │
│                                                    │
│ ─── Tenants usando este agent ───────────────────  │
│ Adhoc SA       ✅ activo  v3 synced    📝 custom   │
│ Cliente Demo   ✅ activo  v2 ⚠️ desactualizado     │
│ Test Corp      ❌ inactivo                         │
└────────────────────────────────────────────────────┘
```

**Server Action `saveAgent`:**

```typescript
async function saveAgent(formData: FormData) {
  'use server'
  const slug = formData.get('slug') as string
  const updates = {
    name: formData.get('name'),
    description: formData.get('description'),
    system_prompt: formData.get('system_prompt'),
    tools: formData.getAll('tools'),
    welcome_message: formData.get('welcome_message'),
    placeholder_text: formData.get('placeholder_text'),
    rag_enabled: formData.get('rag_enabled') === 'on',
    is_published: formData.get('is_published') === 'on',
    version: currentVersion + 1,  // AUTO INCREMENT
    updated_at: new Date().toISOString(),
  }
  await db.from('master_agents').update(updates).eq('slug', slug)
  revalidatePath(`/super-admin/agents/${slug}`)
}
```

**Server Action `syncToTenants`:**

```typescript
async function syncToTenants() {
  'use server'
  await db.rpc('sync_agents_from_masters')
  revalidatePath(`/super-admin/agents/${slug}`)
}
```

**Flujo:**

```
1. Editás el prompt en el textarea
2. Click "Guardar" → actualiza master_agents + incrementa version
3. Abajo ves qué tenants están desactualizados (version != master_version_synced)
4. Click "Sync a todos" → ejecuta sync_agents_from_masters()
5. Los tenants pasan a "synced"
```

> Los tenants con `custom_instructions` mantienen sus instrucciones —
> el sync solo actualiza el `system_prompt` base, no pisa las customizaciones.
> Esto ya funciona así en la función SQL existente.

### 3.3 — Crear nuevo master agent

Modal simple con:
- Nombre → auto-genera slug
- Descripción
- System prompt (textarea)
- Tools (checkboxes)
- RAG enabled (toggle)

Al crear, queda en `is_published = false` (borrador) hasta que lo publiques.
Publicar + Sync lo propaga a todos los tenants.

### 3.4 — Funciones nuevas en agent service

Agregar a `lib/agents/service.ts`:

```typescript
export async function updateMasterAgent(slug: string, updates: Partial<MasterAgent>)
export async function createMasterAgent(data: CreateMasterAgentInput)
export async function getMasterAgentWithTenants(slug: string)
export async function syncMasterToTenants(slug?: string)  // slug opcional = sync all
```

---

## Fase 4 — Overview mínimo (medio día)

### 4.1 — Dashboard `/super-admin`

Hoy `/super-admin` no tiene page. Agregar overview mínimo como landing:

```
┌─────────────────────────────────────────┐
│ Tuqui — Super Admin                     │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│  │ 5       │ │ 12      │ │ 847k     │  │
│  │ Tenants │ │ Usuarios│ │ Tokens   │  │
│  │         │ │         │ │ (mes)    │  │
│  └─────────┘ └─────────┘ └──────────┘  │
│                                         │
│  Accesos rápidos:                       │
│  [📋 Tenants]  [🤖 Master Agents]      │
│                                         │
│  Tenants con más uso (este mes):        │
│  1. Adhoc SA — 520k tokens              │
│  2. Cliente Demo — 180k tokens          │
│  3. Test Corp — 147k tokens             │
│                                         │
│  Agents desactualizados:                │
│  ⚠️ 2 tenants tienen agents sin sync    │
└─────────────────────────────────────────┘
```

Puro Server Component. 3 queries simples. Sin gráficos, sin librerías.

---

## Fase 5 — Seguridad mínima (1 día)

### 5.1 — Encryption real

Reescribir `lib/crypto.ts` con AES-256-GCM real. Mantener backwards compat con Base64.

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

export function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v2:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(text: string): string {
  if (!text) return ''
  if (text.startsWith('v2:')) {
    const [, ivHex, tagHex, dataHex] = text.split(':')
    const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return decipher.update(dataHex, 'hex', 'utf8') + decipher.final('utf8')
  }
  // Legacy base64
  if (text.startsWith('enc:')) return Buffer.from(text.slice(4), 'base64').toString('utf8')
  return Buffer.from(text, 'base64').toString('utf8')
}
```

Script `scripts/migrate-encryption.ts` para re-encriptar credenciales existentes.

### 5.2 — Fix Supabase singleton (concurrencia)

En `lib/supabase/client.ts`, el singleton comparte `set_tenant_context()` entre requests.
Dos requests simultáneas de tenants distintos pueden cruzar datos.

**Fix incremental:** Crear `createTenantClient(tenantId)` que retorne client nuevo
por request. Migrar callers gradualmente sin romper lo existente.

---

## 📁 Archivos — Resumen

### Nuevos (14 archivos)

| Archivo | Fase |
|---------|------|
| `lib/platform/auth.ts` | 1 |
| `app/super-admin/page.tsx` | 4 |
| `app/super-admin/tenants/[id]/page.tsx` | 2 |
| `app/api/super-admin/tenants/[id]/route.ts` | 2 |
| `app/super-admin/agents/page.tsx` | 3 |
| `app/super-admin/agents/[slug]/page.tsx` | 3 |
| `app/api/super-admin/agents/route.ts` | 3 |
| `app/api/super-admin/agents/[slug]/route.ts` | 3 |
| `app/api/super-admin/agents/[slug]/sync/route.ts` | 3 |
| `components/super-admin/TenantTable.tsx` | 2 |
| `components/super-admin/TenantDetail.tsx` | 2 |
| `components/super-admin/MasterAgentList.tsx` | 3 |
| `components/super-admin/MasterAgentEditor.tsx` | 3 |
| `scripts/migrate-encryption.ts` | 5 |

### Modificados (6 archivos)

| Archivo | Fase | Cambio |
|---------|------|--------|
| `app/super-admin/layout.tsx` | 1 | Usar `requirePlatformAdmin()` |
| `app/super-admin/tenants/page.tsx` | 2 | Tabla mejorada, limpiar logs |
| `app/api/super-admin/tenants/route.ts` | 2 | Query con métricas, limpiar logs |
| `lib/tenants/service.ts` | 2 | Agregar slug, selectedAgents a createTenant |
| `lib/agents/service.ts` | 3 | Agregar CRUD de master agents |
| `lib/crypto.ts` | 5 | AES-256-GCM real |

---

## ⏱️ Timeline

| Fase | Qué | Esfuerzo |
|------|-----|----------|
| **1** | Fundaciones (helper auth, cleanup, fix slug) | Medio día |
| **2** | Tenants (tabla mejorada, detail view, crear mejorado) | 2-3 días |
| **3** | Master Agents CRUD (lista, editor, sync) | 2-3 días |
| **4** | Overview dashboard mínimo | Medio día |
| **5** | Seguridad (crypto real, singleton fix) | 1 día |

**Total: ~6-7 días**

---

## ❌ Explícitamente FUERA de scope (post-PMF)

- Stripe / billing / checkout
- Planes y subscriptions en DB
- Gráficos y charts
- Self-service signup
- RBAC granular (is_admin alcanza)
- Audit logs
- Feature flags por tenant
- Sistema de invitaciones por email
- Analytics cross-tenant fancy

---

*Plan actualizado: 2026-02-08*
*Proyecto: tuqui*
