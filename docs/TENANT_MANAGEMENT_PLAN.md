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

### 2.4 — Gestión de usuarios (password + delete)

Desde el tenant detail, el super-admin puede:

**Cambiar password de un usuario:**
- Botón 🔑 en cada fila de usuario
- Modal con campo "nueva password" (sin pedir la actual, es super-admin)
- API: `PATCH /api/super-admin/tenants/[id]/users/[userId]`
- Backend: `supabaseAdmin().auth.admin.updateUserById(authUserId, { password })`
- Requiere `auth_user_id` en `public.users` (se completa en session callback)

**Eliminar usuario:**
- Botón 🗑️ en cada fila (no se puede eliminar al último admin)
- Confirmación: "¿Eliminar a user@email.com?"
- API: `DELETE /api/super-admin/tenants/[id]/users/[userId]`
- Backend: Delete de `public.users` + `supabaseAdmin().auth.admin.deleteUser(authUserId)`

**Eliminar tenant:**
- Botón "Eliminar tenant" al final del detail (rojo, con doble confirmación)
- Cascade: borra users, agents, conversations, usage_stats, integrations
- API: `DELETE /api/super-admin/tenants/[id]`
- Opción: soft-delete (marcar `is_active = false` + `deleted_at`) vs hard-delete
- **Recomendación:** soft-delete primero, hard-delete manual vía SQL si hace falta

**Archivos:**

| Archivo | Cambio |
|---------|--------|
| `app/api/super-admin/tenants/[id]/users/[userId]/route.ts` | NUEVO — PATCH password, DELETE user |
| `app/super-admin/tenants/[id]/page.tsx` | Agregar botones de acción por usuario + delete tenant |

### 2.5 — Tenant detail view

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

## Fase 3 — Master Agents CRUD + Documentos RAG (3-4 días) ⭐

> **Esta es la fase más importante.** Poder editar prompts Y gestionar documentos
> RAG por master agent sin deploy cambia completamente la velocidad de iteración.

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
│ ┌──────────────────────────────────────────────┐   │
│ │ ⚖️ Abogado                         v1  ✅    │   │
│ │ Asistente legal con base de conocimiento     │   │
│ │ Tools: knowledge_base  📄 3 docs  4/4 tenants│   │
│ └──────────────────────────────────────────────┘   │
│ ...                                                │
└────────────────────────────────────────────────────┘
```

**Datos por agent:**
- Nombre, descripción, icon, version
- Tools asignados
- Count de documentos RAG vinculados (📄)
- Count de tenants que lo tienen activo vs total
- `is_published` (✅ / borrador)

### 3.2 — Editor de master agent (con documentos)

**Ruta:** `/super-admin/agents/[slug]`

Server Component con Server Actions.

```
┌────────────────────────────────────────────────────┐
│ ← Master Agents                                   │
│                                                    │
│ Abogado                                   v2       │
│                                                    │
│ ─── Configuración ───────────────────────────────  │
│ Nombre:      [Abogado                   ]          │
│ Descripción: [Asistente legal...        ]          │
│ Slug:        abogado (read-only)                   │
│ Publicado:   [✅]                                  │
│                                                    │
│ ─── System Prompt ───────────────────────────────  │
│ ┌────────────────────────────────────────────┐     │
│ │ Sos un asistente legal especializado.      │     │
│ │ Usá la base de conocimiento para responder │     │
│ │ sobre leyes, regulaciones y procedimientos.│     │
│ │ ...                                        │     │
│ └────────────────────────────────────────────┘     │
│                                                    │
│ ─── Tools ───────────────────────────────────────  │
│ ☑ knowledge_base — Base de conocimiento (RAG)     │
│ ☑ web_search — Búsqueda web con Tavily            │
│ ☐ odoo_intelligent_query — Queries a Odoo ERP     │
│                                                    │
│ ─── Documentos RAG (3) ─────────────────────────  │
│ ┌────────────────────────────────────────────┐     │
│ │ 📄 Ley de Sociedades Comerciales           │     │
│ │    PDF · 45 chunks · subido 2026-01-15     │     │
│ │                                     [🗑️]   │     │
│ ├────────────────────────────────────────────┤     │
│ │ 📄 Código Civil y Comercial (extracto)     │     │
│ │    PDF · 120 chunks · subido 2026-01-15    │     │
│ │                                     [🗑️]   │     │
│ ├────────────────────────────────────────────┤     │
│ │ 📄 Régimen de Monotributo 2026             │     │
│ │    PDF · 28 chunks · subido 2026-02-01     │     │
│ │                                     [🗑️]   │     │
│ └────────────────────────────────────────────┘     │
│                                                    │
│ [📎 Subir documento]                               │
│                                                    │
│ ─── Mensajes ────────────────────────────────────  │
│ Welcome:     [¡Hola! Soy tu asistente... ]         │
│ Placeholder: [Preguntame sobre leyes...  ]         │
│                                                    │
│ [💾 Guardar]  [🔄 Sync a todos los tenants]       │
│                                                    │
│ ─── Tenants usando este agent ───────────────────  │
│ Adhoc SA       ✅ activo  v2 synced    📄 3 docs   │
│ Cliente Demo   ✅ activo  v1 ⚠️ desact. 📄 3 docs  │
│ Test Corp      ❌ inactivo                         │
└────────────────────────────────────────────────────┘
```

### 3.3 — Documentos RAG centralizados en master agents

**Concepto:** Los documentos se gestionan a nivel de master agent. Los embeddings
existen **una sola vez** en tablas `master_*`. Al buscar, `match_documents` consulta
ambas fuentes (docs del tenant + docs del master) sin copiar nada.

**Tablas nuevas:**

```sql
-- Documentos a nivel plataforma (sin tenant_id)
CREATE TABLE master_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_type TEXT DEFAULT 'file',     -- 'file', 'manual', 'url'
    file_name TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chunks con embeddings (sin tenant_id) — ÚNICA copia de los vectores
