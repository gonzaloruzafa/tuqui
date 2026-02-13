# 🧠 TUQUI REFACTOR v4 — ROAD TO PMF

> **Filosofía:** Llegar a PMF primero, infraestructura enterprise después  
> **Principio:** Usuarios pagando > Features perfectas  
> **Para:** Un founder que necesita validar antes de escalar  
> **Última actualización:** 2026-02-12

---

## 📍 ESTADO ACTUAL

| Campo | Valor |
|-------|-------|
| Fases completadas | F0-F4 (Orquestador, Context, Skills, Memory) |
| Branch | `feat/memory` (PR #11) |
| Unit tests | ~337 passing (~1.5s) |
| Eval baseline | 98.5% (66/67) |
| Eval cases | 75 (67 originales + 8 quality) |
| Skills Odoo | 36 |
| Memory Skills | 2 (recall_memory, save_memory) |
| Docs en RAG | ⚠️ 0 (crítico) |
| Master Agents UI | ❌ Solo via SQL |
| Clientes pagando | 0 |
| Pilotos activos | Cedent (demo), Active Learning (pendiente) |
| Tenant Isolation | ✅ Fix dd4b223 (23 archivos, ~45 queries) |

### El problema

```
Skills Odoo:      ████████████████████████████████████ 36
Docs RAG:         ⬜ 0
Master Agents UI: ⬜ No existe
Clientes:         ⬜ 0
```

Tenés la infraestructura de skills pero no:
- Contenido en el RAG (los agentes `contador` y `abogado` no saben nada)
- UI para gestionar master agents y docs sin deploy
- Validación de pago

---

## 🏗️ DECISIONES DE ARQUITECTURA

### ¿Por qué agentes especializados y no un solo agente?

- **Prompts especializados:** El `contador` siempre advierte "consultá con tu contador". El `odoo` sabe defaults de períodos.
- **Tools acotados:** Un agente con 50 tools confunde al LLM. Mejor 5 agentes con ~10 tools.
- **Escalabilidad:** Nuevo agente = INSERT en DB, no refactor de prompt.

### ¿Por qué orquestador LLM y no keywords?

- **Antes:** ~400 líneas de keywords hardcodeados. "guita" no matcheaba → agente equivocado.
- **Ahora:** ~155 líneas. Lee descripciones de DB. Entiende semántica.
- **Resultado:** 98.5% accuracy en evals.

### ¿Por qué memory como tool y no siempre inyectado?

- **Company context** (~200 tokens) → Siempre inyectado. No cambia.
- **Memorias** (variable) → Tool. El agente decide cuándo buscar.
- **Razón:** No gastar tokens en memoria irrelevante el 90% del tiempo.

### ¿Por qué descripciones ricas > prompts enormes?

```
❌ System prompt de 3000 tokens con "si X usá Y"
✅ System prompt de 500 tokens + tool.description con USAR CUANDO/NO USAR/RETORNA
```

El LLM es inteligente. Dale buenas descripciones y él decide.

---

## 🎯 ROADMAP (Enfocado en PMF)

### Resumen

| Fase | Tiempo | Descripción | Impacto en PMF |
|------|--------|-------------|----------------|
| F7 | 2-3 días | Master Agents + RAG Centralizado | ⭐⭐⭐⭐ Diferenciación |
| F5 | 1.5 días | PWA + Push Notifications | ⭐⭐⭐ Engagement diario |
| F6 | 1 día | Briefings Matutinos | ⭐⭐⭐ Hábito de uso |
| F8 | 0.5 días | Piloto Cedent | ⭐⭐⭐ Validación real |
| F9 | — | Cobrar ($50-100/mes) | ⭐⭐⭐⭐⭐ PMF signal |
| FX | 5 min | Optimizar modelo Gemini → bajar costos ~70% | ⭐⭐ Margen |

**Total: ~5-6 días de código + validación continua**

### Orden de ejecución

```
F7 → F5 → F6 → F8 → F9
```

**¿Por qué F7 primero?** El valor de Tuqui es que SABE cosas. Hoy los agentes `contador` y `abogado` tienen 0 docs en RAG. Si mandás push sin contenido, el usuario se decepciona. Primero contenido, después engagement.

### Lo que se POSPONE (post-PMF)

| Fase original | Por qué se pospone |
|---------------|---------------------|
| User Credentials (F5 viejo) | Overkill para 3 usuarios por tenant |
| Super Admin UI completa (tenants) | Podés hacer CRUD via SQL |
| Token limits desde UI | Nadie está en el límite |
| Seguridad enterprise (AES-256) | No tenés datos sensibles todavía |
| RLS en `company_contexts` | ⚠️ Tabla pública sin RLS. Activar RLS + política `service_role only`. **No tocar antes de demo** — rompe si no tiene la policy correcta |
| Cleanup secrets en código | `lib/crypto.ts` tiene fallback secret hardcodeado + `encrypt()` es solo base64. `scripts/apply-migration.ts` tiene Supabase URL hardcodeada. `.env` files OK (nunca se commitearon). Odoo key ya fixeada en `a799a45`. |

---

## ✅ COMPLETADO (F0-F4)

### F0: Tests Baseline

| Métrica | Valor |
|---------|-------|
| Pass Rate inicial | 73.2% (52/67) → 98.5% después de mejoras |
| Tests totales | 67 casos + 1 threshold |
| Threshold CI | 80% |
| Delay entre tests | 25s (mitigación rate limits Gemini) |

**Lecciones:** Gemini tiene rate limits agresivos en plan gratuito. Los tests sirven como documentación de qué debe funcionar.

### F1: Orquestador LLM

Reemplazó ~400 líneas de keywords por ~155 líneas LLM.

```
a6559d0 - feat(F1): LLM orchestrator replaces keyword router
         13 files changed, 352 insertions(+), 126 deletions(-)
```

| Archivo | Cambio |
|---------|--------|
| `lib/agents/orchestrator.ts` | Nuevo (~155 líneas) |
| `lib/chat/engine.ts` | Usa `orchestrate()` |
| `lib/agents/router.ts` | Renombrado a `.deprecated.ts` |

**Cómo funciona:** Obtiene agentes activos → construye prompt "Clasificá entre estos" → Gemini retorna slug.

### F2: Company Context

Company context se inyecta universalmente. UI en `/admin/company`.

| Componente | Implementación |
|------------|---------------|
| Tabla | `company_contexts` — JSONB estructurado (key_products, key_customers, business_rules) |
| Inyector | `lib/company/context-injector.ts` (~30 líneas) |
| UI | `/admin/company` con campos editables + preview |

**¿Por qué JSONB y no texto libre?** Estructurado = editable en UI, validable, no depende de redacción.

### F3: Skills & Inteligencia (6 sub-fases)

| Sub-fase | Qué | Resultado |
|----------|-----|-----------|
| F3.1 | Rich Skill Descriptions | 32 skills con template USAR CUANDO/NO USAR/RETORNA |
| F3.2 | Categorías de Producto | `get_sales_by_category` + `categoryName` en 5 outputs |
| F3.3 | Progressive Improvement Loop | Loop L1→L5, 98.5% pass rate |
| F3.4 | Deprecar V1 | `native-gemini.ts` eliminado → `llm-engine.ts` |
| F3.5 | RAG Cleanup | `rag_enabled` eliminado, RAG es tool puro |
| F3.6 | Quality Evals | `insightScore` en auditor, 8 test cases quality |

| Métrica | Inicio F3 | Final F3 |
|---------|-----------|----------|
| Unit tests | 272 | 310 |
| Eval cases | 69 | 75 |
| Skills Odoo | 35 | 36 |
| Baseline L1→L5 | N/A | 98.5% |

**PRs mergeados:** #2 (RAG), #3 (Orchestrator), #4 (Accounting), #5-#9 (pipeline/skills), #10 (Phase 3)

### F4: Memory + Tenant Isolation

**PR #11** en `feat/memory`. Verificado en producción.

| Componente | Archivo |
|------------|---------|
| Migration memories | `supabase/migrations/203_memories.sql` |
| Migration tool | `supabase/migrations/204_add_memory_tool.sql` |
| Migration dedup | `supabase/migrations/205_fix_duplicate_agents.sql` |
| Memory skills | `lib/skills/memory/` (index, recall, save, tools) |
| Friendly errors | `lib/errors/friendly-messages.ts` |
| Streaming fix | `app/api/chat/route.ts` |
| Admin UI | `components/admin/ToolsForm.tsx` (iconos reales, knowledge_base) |

**Commits:**

```
dd4b223 fix: add tenant_id filtering to all cross-tenant unsafe queries
3047de0 fix: send friendly error message on token limit in streaming
f48d660 fix: memory save_memory used email instead of auth UUID
c60a5d9 feat: real icons in admin tools UI + knowledge_base in catalog
d975e90 feat: add delete agent functionality for custom agents
1c2bd6d fix: replace whatsapp with memory in tools catalog
4b2adb8 fix: prevent duplicate agents per tenant (UNIQUE constraint)
0e14977 feat: add memory tool to admin UI
2ff102e feat: add memory tool with recall and save skills
```

**Bugs resueltos:**

| Bug | Causa raíz | Fix |
|-----|-----------|-----|
| UUID syntax error en save_memory | email como userId | Separar userEmail/userId |
| Token limit "API Error" genérico | `controller.error()` sin mensaje | `getFriendlyError()` + texto amigable |
| Agentes duplicados | Sin filtro tenant_id | `.eq('tenant_id')` + UNIQUE |
| Cross-tenant data leak | ~45 queries sin tenant_id | Fix masivo en 23 archivos |

**Tenant Isolation Fix (dd4b223):**

| Área | Archivos |
|------|----------|
| Credenciales Odoo/Twilio | 4 |
| Documentos RAG | 4 |
| Agentes | 2 |
| Chat/Mensajes | 2 |
| Prometeo tasks | 4 |
| Notificaciones | 4 |
| Billing/Push | 3 |

**Verificación en producción:**

```
✅ save_memory: "recordá que Juan Pérez siempre pide descuento del 10%" → guardado
✅ recall_memory: "Qué sabés de Juan Pérez?" → responde con contexto
✅ Token limit: muestra "⚠️ Límite mensual de tokens alcanzado"
✅ Tenant isolation: .eq('tenant_id') en 23 archivos
```

---

## 🔜 FASE 7: MASTER AGENTS + RAG CENTRALIZADO (~2-3 días) ⭐ PRIMERA

> **Objetivo:** Gestionar master agents y docs RAG sin deploy, docs compartidos entre todos los tenants  
> **Por qué primera:** Sin contenido en RAG, los agentes `contador` y `abogado` son inútiles  
> **Spec técnica:** Ver `TUQUI_REFACTOR_SPECS.md` § F7  
> **Ejecución:** 3 sesiones (~2-3h cada una)

### Checklist

**Sesión 1: DB + Core Lib**
- [ ] Migration `208_master_documents.sql` (tablas master_documents, master_document_chunks, master_agent_documents)
- [ ] Migration `209_fix_match_documents.sql` (UNION query tenant + master docs + cleanup `rag_enabled`)
- [ ] `lib/rag/master-documents.ts` (procesador: chunking + embeddings + insert)
- [ ] `tests/unit/master-documents.test.ts`

**Sesión 2: Super Admin UI**
- [ ] `/super-admin/agents` (lista master agents — server component)
- [ ] `/super-admin/agents/[slug]` (editor con server actions: save, sync, delete doc)
- [ ] `components/super-admin/MasterAgentEditor.tsx` (formulario: prompt, tools, docs)
- [ ] `components/super-admin/MasterDocUpload.tsx` (reutiliza bucket `rag-documents`, path `master/{slug}/{file}`)
- [ ] `app/api/super-admin/agents/[slug]/documents/route.ts` (POST process + DELETE)

**Sesión 3: PDFs + @mention + Agent Attribution**
- [ ] Subir PDFs: Ley IVA, LCT (secciones clave) → vincular a `contador`/`abogado`
- [ ] **@mention agents:** `lib/chat/parse-mention.ts` + skip orchestrator + autocomplete (~80 líneas, 4 archivos)
- [ ] **Agent attribution:** inyectar agente en ThinkingStep + UI en ExecutionProgress/ToolBadge (~40 líneas, 5 archivos)
- [ ] `tests/unit/parse-mention.test.ts`
- [ ] Corrida de evals completa (target ≥85%)

### Dependencias entre sesiones

```
S1.1 (mig 208) ─┐
                 ├→ S1.3 (master-documents.ts) → S2.4 (DocUpload) → S3.1 (PDFs)
S1.2 (mig 209) ─┘                                S2.5 (API route) ─┘

S2.1 (agents list) → S2.2 (agent editor) → S2.3 (MasterAgentEditor)
                                                  └→ S2.4 (DocUpload)

S3.2 (@mention): independiente — no depende de S1/S2
S3.3 (attribution): independiente — no depende de S1/S2
```

---

### Sesión 1: DB + Core Lib (~2-3h)

#### 1.1 — Migration `208_master_documents.sql`

3 tablas nuevas (schema en `TUQUI_REFACTOR_SPECS.md` §7.1):

| Tabla | Propósito |
|-------|-----------|
| `master_documents` | Docs a nivel plataforma (sin tenant_id): title, content, source_type, file_name, metadata |
| `master_document_chunks` | Chunks con embeddings `vector(768)`, sin tenant_id — única copia de vectores |
| `master_agent_documents` | M2M: qué docs tiene cada master agent (PK: master_agent_id + document_id) |

**Sin IVFFlat index** — pocos vectores al inicio. Se agrega cuando haya >1000 chunks.

#### 1.2 — Migration `209_fix_match_documents.sql`

Reescritura completa de `match_documents()` (schema en `TUQUI_REFACTOR_SPECS.md` §7.2):

| Fix | Detalle |
|-----|---------|
| Eliminar check `rag_enabled` | Columna dropeada en mig 202. La función actual falla silenciosamente |
| UNION tenant + master docs | Busca en `document_chunks` (tenant) + `master_document_chunks` (platform) |
| Fix `agent_documents` join | Agregar `ad.tenant_id = v_tenant_id` al join (faltaba filtro tenant) |
| Fix `sync_agents_from_masters()` | Todavía referencia `rag_enabled` (mig 104) — nueva versión sin esa columna |
| Cleanup agent editor | `app/admin/agents/[slug]/page.tsx` L83 escribe `rag_enabled` en update — eliminar |

**Bugs conocidos que se fixean:**
- `match_documents` checkea `a.rag_enabled` → **RAG silenciosamente roto** desde mig 202
- `sync_agents_from_masters` copia `rag_enabled` → **sync falla** si se corre
- Agent editor escribe `rag_enabled: ragEnabled` → **error silencioso** en save

#### 1.3 — `lib/rag/master-documents.ts` (~80 líneas)

Reutiliza infra existente:
- `chunkDocument()` de `lib/rag/chunker.ts` (1000 chars, 200 overlap)
- `generateEmbeddings()` de `lib/rag/embeddings.ts` (gemini-embedding-001, batch 100, retry 5)

| Función | Descripción |
|---------|-----------|
| `processMasterDocument({ title, content, sourceType, fileName })` | Chunk + embed + insert a `master_documents` + `master_document_chunks` |
| `linkDocumentToAgent(documentId, masterAgentId)` | Insert en `master_agent_documents` |
| `deleteMasterDocument(documentId)` | Cascade borra chunks y links |
| `getMasterDocumentsForAgent(masterAgentId)` | Lista docs vinculados |

#### 1.4 — Tests

```typescript
// tests/unit/master-documents.test.ts (mock chunker + embeddings)
- processMasterDocument: chunking correcto con overlap
- processMasterDocument: inserta doc + chunks en tablas master_*
- processMasterDocument: genera embeddings para cada chunk
- linkDocumentToAgent: crea relación M2M
- deleteMasterDocument: cascade limpia todo
```

---

### Sesión 2: Super Admin UI (~3h)

#### 2.1 — `/super-admin/agents/page.tsx` (~100 líneas)

Server component. Patrón: igual a `app/super-admin/tenants/page.tsx` existente.

| Dato | Fuente |
|------|---------|
| Nombre + descripción | `master_agents` |
| Count de tools | `master_agents.tools[]` |
| Count de docs | `master_agent_documents(count)` |
| Count de tenants | `agents(count)` donde `master_agent_id = X` |
| Estado | `is_published` → badge verde/amarillo |
| Versión | `version` |

Link a `/super-admin/agents/[slug]`.

#### 2.2 — `/super-admin/agents/[slug]/page.tsx` (~120 líneas)

Server component con 3 server actions:

| Action | Qué hace |
|--------|----------|
| `saveAgent(formData)` | Update `master_agents` + bump `version` |
| `syncToTenants(formData)` | Llama `sync_agents_from_masters` (fixeado en S1) |
| `deleteDocument(formData)` | Cascade delete via `deleteMasterDocument()` |

Renderiza `MasterAgentEditor` (client component).

#### 2.3 — `components/super-admin/MasterAgentEditor.tsx` (~150 líneas)

Client component con formulario:
- name, description, system_prompt (textarea grande)
- tools (checkboxes: web_search, odoo, knowledge_base, memory)
- welcome_message, placeholder_text
- is_published toggle
- Lista de docs vinculados con botón eliminar
- Botón "Sync a todos los tenants" con confirmación
- Info: cuántos tenants tienen este agente

#### 2.4 — `components/super-admin/MasterDocUpload.tsx` (~80 líneas)

Reutiliza patrón de `components/admin/RAGUpload.tsx` pero para master docs:
- Mismo bucket `rag-documents`, path: `master/{agentSlug}/{fileName}`
- Acepta PDF, TXT, MD (mismos que el bucket permite: 50MB max)
- Progress bar upload + processing
- Al completar → server action procesa con `processMasterDocument()` + vincula al agente

#### 2.5 — `app/api/super-admin/agents/[slug]/documents/route.ts` (~60 líneas)

| Method | Acción |
|--------|---------|
| POST | Recibe `{ storagePath, fileName, fileType }`, procesa con `processMasterDocument()`, vincula con `linkDocumentToAgent()` |
| DELETE | Recibe `{ documentId }`, llama `deleteMasterDocument()` |

Auth: `requirePlatformAdmin()` en ambos.

---

### Sesión 3: PDFs + @mention + Agent Attribution (~2-3h)

#### 3.1 — Subir PDFs de prueba

| Documento | Master Agent | Contenido esperado |
|-----------|-------------|--------------------|
| Ley de IVA (extracto) | `contador` | Alícuotas, exenciones, base imponible |
| LCT (secciones clave) | `abogado` | Vacaciones, indemnización, jornada laboral |

Verificar que `match_documents` retorna resultados del master doc (test manual).

#### 3.2 — @mention agents (4 archivos, ~80 líneas)

| Archivo | Detalle |
|---------|----------|
| `lib/chat/parse-mention.ts` | **NUEVO** ~20 líneas. `parseMention(message, availableSlugs)` → `{ agent: string\|null, cleanMessage: string }`. Regex `/^@(\w+)\s+/`. Valida contra slugs. Si no matchea → null + mensaje original |
| `app/api/chat/route.ts` | Destructurar `mentionedAgent` del body, pasar a `processChatRequest()` |
| `lib/chat/engine.ts` | Agregar `mentionedAgent?: string` a `ChatEngineParams`. Si presente: skip `orchestrate()`, cargar agente directo con `getAgentBySlug(tenantId, mentionedAgent)`. ~8 líneas de if/else |
| `components/chat/ChatFooter.tsx` | Al detectar `@` al inicio o después de espacio: popover con slugs filtrados. Fetch slugs desde `/api/admin/agents` al montar. ~40 líneas JSX: div absolute, flechas + Enter |

**Autocomplete minimalista:**
```
Usuario tipea: @con
                ┌─────────────┐
                │ 📊 contador │  ← filtrado
                └─────────────┘
Enter → "@contador " se inserta

@contador cuánto debo de IVA?
→ API: { mentionedAgent: "contador", message: "cuánto debo de IVA?" }
→ Engine: skip orchestrator → agente contador directo
```

#### 3.3 — Agent attribution en tools (5 archivos, ~40 líneas)

| Archivo | Detalle |
|---------|----------|
| `lib/thinking/types.ts` | Agregar `agentSlug?: string`, `agentName?: string` opcionales a `ThinkingStep` |
| `lib/chat/engine.ts` | Después de seleccionar agente: wrap `onThinkingStep` para inyectar `slug`/`name` en cada step (~5 líneas) |
| `app/chat/[slug]/page.tsx` | Nuevo state `routedAgentName`. Extraer del primer `t:` event. Pasar a `ExecutionProgress` + capturar en `Message.agentName` |
| `components/chat/ExecutionProgress.tsx` | Layout: `⚡ Odoo Agent · [logo] Consultando ventas totales (1.2s)`. Fallback sin agentName |
| `components/chat/ToolBadge.tsx` | Agregar prop `agentName?`. Layout: `✓ vía Odoo Agent · [logo] Odoo ERP`. Fallback al badge actual |

**Cero breaking changes** — campos opcionales, mensajes históricos muestran badge como antes.

#### 3.4 — Tests finales

```typescript
// tests/unit/parse-mention.test.ts (table-driven)
- parseMention('@odoo cuánto vendimos?') → { agent: 'odoo', cleanMessage: 'cuánto vendimos?' }
- parseMention('cuánto vendimos?') → { agent: null, cleanMessage: 'cuánto vendimos?' }
- parseMention('@invalido hola') → { agent: null, cleanMessage: '@invalido hola' }
- parseMention('@contador qué dice la ley?') → { agent: 'contador', cleanMessage: 'qué dice la ley?' }

// tests/evals completa → target ≥85%
// Test manual: "¿Cuál es la alícuota de IVA?" → responde con cita de ley (RAG)
// Test manual: @odoo cuánto vendimos → skip orchestrator visible en ExecutionProgress
// Test manual: verificar ToolBadge muestra "✓ vía Odoo Agent · Odoo ERP"
```

### Infraestructura existente que se reutiliza

| Componente | Archivo | Qué aporta |
|------------|---------|------------|
| Chunker | `lib/rag/chunker.ts` | 1000 chars, 200 overlap, split párrafos/oraciones |
| Embeddings | `lib/rag/embeddings.ts` | `gemini-embedding-001`, 768 dims, batch 100, retry 5 |
| RAG search | `lib/rag/search.ts` | `searchDocuments()` → `match_documents` RPC |
| RAG tool | `lib/tools/definitions/rag-tool.ts` | `search_knowledge_base` con descripción rica |
| Upload flow | `app/admin/rag/actions.ts` + `components/admin/RAGUpload.tsx` | Signed URL → Storage → process |
| Storage bucket | `rag-documents` (mig 128) | Private, 50MB, PDF/TXT/MD/CSV/JSON |
| Platform auth | `lib/platform/auth.ts` | `isPlatformAdmin()` + `requirePlatformAdmin()` ✅ ya existe |
| Super admin layout | `app/super-admin/layout.tsx` | Gates con `requirePlatformAdmin()` ✅ ya existe |
| Tenants UI pattern | `app/super-admin/tenants/` | Lista + detail pages como referencia |
| Agent service | `lib/agents/service.ts` | `getAgentBySlug()`, `getMasterAgents()`, `syncAgentWithMaster()` |
| PDF parsing | `pdf-parse` + `pdfjs-dist` | Ya instalados en package.json |

### Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| `pdf-parse` pesado en serverless | Timeout en docs grandes | Chunks < 1000 chars, procesar async |
| IVFFlat index con pocos vectores | Performance pobre | Empezar sin index, agregar con >1000 chunks |
| Embeddings cost para docs grandes | $$ en API calls | Batch de 100 chunks (existente), cachear |
| `match_documents` checkea `rag_enabled` dropeado | RAG silenciosamente roto | **Fix en migration 209** |
| `sync_agents_from_masters` referencia `rag_enabled` | Sync falla | **Fix en migration 209** |
| Agent editor escribe `rag_enabled` en update | Error silencioso | **Cleanup en S1** |
| Duplicate migrations (120×2, 203×2) | Confusión en numeración | Documentado, no bloquea |

---

## 🔜 FASE 5: PWA + PUSH NOTIFICATIONS (~1.5 días) — SEGUNDA

> **Objetivo:** Tuqui en el teléfono del usuario, notificaciones nativas  
> **Spec técnica:** Ver `TUQUI_REFACTOR_SPECS.md` § F5

### El loop de engagement

```
1. 7:30 AM → Push: "🌅 Vendiste $850K ayer"
2. Usuario toca → Abre Tuqui (PWA, ya logueado)
3. Pregunta algo → Usa Tuqui (ahora con RAG ✅)
4. Genera hábito → Repite mañana
```

### Checklist

- [ ] `public/manifest.json` + icons (192px, 512px)
- [ ] `public/sw.js` (service worker para push)
- [ ] Meta tags PWA en `app/layout.tsx`
- [ ] Migration `210_push_subscriptions.sql`
- [ ] `lib/push/sender.ts` (sendPushToUser, sendPushToTenant)
- [ ] `app/api/push/subscribe/route.ts`
- [ ] `lib/hooks/use-push-notifications.ts`
- [ ] `components/PushNotificationToggle.tsx`
- [ ] Generar VAPID keys, agregar a `.env`

### Tests

```typescript
// tests/unit/push-sender.test.ts
- sendPushToUser envía a todas las suscripciones del user
- sendPushToUser elimina suscripciones expiradas (410)
- sendPushToUser retorna { sent: 0 } si no hay suscripciones
- sendPushToTenant envía a todos los users del tenant

// tests/unit/push-subscribe.test.ts
- POST /api/push/subscribe guarda suscripción
- POST /api/push/subscribe upsert si ya existe
- POST /api/push/subscribe requiere auth
```

### Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| iOS Safari: push limitado | No funciona en iPhone | Informar al usuario, focus en Android/Chrome |
| `web-push` no funciona en Edge Runtime | Build error | Usar Node.js runtime en route handler |
| VAPID keys rotadas | Push deja de funcionar | Documentar proceso de generación |

---

## 🔜 FASE 6: BRIEFINGS MATUTINOS (~1 día) — TERCERA

> **Objetivo:** Cada mañana, resumen automático → push notification  
> **Depende de:** F5 (push) + skills Odoo  
> **Spec técnica:** Ver `TUQUI_REFACTOR_SPECS.md` § F6

### Checklist

- [ ] Migration `220_briefing_config.sql`
- [ ] `lib/briefings/generator.ts` (generateBriefingData, formatBriefingText)
- [ ] `app/api/cron/briefings/route.ts`
- [ ] Configurar cron en `vercel.json`
- [ ] `components/BriefingSettings.tsx` (UI con checkboxes)

### Tests

```typescript
// tests/unit/briefing-generator.test.ts
- generateBriefingData incluye ventas si config.include_sales
- generateBriefingData omite ventas si !config.include_sales
- generateBriefingData retorna {} si no hay credenciales Odoo
- formatBriefingText genera texto amigable con datos
- formatBriefingText muestra "todo tranquilo" si no hay datos

// tests/unit/briefing-cron.test.ts
- GET /api/cron/briefings requiere CRON_SECRET
- Envía solo a usuarios dentro de ventana horaria
- No envía si last_sent_at es reciente
- Actualiza last_sent_at después de enviar
```

### Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Vercel Hobby: cron máx 1/día | No puede enviar cada 15 min | Vercel Pro ($20/mes) o single daily cron |
| Timezone: usuario en otro huso | Briefing a hora equivocada | Campo timezone en config |
| Odoo rate limits a las 7:30 AM | Briefings fallan | Retry con backoff, ventana de 15 min |

---

## 🔜 FASE 8: PILOTO CEDENT (~0.5 días)

> **Objetivo:** Validar uso real sin intervención  
> **Requiere:** F7 + F5 + F6 funcionando

### Proceso

1. **Preparar tenant:** Verificar credenciales Odoo, configurar company context, activar agentes
2. **Onboarding mínimo:** Un mensaje a Santi con 3 queries de ejemplo
3. **Silencio 5 días:** Medir queries/día, qué preguntan, errores, retorno
4. **Feedback:** "¿Lo usaste?", "¿Funcionó?", "¿Pagarías $X/mes?"

### Métricas de éxito

| Métrica | Mínimo para PMF |
|---------|-----------------|
| Queries totales (5 días) | ≥ 20 |
| Usuarios que volvieron | ≥ 2 |
| Dispuesto a pagar | Sí |

---

## 🔜 FASE 9: COBRAR (El test definitivo)

> **Objetivo:** Validar que alguien pague dinero real

**Opción A (recomendada):** Cobro manual via MercadoPago. Para 3 clientes no necesitás Stripe.

| Señal | Qué significa |
|-------|---------------|
| Paga sin dudar | ✅ PMF fuerte |
| Paga con objeciones menores | ✅ PMF |
| Quiere negociar mucho | ⚠️ PMF débil |
| No paga | ❌ No hay PMF |

---

## � FASE X: OPTIMIZAR MODELO GEMINI (~5 min + corrida de evals)

> **Objetivo:** Bajar costos de API ~70% sin perder calidad

**Problema:** `gemini-3-flash-preview` está en `engine.ts` y `llm-engine.ts` (chat principal). Es ~5x más caro que `gemini-2.0-flash`. En Feb 2026 costó ~$13 de $19 totales.

| Archivo | Modelo actual | Cambiar a |
|---------|--------------|-----------|
| `lib/chat/engine.ts:79` | `gemini-3-flash-preview` | `gemini-2.0-flash` |
| `lib/tools/llm-engine.ts:147` | `gemini-3-flash-preview` | `gemini-2.0-flash` |
| `app/api/internal/chat-test/route.ts:188` | `gemini-3-flash-preview` | `gemini-2.0-flash` |

**Nota:** El orquestador ya usa `gemini-2.0-flash` y da 98.5% en evals. Si las respuestas del agente bajan calidad, probar `gemini-2.5-flash` como intermedio.

**Verificación:** Correr evals después del cambio. Si ≥85% → ship. Si baja → revertir.

**Desglose de costos Feb 2026 ($19.11 en 11 días):**

| SKU | Costo |
|-----|-------|
| Gemini 3 Flash input (20.1M tokens) | $10.06 |
| Gemini 2.0 Flash input (43.6M tokens) | $4.36 |
| Gemini 3 Flash output (1M tokens) | $3.08 |
| Embeddings input (5.5M tokens) | $0.83 |
| Resto | ~$0.78 |

---

## �📊 MÉTRICAS DE ÉXITO

| Métrica | Actual | Target | Cómo medir |
|---------|--------|--------|------------|
| Clientes pagando | 0 | ≥ 1 | Cuenta de banco |
| Queries/semana (piloto) | 0 | ≥ 20 | DB |
| Usuarios con push activo | 0 | ≥ 3 | push_subscriptions |
| Docs en RAG | 0 | ≥ 5 | master_documents table |
| Unit tests | ~337 | ≥ 380 | vitest |
| Eval baseline | 98.5% | ≥ 95% | Mantener |

---

## 📏 CONVENCIONES

### Numeración de migrations

| Rango | Dominio | Ejemplos |
|-------|---------|----------|
| 100-131 | Schema original + fixes | 100 unified_schema, 103 master_agents, 105 fix_match_documents |
| 200-209 | Core features + platform | 200 company_context, 203 memories, 206 slim_odoo_prompt, **208 master_documents, 209 fix_match_documents** |
| 210-219 | Engagement (Push) | 210 push_subscriptions |
| 220-229 | Engagement (Briefings) | 220 briefing_config |

⚠️ **Duplicados conocidos:** 120×2 (`add_auth_user_id` + `meli_force_tool_execution`), 203×2 (`memories` + `platform_admin`). No bloquean — Supabase corre por orden alfabético.

### Estructura de archivos

```
lib/
├── agents/           # Orquestación y routing
├── skills/           # Tools para Gemini (odoo/, memory/)
├── chat/             # Engine de conversación
├── company/          # Contexto de empresa
├── push/             # Push notifications (F5)
├── briefings/        # Briefings matutinos (F6)
├── platform/         # Super admin auth (F7)
├── rag/              # Procesamiento de documentos (F7)
├── errors/           # Manejo de errores amigables
└── tools/            # Executor + definiciones

app/
├── super-admin/      # UI platform admin (F7)
├── api/push/         # Push subscription API (F5)
├── api/cron/         # Cron jobs (F6)
└── api/super-admin/  # Platform admin API (F7)
```

---

## 🚫 QUÉ NO HACER (Hasta tener PMF)

| Feature | Por qué no |
|---------|------------|
| User Credentials por usuario | Overkill para 3 usuarios |
| Super Admin UI completa (tenants) | SQL alcanza |
| Seguridad enterprise (AES-256) | No hay datos sensibles |
| Token limits desde UI | Nadie en el límite |
| Analytics y dashboards | Vanity metrics |
| Multi-idioma | Un mercado primero |

---

## 📅 TIMELINE

```
Semana 1 (F7 — Master Agents + RAG — 3 sesiones):
├── S1: Migrations 208/209 + lib/rag/master-documents.ts + cleanup rag_enabled + tests
├── S2: Super admin UI (lista + editor + upload component + API route)
├── S3: Subir PDFs + @mention agents + agent attribution en tools + tests

Semana 1-2 (F5 + F6 — Engagement):
├── Día 4: F5 completo (PWA + Push) + tests
├── Día 5: F6.1-6.3 (briefing config + generator + cron)
└── Día 6: F6.4-6.5 (vercel cron + UI) + tests

Semana 2 (F8 — Piloto):
├── Día 7: Setup Cedent + onboarding
├── Días 8-12: Silencio, medir uso
└── Día 13: Contactar, feedback

Semana 3:
└── F9: Ofrecer precio, cobrar o iterar
```

---

## 🤖 NOTAS PARA CLAUDE CODE

### Archivos clave existentes

```
lib/agents/orchestrator.ts          # Orquestador LLM (~155 líneas)
lib/company/context-injector.ts     # Inyección company context
lib/chat/build-system-prompt.ts     # 7 capas de prompt
lib/tools/llm-engine.ts             # Engine único (V2)
lib/improvement/auditor.ts          # 5 dimensiones (incl insightScore)
lib/improvement/loop.ts             # Progressive L1→L5
lib/skills/memory/                  # recall + save + tools
lib/errors/friendly-messages.ts     # Errores → mensajes amigables
```

### Archivos nuevos por fase

```
# F7 — Master Agents + RAG (PRIMERA — 3 sesiones)
supabase/migrations/208_master_documents.sql              # S1
supabase/migrations/209_fix_match_documents.sql            # S1
lib/rag/master-documents.ts                                # S1
tests/unit/master-documents.test.ts                        # S1
app/super-admin/agents/page.tsx                            # S2
app/super-admin/agents/[slug]/page.tsx                     # S2
components/super-admin/MasterAgentEditor.tsx                # S2
components/super-admin/MasterDocUpload.tsx                  # S2
app/api/super-admin/agents/[slug]/documents/route.ts       # S2
lib/chat/parse-mention.ts                                  # S3
tests/unit/parse-mention.test.ts                           # S3
# Nota: lib/platform/auth.ts YA EXISTE — no crear

# F5 — PWA + Push (SEGUNDA)
public/manifest.json
public/sw.js
lib/push/sender.ts
app/api/push/subscribe/route.ts
lib/hooks/use-push-notifications.ts
components/PushNotificationToggle.tsx

# F6 — Briefings (TERCERA)
lib/briefings/generator.ts
app/api/cron/briefings/route.ts
components/BriefingSettings.tsx
```

### Principios

1. **Mínimo viable** — Solo lo necesario para validar
2. **Tests primero** — No mergear si evals bajan
3. **Descripciones > Prompts** — <500 tokens prompt, descripciones ricas
4. **Archivos < 200 líneas** — Un archivo = una responsabilidad
5. **Config en DB** — Nuevo agente = INSERT, no deploy

---

*Última actualización: 2026-02-12*  
*PRs mergeados: #2-#10 | PR abierto: #11 (feat/memory)*  
*Spec técnica detallada: `TUQUI_REFACTOR_SPECS.md`*  
*Versión anterior archivada: `docs/archive/TUQUI_REFACTOR_PLAN_v3.md`*  
*Filosofía: Ship > Perfect*