CREATE TABLE master_document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES master_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(768),
    chunk_index INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_master_doc_chunks_embedding
    ON master_document_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- M2M: qué documentos tiene cada master agent
CREATE TABLE master_agent_documents (
    master_agent_id UUID NOT NULL REFERENCES master_agents(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES master_documents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (master_agent_id, document_id)
);
```

> **Nota:** Ya existía un placeholder comentado en migration 109 con esta estructura.
> Ahora lo implementamos de verdad.

**¿Por qué NO copiar embeddings a cada tenant?**
- Sin duplicación: 1 PDF = 1 set de embeddings, no importa cuántos tenants
- Sin sync de documentos: vincular doc al master → automáticamente visible en todos los tenants
- Sin metadata de tracking, sin comparar versiones, sin re-copiar
- Cada tenant TAMBIÉN puede tener docs propios adicionales en `document_chunks` (como hoy)

### 3.4 — Upload de documentos en super-admin

**Reusar** el mismo pipeline que ya existe en `app/admin/rag/actions.ts`:
- `getUploadSignedUrl()` → upload a Supabase Storage
- `processDocumentFromStorage()` → extract text → chunk → embed

La diferencia: en vez de insertar en `documents` + `document_chunks` (con tenant_id),
insertar en `master_documents` + `master_document_chunks` (sin tenant_id).

**Archivos nuevos:**
- `app/api/super-admin/agents/[slug]/documents/route.ts` → GET list, POST upload
- `app/api/super-admin/agents/[slug]/documents/[docId]/route.ts` → DELETE
- `lib/rag/master-documents.ts` → procesamiento + sync a tenants

**Server Actions para el editor:**

```typescript
async function uploadMasterDocument(formData: FormData) {
  'use server'
  const slug = formData.get('agent_slug') as string
  const file = formData.get('file') as File

  // 1. Procesar archivo (extract text → chunk → embed)
  const doc = await processMasterDocument(file)

  // 2. Insertar en master_documents + master_document_chunks
  const { data } = await db.from('master_documents').insert({
    title: file.name,
    content: doc.fullText,
    file_name: file.name,
    source_type: 'file',
  }).select().single()

  // 3. Insertar chunks con embeddings
  await db.from('master_document_chunks').insert(
    doc.chunks.map((chunk, i) => ({
      document_id: data.id,
      content: chunk.text,
      embedding: chunk.embedding,
      chunk_index: i,
    }))
  )

  // 4. Vincular al master agent
  const agent = await db.from('master_agents').select('id').eq('slug', slug).single()
  await db.from('master_agent_documents').insert({
    master_agent_id: agent.data.id,
    document_id: data.id,
  })

  revalidatePath(`/super-admin/agents/${slug}`)
}

async function deleteMasterDocument(docId: string, slug: string) {
  'use server'
  // Cascade borra chunks y links automáticamente
  await db.from('master_documents').delete().eq('id', docId)
  revalidatePath(`/super-admin/agents/${slug}`)
}
```

### 3.5 — Fix match_documents (buscar en ambas tablas)

**Problema actual:** `match_documents` referencia `rag_enabled` que ya no existe
en la tabla `agents`. Además, no busca en documentos centralizados.

**Fix:** Reescribir para buscar en docs del tenant + docs del master agent (UNION).
Sin copiar embeddings. Sin sync.

```sql
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(768),
    match_agent_id UUID,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 5
)
RETURNS TABLE (id UUID, content TEXT, similarity FLOAT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant context not set';
    END IF;

    RETURN QUERY

    -- 1. Docs propios del tenant (como hoy)
    SELECT dc.id, dc.content,
           1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.tenant_id = v_tenant_id
      AND 1 - (dc.embedding <=> query_embedding) > match_threshold
      AND (
          d.is_global = true
          OR d.agent_id = match_agent_id
          OR EXISTS (
              SELECT 1 FROM agent_documents ad
              WHERE ad.agent_id = match_agent_id
                AND ad.document_id = d.id
                AND ad.tenant_id = v_tenant_id
          )
      )

    UNION ALL

    -- 2. Docs centralizados del master agent (sin copiar, query directo)
    SELECT mdc.id, mdc.content,
           1 - (mdc.embedding <=> query_embedding) AS similarity
    FROM master_document_chunks mdc
    JOIN master_agent_documents mad ON mad.document_id = mdc.document_id
    JOIN agents a ON a.master_agent_id = mad.master_agent_id
    WHERE a.id = match_agent_id
      AND a.tenant_id = v_tenant_id
      AND 1 - (mdc.embedding <=> query_embedding) > match_threshold

    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
```

**Clave:** El UNION ALL busca en ambas tablas y retorna los mejores resultados
combinados. Los embeddings centrales se leen pero nunca se copian.

**Resultado:**
- Subís un PDF al master agent → automáticamente disponible para TODOS los tenants
- El tenant puede tener docs propios adicionales → se mezclan en los resultados
- Cero sync, cero duplicación, cero mantenimiento

### 3.6 — Editor de prompts (Server Actions)

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
  // Solo sync de config — los docs centrales NO necesitan sync
  await db.rpc('sync_agents_from_masters')
  revalidatePath(`/super-admin/agents/${slug}`)
}
```

**Flujo completo:**

```
1. Editás el prompt en el textarea
2. Subís documentos RAG desde el mismo editor (drag & drop)
3. Click "Guardar" → actualiza master_agents + incrementa version
4. Los documentos están disponibles INMEDIATAMENTE (sin sync)
5. Click "Sync a todos" → solo propaga cambios de config (prompt, tools, etc.)
```

> Los tenants con `custom_instructions` mantienen sus instrucciones —
> el sync solo actualiza el `system_prompt` base, no pisa las customizaciones.
> Los tenants pueden tener documentos propios ADICIONALES subidos desde su admin.

### 3.7 — Crear nuevo master agent

Modal simple con:
- Nombre → auto-genera slug
- Descripción
- System prompt (textarea)
- Tools (checkboxes, `knowledge_base` incluido)

Al crear, queda en `is_published = false` (borrador) hasta que lo publiques.
Los documentos se suben después desde el editor del agente.
Publicar + Sync lo propaga a todos los tenants.

### 3.8 — Funciones nuevas en agent service

Agregar a `lib/agents/service.ts`:

```typescript
export async function updateMasterAgent(slug: string, updates: Partial<MasterAgent>)
export async function createMasterAgent(data: CreateMasterAgentInput)
export async function getMasterAgentWithTenants(slug: string)
export async function syncMasterToTenants(slug?: string)  // slug opcional = sync all
```

Agregar `lib/rag/master-documents.ts`:

```typescript
export async function uploadMasterDocument(agentSlug: string, file: File)
export async function deleteMasterDocument(docId: string)
export async function getMasterDocuments(agentSlug: string)
// NO hay syncMasterDocuments — los docs se leen directo desde match_documents
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

## Fase 6 — Token Limits desde Super-Admin (1 día)

> Hoy los límites están hardcodeados en `lib/billing/limits.ts`.
> Objetivo: que el super-admin pueda configurar límites por tenant sin tocar código.

### 6.1 — DB para límites

**Columnas nuevas en `tenants`:**

```sql
ALTER TABLE tenants ADD COLUMN tokens_per_user_limit BIGINT DEFAULT 500000;
ALTER TABLE tenants ADD COLUMN plan_name TEXT DEFAULT 'pro';
```

**Tabla de overrides por usuario (opcional):**

```sql
CREATE TABLE token_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    tokens_limit BIGINT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, user_email)
);
```

### 6.2 — Reescribir checkUsageLimit

```typescript
// lib/billing/limits.ts
export async function getTenantLimit(tenantId: string, userEmail: string) {
    const db = getClient()
    
    // Check override first
    const { data: override } = await db
        .from('token_overrides')
        .select('tokens_limit')
        .eq('tenant_id', tenantId)
        .eq('user_email', userEmail)
        .limit(1)
    
    if (override?.[0]) return override[0].tokens_limit
    
    // Fall back to tenant default
    const { data: tenant } = await db
        .from('tenants')
        .select('tokens_per_user_limit')
        .eq('id', tenantId)
        .single()
    
    return tenant?.tokens_per_user_limit || 500000
}
```

### 6.3 — UI en tenant detail

En la sección de tenant detail, agregar:

```
─── Límites ──────────────────────────────
Plan: [pro ▾]
Tokens/usuario/mes: [500,000    ] [Guardar]

Overrides:
  gr@adhoc.inc    → 1,000,000 tokens  [✏️] [🗑️]
  [+ Agregar override]
```

**Archivos:**

| Archivo | Cambio |
|---------|--------|
| `lib/billing/limits.ts` | Reescribir para leer de DB |
| `app/super-admin/tenants/[id]/page.tsx` | Agregar sección de límites |
| `app/api/super-admin/tenants/[id]/route.ts` | PATCH para tokens_per_user_limit |

---

## 📁 Archivos — Resumen

### Nuevos (17 archivos)

| Archivo | Fase |
|---------|------|
| `lib/platform/auth.ts` | 1 |
| `app/super-admin/page.tsx` | 4 |
| `app/super-admin/tenants/[id]/page.tsx` | 2 |
| `app/api/super-admin/tenants/[id]/route.ts` | 2 |
| `app/super-admin/agents/page.tsx` | 3 |
| `app/super-admin/agents/[slug]/page.tsx` | 3 |
| `app/api/super-admin/tenants/[id]/users/[userId]/route.ts` | 2 |
| `app/api/super-admin/agents/route.ts` | 3 |
| `app/api/super-admin/agents/[slug]/route.ts` | 3 |
| `app/api/super-admin/agents/[slug]/sync/route.ts` | 3 |
| `app/api/super-admin/agents/[slug]/documents/route.ts` | 3 |
| `app/api/super-admin/agents/[slug]/documents/[docId]/route.ts` | 3 |
| `lib/rag/master-documents.ts` | 3 |
| `components/super-admin/TenantTable.tsx` | 2 |
| `components/super-admin/TenantDetail.tsx` | 2 |
| `components/super-admin/MasterAgentList.tsx` | 3 |
| `components/super-admin/MasterAgentEditor.tsx` | 3 |
| `scripts/migrate-encryption.ts` | 5 |

### Migraciones SQL nuevas

| Archivo | Fase |
|---------|------|
| `supabase/migrations/XXX_master_documents.sql` | 3 |
| `supabase/migrations/XXX_fix_match_documents.sql` | 3 |

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
| **2** | Tenants (tabla, detail, crear, password, delete) | 3-4 días |
| **3** | Master Agents CRUD + Documentos RAG centralizados | 3-4 días |
| **4** | Overview dashboard mínimo | Medio día |
| **5** | Seguridad (crypto real, singleton fix) | 1 día |
| **6** | Token limits desde super-admin | 1 día |

**Total: ~9-11 días**

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
