# 🧠 TUQUI REFACTOR v4 — ROAD TO PMF

> **Filosofía:** Llegar a PMF primero, infraestructura enterprise después  
> **Principio:** Usuarios pagando > Features perfectas  
> **Para:** Un founder que necesita validar antes de escalar  
> **Última actualización:** 2026-02-19

---

## 📍 ESTADO ACTUAL

| Campo | Valor |
|-------|-------|
| Fases completadas | F0-F4, F7, F7.5, Phase 0, Security P2 |
| Branch | `main` (último merge: PR #34 → c09ba93) |
| Branch activo | — (limpio, sin PRs abiertos) |
| Unit tests | 557 passing, 59 archivos |
| Test files | 71 |
| Eval baseline | 97.1% (68/70) — los 2 fallos son RAG (0 docs) |
| Eval cases | 75 (67 originales + 8 quality) |
| Skills Odoo | 59 (+1 get_below_reorder_point) |
| Memory Skills | 2 (recall_memory, save_memory) |
| Docs en RAG | ⚠️ 0 (crítico) |
| Master Agents UI | ❌ Solo via SQL |
| Clientes pagando | 0 |
| Pilotos activos | Cedent (demo), Active Learning (pendiente) |
| Tenant Isolation | ✅ Fix dd4b223 (23 archivos, ~45 queries) |
| Modelos | gemini-2.5-flash (lightweight), gemini-3-flash-preview (chat main) |
| WhatsApp | ✅ Twilio signature validation + phone normalization |
| Security | ✅ AES-256-GCM, DOMPurify, auth TTS, session 1-query |

### Lo que falta

```
Skills Odoo:      ██████████████████████████████████████████████████████████ 59
Docs RAG:         ⬜ 0
Master Agents UI: ⬜ No existe
PWA:              ▓▓▓▓▓▓░░ ~85% backend (falta manifest + icons + wiring)
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
- **Resultado:** 97.1% accuracy en evals (68/70).

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

| Fase | Tiempo | Descripción | Estado |
|------|--------|-------------|--------|
| F7 | 2-3 días | Master Agents + RAG Centralizado | ✅ Completada |
| F7.5 | 0.5 días | Company Discovery (Deep Research Odoo) | ✅ Completada (PR #32) |
| Phase 0 | 0.5 días | Hardening (security + cleanup) | ✅ Completada (ff80ba3) |
| Security P2 | 0.5 días | Twilio sig, DOMPurify, session opt, webhook move | ✅ Completada (PR #34) |
| F5 | ~4h | PWA + Push Notifications | 🔜 ~85% backend listo |
| F7.6 | 2-3 días | Intelligence Layer + Briefings (absorbe F6) | 🔜 Siguiente |
| F7.7 | 2 días | Google Integration (Calendar + Gmail) | 🔜 Opcional pre-piloto |
| F8 | 0.5 días | Piloto Cedent | 🔜 Validación real |
| F9 | — | Cobrar ($50-100/mes) | 🔜 PMF signal |
| FX | 5 min | Optimizar modelo Gemini → bajar costos ~70% | 🔜 Margen |

**Total restante: ~5-7 días de código + validación continua**

### Orden de ejecución

```
✅ F7 → ✅ F7.5 → ✅ Phase 0 → ✅ Security P2 → F5 → F7.6 → F7.7 (opcional) → F8 → F9
```

**¿Por qué F5 ahora?** El 85% del backend de push ya existe. Solo faltan manifest + icons + wiring (~4h). F7.6 necesita push como canal de delivery, así que completar F5 primero es prerequisito.

**¿Por qué F5 antes de F7.6?** El intelligence layer necesita push como canal de delivery. Si construimos F7.6 sin push, no podemos testear el flujo real (push matutino → tap → chat). Tener push listo primero permite que F7.6 incluya el briefing matutino desde el día 1.

**¿Por qué F7.6 absorbe F6?** F6 planteaba un sistema separado de briefings. Pero el intelligence layer (cron matutino + teasers + push) ya cubre eso. Un solo flujo: analista investiga → cachea teasers → envía push → session opener al abrir. Cero duplicación.

**¿Por qué F7.7 (Google) como fase separada?** Calendar + Gmail enriquecen al analista pero no son bloqueantes. Requiere análisis de MCP libraries existentes y OAuth setup. Se puede hacer pre-piloto o post-piloto.

### Lo que se POSPONE (post-PMF)

| Fase original | Por qué se pospone |
|---------------|---------------------|
| User Credentials (F5 viejo) | Overkill para 3 usuarios por tenant |
| Super Admin UI completa (tenants) | Podés hacer CRUD via SQL |
| Token limits desde UI | Nadie está en el límite |
| ~~Seguridad enterprise (AES-256)~~ | ✅ Implementado en Phase 0 + Security P2 |
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

## ✅ FASE 7.5: COMPANY DISCOVERY (~0.5 días) — COMPLETADA

> PR #32 mergeado (51b103c). 45 archivos, +3094/-203 líneas.

### Concepto

Cuando un tenant conecta Odoo, Tuqui corre automáticamente ~50 skills y sintetiza 
un dossier de la empresa: industria, escala, productos clave, clientes top, 
modelo de negocio, etc. Se guarda en `company_contexts.discovery_profile`.

### Checklist

- [x] ~~Migration `211_company_discovery.sql`~~ (no fue necesaria, usa campos existentes de `company_contexts`)
- [x] `lib/company/discovery.ts` — 70+ queries en batches de 6, usa `_descripcion` de skills
- [x] LLM sintetiza resultados en perfil (Gemini 2.0 Flash, 8192 tokens)
- [x] `app/admin/company/actions.ts` → `runCompanyDiscovery()` server action
- [x] Botón "Detectar desde Odoo" en admin (`CompanyDiscoveryButton.tsx`)
- [x] CustomEvent `tuqui:autofill` para llenar formulario (industry, description, customers, products)
- [x] 🎤 Dictation en textareas (`DictationTextarea.tsx`)
- [x] 8 skills nuevos: HR (employees, leaves, departments), Mail (chatter, activities, emails), Users
- [x] Prompt orientado a CONTEXTO GENERAL (no dossier exhaustivo)
- [ ] Tests: discovery con mocks

### User Discovery (pre-intelligence layer)

- [x] Skill `get_user_activity` — actividad reciente de un usuario en Odoo
- [ ] `lib/user/discovery.ts` — orquesta queries por usuario + LLM synthesis → bio
- [ ] Botón "Detectar perfil desde Odoo" en UI de perfil
- [ ] Enriquecer `context-injector.ts` para incluir `user_profiles.bio`

### Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Odoo rate limits con 50 queries | Timeout / bloqueo | Batch de 10, delay entre batches |
| Skills que fallan (sin datos) | Resultados parciales | `Promise.allSettled`, ignorar fallos |
| Perfil genérico / poco útil | Contexto débil | Prompt del synthesizer con ejemplos ricos |

---

## ✅ PHASE 0: HARDENING (~0.5 días) — COMPLETADA

> **Branch:** `fix/phase0-hardening` (ff80ba3). 11 archivos, +142/-500 líneas.  
> **Objetivo:** Corregir deuda técnica crítica pre-PMF detectada en auditoría completa.

### Fixes aplicados

| Fix | Archivo | Detalle |
|-----|---------|---------|
| Crypto real (AES-256-GCM) | `lib/crypto.ts` | Era base64, ahora GCM con IV random + auth tags. Backwards compatible. |
| Auth en TTS | `app/api/tts/route.ts` | Endpoint 100% abierto → ahora requiere `auth()` |
| Engine prompt bug | `lib/chat/engine.ts` | Usaba prompt del agente BASE cuando routeaba a otro agente |
| Zoom accesibilidad | `app/layout.tsx` | `maximumScale: 1` bloqueaba pinch-to-zoom (WCAG) |
| Dead code: router | `lib/agents/router.deprecated.ts` | Eliminado (452 líneas, 0 imports) |
| Dead code: getTuqui | `lib/agents/service.ts` | Wrapper deprecado eliminado |
| Dead code: shouldUseSkills | `lib/tools/executor.ts` | Feature flag que siempre retornaba `true` |

### Tests agregados

- `tests/unit/crypto.test.ts` — 6 tests: roundtrip, legacy compat, tamper detection, IV uniqueness
- `tests/unit/engine.test.ts` — +1 test: regression para prompt routing bug

### Issues pendientes (para Quality Sweep futuro)

- ~~WhatsApp webhook: sin validación de firma Twilio~~ ✅ Security P2
- 3 SDKs de Google AI (consolidar a `@ai-sdk/google`)
- ~~Session callback: 3+ DB queries por request autenticado~~ ✅ Security P2 (1 query)
- ~~`dangerouslySetInnerHTML` sin DOMPurify en chat~~ ✅ Security P2
- 0/16 API routes con unit tests
- Archivos >200 líneas: chat page (662), query-builder (1364), web-search (589)

---

## ✅ SECURITY P2: HARDENING PARTE 2 (~0.5 días) — COMPLETADA

> **Branch:** `security-hardening-p2` → PR #34 (merged c09ba93). +1933/-589 líneas.  
> **Objetivo:** Cerrar issues de seguridad pendientes de Phase 0 + fix WhatsApp + nueva skill.

### Fixes aplicados

| Fix | Archivo | Detalle |
|-----|---------|---------|
| Twilio signature validation | `app/api/webhooks/twilio/route.ts` | `validateRequest()` en producción, bypass en dev |
| DOMPurify sanitización | `lib/chat/sanitize.ts` + chat page | `dangerouslySetInnerHTML` ahora sanitiza con DOMPurify |
| Session optimización | `lib/auth/session.ts` | 3+ DB queries → 1 query con JOIN |
| Webhook move | `app/api/webhooks/twilio/` | Migrado de `/api/whatsapp/webhook` a ruta canónica |
| WhatsApp phone normalization | `lib/supabase/client.ts` | Twilio envía `whatsapp:+54...` → strip prefix antes de DB lookup |
| Fire-and-forget → after() | `app/api/webhooks/twilio/route.ts` | `after()` de Next.js para safety en Vercel serverless |
| Nueva skill: reorder point | `lib/skills/odoo/get-below-reorder-point.ts` | Productos debajo del punto de pedido (14 tests) |

### Tests agregados

- `tests/unit/twilio-validate.test.ts` — 6 tests: firma válida, inválida, dev skip, etc.
- `tests/unit/sanitize.test.ts` — 5 tests: XSS, scripts, clean HTML
- `tests/unit/skills/get-below-reorder-point.test.ts` — 14 tests: validación, filtros, errores

---

## 🔜 FASE 7.6: INTELLIGENCE LAYER (~2-3 días) ⭐ DOPAMINE LOOP

> **Objetivo:** Cada vez que el usuario abre Tuqui, hay algo nuevo e interesante  
> **Depende de:** F7 (RAG) + F7.5 (company context rico) + F5 (PWA + Push)  
> **Absorbe:** F6 (Briefings Matutinos) — un solo flujo, no dos sistemas  
> **Spec completa:** `INTELLIGENCE_LAYER_PLAN.md`  
> **Ejecución:** F7.6a (2 sesiones) + F7.6b (1 sesión)

### Concepto: Curious Analyst Agent

**No son collectors hardcodeados ni 38 archivos de discoveries.**
**El prompt del analista vive en DB como master agent, no en código.**

Es un master agent `analista` que:
1. Recibe contexto rico: empresa + usuario + chats recientes + memoria + historial
2. Usa las MISMAS tools del chat (50 Odoo skills, MeLi, Tavily, RAG)
3. El LLM decide qué investigar (3-8 tool calls)
4. Sintetiza hallazgos en 2-3 teasers con emoji + dato + pregunta disparadora
5. Se muestra como session opener al abrir el chat

```
┌─ Context Assembler ─┐    ┌─ Investigator ──────────┐    ┌─ Synthesizer ──┐
│ Company profile     │    │ generateText() con       │    │ Hallazgos →    │
│ User profile        │───▶│ maxSteps: 8              │───▶│ 2-3 teasers    │
│ Recent chats        │    │ USA LAS MISMAS TOOLS     │    │ emoji+dato+    │
│ Memories            │    │ El LLM decide qué buscar │    │ pregunta       │
│ Insight history     │    └──────────────────────────┘    └────────────────┘
└─────────────────────┘
```

### Data model

4 tablas: `user_profiles`, `entity_mentions`, `insight_history`, `insight_cache` + RLS.
Schema completo en `INTELLIGENCE_LAYER_PLAN.md` § 8.

### Fases

**F7.6a (2 sesiones): Profiles + Engine + Session Opener**

Sesión 1 — DB + Profiles + Context + Master Agent:
- [ ] Migration `212_intelligence.sql` (4 tablas + RLS — schema en `INTELLIGENCE_LAYER_PLAN.md` § 8)
- [ ] INSERT master agent `analista` (prompt + tools en DB)
- [ ] `lib/intelligence/types.ts` — interfaces (~30 líneas)
- [ ] `lib/intelligence/profiles/extract-profile.ts` — LLM extrae de texto (~40 líneas)
- [ ] `lib/intelligence/profiles/user-profile.ts` — CRUD (~50 líneas)
- [ ] `lib/intelligence/profiles/memory-enricher.ts` — auto-watchlist (~50 líneas)
- [ ] `lib/intelligence/context-assembler.ts` — junta todo el contexto (~60 líneas)
- [ ] Tests: extract-profile, user-profile, memory-enricher, context-assembler

Sesión 2 — Investigator + Delivery:
- [ ] `lib/intelligence/investigator.ts` — carga agente `analista` de DB + agentic loop (~50 líneas)
- [ ] `lib/intelligence/synthesizer.ts` — hallazgos → teasers (~50 líneas)
- [ ] `lib/intelligence/engine.ts` — orquesta todo (~40 líneas)
- [ ] `lib/intelligence/history.ts` — insight_history CRUD (~40 líneas)
- [ ] `lib/intelligence/delivery.ts` — session opener + cache (~50 líneas)
- [ ] Integrar session opener en `app/chat/[slug]/page.tsx` (~10 líneas)
- [ ] Integrar memory-enricher hook en `lib/chat/engine.ts` (~5 líneas)
- [ ] Tests: investigator (mocks), synthesizer, engine, delivery
- [ ] Test E2E: generar insights para Cedent con data real

**F7.6b (1 sesión): Cron + Push Delivery + Onboarding + Polish**
- [ ] `app/api/cron/intelligence/route.ts` — cron matutino (~30 líneas)
- [ ] Push delivery: post-cache, enviar push con teaser más impactante via `sendPushToUser()`
- [ ] Configurar cron en `vercel.json`
- [ ] Onboarding flow: detectar user sin profile → pregunta inicial
- [ ] 🎤 Agregar icono mic en textarea de onboarding de user profile — usa `useDictation` hook para dictar
- [ ] Feedback tracking: `tapped` cuando user clickea pregunta sugerida
- [ ] Tests: cron, push delivery, feedback
- [ ] Eval: correr 5 días contra Cedent, medir variedad + relevancia

> **⚡ F6 absorbido:** No existe como fase separada. El cron de intelligence
> genera teasers + envía push. La config de "qué incluir" viene del user profile
> (pain_points, watchlist, role). Cero duplicación.

### Tests

| Test | Validación |
|------|-----------|
| `extractProfile("soy el dueño, me mata la cobranza")` | `role=dueno`, painPoints includes cobranza |
| `extractProfile("quiero seguir siliconas y Córdoba")` | watchlist includes siliconas, Córdoba |
| `assembleContext()` con mocks | Incluye company + profile + sessions + memories + history |
| `investigate()` con tools mockeadas | ≥3 tool calls, retorna texto con hallazgos |
| `synthesize()` con hallazgos variados | 2-3 teasers con emoji + dato + pregunta |
| `synthesize()` con historial | No repite insights ya mostrados |
| Mention 3x "Macrodental" | Auto-agrega a watchlist |
| `getSessionOpener()` con cache fresco | Retorna del cache, marca served |
| `getSessionOpener()` sin cache | Genera on-demand |

### Por qué funciona

```
El LLM ya sabe hacer esto. Cuando el usuario pregunta "¿cómo estamos?",
el agente Odoo llama 3-4 skills y arma un resumen. El Curious Analyst
hace lo mismo pero SIN que el usuario pregunte.

No hay 38 archivos de "discoveries". No hay collectors fijos.
Hay un agente con acceso a tools que decide qué buscar.

~13 archivos, ~520 líneas. El LLM hace el trabajo pesado.
```

### Flujo completo

```
7:00 AM  → Cron → generateInsights() → cache (served=false) + push matutino
9:15 AM  → Usuario toca push → abre Tuqui PWA → getSessionOpener() → lee cache → 2 teasers
         → 👻 Macrodental no compra hace 47 días
           ¿Qué dejó de llevar?
         → 🛒 Composite: vos $45K, MeLi $62K
           ¿Estoy regalando margen?
         → Usuario toca pregunta → chat normal → Tuqui responde
         → cache marcado served=true
13:00    → Abre de nuevo → cache served → on-demand refresh → nuevos teasers
```

### Impacto en otros módulos

| Módulo | Cambio |
|--------|--------|
| `lib/chat/engine.ts` | Hook post-mensaje: `enrichFromMessage()` (~5 líneas) |
| `app/chat/[slug]/page.tsx` | Session opener al crear sesión nueva (~10 líneas) |
| `vercel.json` | Agregar cron `/api/cron/intelligence` (~3 líneas) |

### Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Investigator usa demasiados tokens | Costo alto | `maxSteps: 8`, gemini-2.0-flash (~$0.003/run) |
| Insights genéricos / aburridos | No engancha | Prompt rico + user profile + feedback loop |
| Cron timeout en Vercel Hobby (10s) | No pre-computa | Vercel Pro o generar solo 1 user por invocación |
| User sin profile → contexto pobre | Teasers genéricos | Onboarding conversacional al primer uso |
| Tools fallan (Odoo down, MeLi timeout) | Sin insights | `Promise.allSettled` en el investigator, retry |

---

## 🔜 FASE 5: PWA + PUSH NOTIFICATIONS (~0.5 días)

> **Objetivo:** Tuqui en el teléfono del usuario, notificaciones nativas  
> **Depende de:** F7.5 (contenido para mostrar)  
> **Requerido por:** F7.6 (intelligence layer usa push como canal de delivery)  
> **Spec técnica:** Ver `TUQUI_REFACTOR_SPECS.md` § F5  
> **Nota:** ~85% del backend ya existe. Solo falta manifest, icons, y wiring.

### Ya implementado ✅

| Componente | Archivo | Estado |
|------------|---------|--------|
| Service Worker | `public/sw.js` | ✅ Push receive + notification click |
| Subscribe API | `app/api/push/subscribe/route.ts` | ✅ Guarda suscripción en DB |
| Push hook | `lib/hooks/use-push-notifications.ts` | ✅ Suscribe/desuscribe |
| NotificationBell | `components/NotificationBell.tsx` | ✅ Toggle en header |
| Push sender | `lib/prometeo/notifier.ts` | ✅ `sendPushNotification()` (per-user) |
| DB tabla | `push_subscriptions` | ✅ Con RLS |
| VAPID keys | `.env` | ✅ Configurado |
| web-push dep | `package.json` | ✅ ^3.6.7 |

### Falta implementar

- [ ] `public/manifest.json` + icons (192px, 512px)
- [ ] Meta tags PWA en `app/layout.tsx` (`<link rel="manifest">`, `theme-color`, etc.)
- [ ] SW registration wiring (actualmente no se registra automáticamente)
- [ ] `PushNotificationToggle.tsx` — componente standalone para settings
- [ ] Extraer `sendPushToUser()` y `sendPushToTenant()` como funciones reutilizables
      (hoy `sendPushNotification` está private en `notifier.ts`)

### Estimación: ~4h (no 1.5 días como se estimó originalmente)

### El loop de engagement

```
1. 7:30 AM → Push: "🌅 Vendiste $850K ayer"
2. Usuario toca → Abre Tuqui (PWA, ya logueado)
3. Pregunta algo → Usa Tuqui (ahora con RAG ✅)
4. Genera hábito → Repite mañana
```

### Checklist

- [ ] `public/manifest.json` + icons (192px, 512px)
- [x] ~~`public/sw.js`~~ (ya existe)
- [ ] Meta tags PWA en `app/layout.tsx`
- [x] ~~Migration push_subscriptions~~ (ya existe)
- [ ] `lib/push/sender.ts` (extraer de notifier.ts → sendPushToUser, sendPushToTenant)
- [x] ~~`app/api/push/subscribe/route.ts`~~ (ya existe)
- [x] ~~`lib/hooks/use-push-notifications.ts`~~ (ya existe)
- [ ] `components/PushNotificationToggle.tsx` (standalone para settings)
- [x] ~~VAPID keys~~ (ya configurado)

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

## 🔜 FASE 7.7: GOOGLE INTEGRATION — Calendar + Gmail (~2 días)

> **Objetivo:** Enriquecer al analista con contexto del día (reuniones) y del mundo externo (emails)  
> **Depende de:** F7.6 (intelligence layer funcionando)  
> **Opcional:** Se puede hacer pre-piloto o post-piloto. El analista funciona sin esto.  
> **Referencia:** `adhoc-tuqui-morning/` tiene implementación de Gmail + Calendar que se puede portar

### Decisión de approach: Skills directos (no MCP)

**MCP descartado.** MCP es un protocolo de transporte pensado para agentes locales
(Claude Desktop, Cursor). Para Tuqui no aporta:
- Los MCP servers de Google son **single-user** — Tuqui es multi-tenant, multi-user
- `googleapis` (npm) ya es la puerta de entrada a Google — oficial, tipada, 10 líneas
- Agregaría una capa de indirección innecesaria entre el skill y la API
- La arquitectura de skills de Tuqui ya resuelve descubrimiento + ejecución

**Se implementa como skills propios**, igual que Odoo y MeLi. Mismo patrón,
mismo registry, mismas descripciones ricas. El código base se porta de Antigravity.

### Concepto: Per-User Tool Connections

**Cambio de modelo:** Hoy las integraciones son **per-tenant** (`integrations` table,
`UNIQUE(tenant_id, type)`). Cada usuario del tenant comparte las mismas credenciales
de Odoo, MeLi, etc.

Google Calendar y Gmail son **personales** — cada usuario conecta SU cuenta.
Esto introduce un nuevo concepto: **user connections** (integraciones per-user).

```
Hoy (per-tenant):                  Nuevo (per-user):
┌───────────────────┐          ┌───────────────────────┐
│ integrations       │          │ user_connections       │
│ tenant_id + type   │          │ tenant_id + user_id    │
│ = 1 Odoo por tenant│          │ + type                 │
└───────────────────┘          │ = 1 Google por usuario │
                                 └───────────────────────┘
```

El usuario configura sus connections desde **/herramientas** (settings de usuario):
- Google Calendar: botón "Conectar Google" → OAuth consent → calendar.readonly
- Gmail: botón "Conectar Gmail" → OAuth consent → gmail.readonly (opt-in explícito)
- Cada connection es per-user, no per-tenant
- El skill retorna `{ available: false }` si el user no conectó

### Nota: Odoo también debería migrar a per-user (futuro)

Hoy Odoo es per-tenant: todos los usuarios comparten las mismas credenciales.
Esto significa que un vendedor tiene acceso a las mismas queries que el dueño.

**Ideal futuro:** cada usuario conecta SU cuenta de Odoo → los permisos de Odoo
restringen qué ve cada uno. Un vendedor solo ve SUS ventas si Odoo tiene access
rights configurados. Se resuelve migrando Odoo de `integrations` (per-tenant)
a `user_connections` (per-user).

**Para F7.7 no es bloqueante** — se puede hacer después. Pero la tabla
`user_connections` se diseña genérica para soportar Google Y Odoo:

```sql
-- Migration 214_user_connections.sql

CREATE TABLE user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL,              -- 'google_calendar', 'google_gmail', 'odoo' (futuro)
  config JSONB NOT NULL DEFAULT '{}', -- tokens, scopes, credentials
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,          -- para OAuth tokens
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id, type) -- 1 connection por user por tipo
);

ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

-- Cada user solo ve sus propias connections
CREATE POLICY "users_own_connections" ON user_connections
  FOR ALL USING (user_id = auth.uid());

-- Service role para cron (intelligence layer)
CREATE POLICY "service_manages_connections" ON user_connections
  FOR SELECT USING (true);
```

### Flujo de carga de tools con user connections

```
getToolsForAgent(tenantId, agent, userEmail, userId)
  │
  ├── Odoo: loadOdooCredentials(tenantId)           // per-tenant (hoy)
  │       → futuro: loadUserConnection(userId, 'odoo') // per-user
  │
  ├── Google Calendar: loadUserConnection(userId, 'google_calendar')
  │       → si existe + active + no expirado → skill disponible
  │       → si no existe → skill retorna { available: false }
  │
  └── Gmail: loadUserConnection(userId, 'google_gmail')
          → idem Calendar
```

### Skills Google (skills directos con `googleapis`)

**`lib/skills/google/calendar.ts`** (~60 líneas)
```typescript
// Skill: getCalendarEvents
// Descripción rica:
// USAR CUANDO: el analista quiere contextualizar insights con la agenda del día
// EJEMPLO: "Tenés reunión con Dental Sur a las 11 — hace 23 días que no compran"
// PARÁMETROS: period ('today' | 'tomorrow' | 'this_week')
// RETORNA: { available: boolean, events: [{ title, start, end, attendees }] }
// NOTA: Solo disponible si el usuario conectó Google Calendar desde /herramientas

export async function execute(params, context) {
  const conn = await loadUserConnection(context.userId, 'google_calendar')
  if (!conn) return { available: false }
  const auth = await getGoogleAuth(conn)  // refresh si expiró
  const calendar = google.calendar({ version: 'v3', auth })
  // ... fetch events, return structured
}
```

**`lib/skills/google/gmail.ts`** (~80 líneas)
```typescript
// Skill: getRecentEmails
// USAR CUANDO: buscar contexto externo (proveedores, clientes, regulatorio)
// EJEMPLO: "3M te mandó nueva lista de precios — ¿querés comparar con tus costos?"
// PARÁMETROS: hours (default 24), maxResults (default 10)
// RETORNA: { available: boolean, emails: [{ from, subject, snippet, importance }] }
// NOTA: Solo disponible si el usuario conectó Gmail desde /herramientas. Opt-in explícito.

export async function execute(params, context) {
  const conn = await loadUserConnection(context.userId, 'google_gmail')
  if (!conn) return { available: false }
  // ... fetch + score con heurísticas portadas de Antigravity
}
```

### Código reutilizable de Antigravity

| Archivo Antigravity | Qué tiene | Reutilizable |
|---|---|---|
| `lib/intelligence/heuristics.ts` | Email importance scoring (VIP senders, urgency keywords) | Sí, portar |
| `lib/intelligence/briefing.ts` | Prompt de briefing + script generation | No (reemplazado por intelligence layer) |
| `lib/intelligence/news.ts` | Tavily news fetching | Ya existe en Tuqui |
| Google OAuth flow | NextAuth + GoogleProvider + googleapis | Sí, portar |

### UI: /herramientas (settings de usuario)

Página donde cada usuario gestiona SUS connections:

```
┌─────────────────────────────────────────┐
│  Mis Herramientas                        │
│                                         │
│  📅 Google Calendar                       │
│  [ Conectar Google ]                     │
│  Estado: ✅ Conectado (martin@cedent.com)  │
│  Permiso: Solo lectura de calendario     │
│  [ Desconectar ]                         │
│                                         │
│  📧 Gmail                                 │
│  [ Conectar Gmail ]                      │
│  Estado: ❌ No conectado                   │
│  ℹ️ Tuqui podrá leer tus emails recientes │
│     para cruzar con datos del negocio    │
│                                         │
│  📦 Odoo (futuro)                         │
│  Conectado via empresa (compartido)      │
│  ℹ️ Próximamente: conectar tu propia cuenta │
└─────────────────────────────────────────┘
```

### Checklist

- [ ] Migration `214_user_connections.sql` (tabla genérica per-user)
- [ ] `lib/skills/google/auth.ts` — OAuth helper + refresh tokens (~50 líneas)
- [ ] `lib/skills/google/calendar.ts` — skill getCalendarEvents (~60 líneas)
- [ ] `lib/skills/google/gmail.ts` — skill getRecentEmails (~80 líneas)
- [ ] `lib/skills/google/heuristics.ts` — email importance scoring (~50 líneas, portado de Antigravity)
- [ ] `app/api/auth/google/route.ts` — OAuth consent + callback (~40 líneas)
- [ ] `app/herramientas/page.tsx` — UI per-user connections (~100 líneas)
- [ ] Modificar `lib/skills/loader.ts` — `loadUserConnection()` helper (~20 líneas)
- [ ] Agregar `google` al tool catalog en `lib/tools/executor.ts`
- [ ] Agregar tools al master agent `analista`: `ARRAY[..., 'google']`
- [ ] Tests: calendar + gmail skills con mocks, loader con user connections
- [ ] Test E2E: "Tenés reunión con X — hace N días que no compran"

### Migración futura: Odoo per-user

Cuando se quiera restringir permisos de Odoo por usuario:
1. Cada usuario conecta su propia cuenta Odoo desde /herramientas
2. Se guarda en `user_connections` (type='odoo', config={url,db,user,password})
3. `loadSkillsForAgent` busca primero `user_connections` (per-user), fallback a `integrations` (per-tenant)
4. Los access rights de Odoo restringen qué ve cada uno automáticamente
5. No requiere cambios en skills — solo en el loader de credenciales

Esto es post-PMF. Para el piloto, Odoo per-tenant alcanza.

### Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| OAuth consent screen lento de aprobar | Bloquea Google tools | Modo "testing" con 100 users alcanza para piloto |
| Gmail es invasivo para empresas | Rechazo del usuario | Opt-in explícito con explicación clara, solo lectura |
| Tokens OAuth expiran | Tools dejan de funcionar | Refresh token automático (ya resuelto en Antigravity) |
| Costo API Google | $$ | Calendar y Gmail API gratis hasta 1M requests/día |
| Permisos de Odoo per-user cambia el loader | Refactor loader | Tabla `user_connections` genérica, fallback a `integrations` |

---

## 🔜 FASE 8: PILOTO CEDENT (~0.5 días)

> **Objetivo:** Validar uso real sin intervención  
> **Requiere:** F7 + F7.5 + F5 + F7.6 funcionando  
> **Opcional pre-piloto:** F7.7 (Google) enriquece pero no bloquea

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
| 210 | Agent sync fix | **210 sync_slug_name_icon** (ya en disco) |
| 211-212 | Intelligence | **211 company_discovery, 212 intelligence** |
| 213-219 | Engagement (Push) | 213 push_subscriptions |
| 214 | Google Integration | **214 google_connections** (F7.7, si se implementa) |

⚠️ **Duplicados conocidos:** 120×2 (`add_auth_user_id` + `meli_force_tool_execution`), 203×2 (`memories` + `platform_admin`). No bloquean — Supabase corre por orden alfabético.

### Estructura de archivos

```
lib/
├── agents/           # Orquestación y routing
├── skills/           # Tools para Gemini (odoo/, memory/, google/)
├── chat/             # Engine de conversación
├── company/          # Contexto de empresa
├── push/             # Push notifications (F5)
├── intelligence/     # Curious Analyst Agent + Briefings (F7.6, absorbe F6)
├── platform/         # Super admin auth (F7)
├── rag/              # Procesamiento de documentos (F7)
├── errors/           # Manejo de errores amigables
└── tools/            # Executor + definiciones

app/
├── super-admin/      # UI platform admin (F7)
├── api/push/         # Push subscription API (F5)
├── api/cron/         # Cron jobs (F7.6 intelligence + briefings)
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

Semana 1 (F7.5 — Company Discovery — 1 sesión):
├── Migration 211 + lib/company/discovery*.ts + API route
├── Enriquecer context-injector.ts con discovery_profile
└── Tests + corrida contra Cedent real

Semana 2 (F7.6a — Intelligence: Profiles + Engine — 2 sesiones):
├── S1: Migration 212 + profiles/ + context-assembler + tests
├── S2: investigator + synthesizer + engine + delivery + tests
└── S2: Integrar session opener en chat + memory-enricher hook

Semana 2 (F7.6b — Intelligence: Cron + Polish — 1 sesión):
├── Cron matutino + vercel.json
├── Onboarding flow (user sin profile)
└── Feedback tracking + eval contra Cedent

Semana 3 (F5 — PWA + Push — 1.5 días):
├── Día 1: manifest.json + sw.js + push sender + subscribe API
└── Día 2: hook + toggle component + tests

Semana 3 (F7.7 — Google + Per-User Connections — 2 días, opcional):
├── Día 1: user_connections migration + OAuth flow + calendar skill + tests
└── Día 2: gmail skill + heuristics + /herramientas UI + tests

Semana 3-4 (F8 — Piloto):
├── Setup Cedent + onboarding
├── Silencio 5 días, medir uso + insights
└── Contactar, feedback

Semana 4:
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
lib/crypto.ts                       # AES-256-GCM encrypt/decrypt (Phase 0)
lib/prometeo/notifier.ts            # Push notifications + in-app + email
lib/company/discovery.ts            # Company discovery desde Odoo
lib/user/discovery.ts               # User profile discovery
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

# F5 — PWA + Push (1.5 días, ANTES de F7.6)
public/manifest.json
public/sw.js
lib/push/sender.ts
app/api/push/subscribe/route.ts
lib/hooks/use-push-notifications.ts
components/PushNotificationToggle.tsx

# F7.5 — Company Discovery (1 sesión)
supabase/migrations/211_company_discovery.sql
lib/company/discovery.ts
lib/company/discovery-synthesizer.ts
lib/company/discovery-runner.ts
tests/unit/discovery.test.ts
app/api/admin/discover/route.ts

# F7.6 — Intelligence Layer + Briefings (3 sesiones, absorbe F6)
supabase/migrations/212_intelligence.sql                   # F7.6a S1
lib/intelligence/types.ts                                  # F7.6a S1
lib/intelligence/profiles/extract-profile.ts               # F7.6a S1
lib/intelligence/profiles/user-profile.ts                  # F7.6a S1
lib/intelligence/profiles/memory-enricher.ts               # F7.6a S1
lib/intelligence/context-assembler.ts                      # F7.6a S1
lib/intelligence/investigator.ts                           # F7.6a S2
lib/intelligence/synthesizer.ts                            # F7.6a S2
lib/intelligence/engine.ts                                 # F7.6a S2
lib/intelligence/history.ts                                # F7.6a S2
lib/intelligence/delivery.ts                               # F7.6a S2
app/api/cron/intelligence/route.ts                         # F7.6b (cron + push delivery)
tests/unit/intelligence/extract-profile.test.ts
tests/unit/intelligence/context-assembler.test.ts
tests/unit/intelligence/investigator.test.ts
tests/unit/intelligence/synthesizer.test.ts
tests/unit/intelligence/engine.test.ts
tests/unit/intelligence/delivery.test.ts
tests/unit/intelligence/memory-enricher.test.ts
# Spec completa: INTELLIGENCE_LAYER_PLAN.md
# F6 (Briefings) NO tiene archivos propios — absorbido por F7.6

# F7.7 — Google Integration + Per-User Connections (2 días, opcional pre-piloto)
supabase/migrations/214_user_connections.sql                # tabla genérica per-user
lib/skills/google/auth.ts                                  # OAuth helper + refresh
lib/skills/google/calendar.ts                              # skill getCalendarEvents
lib/skills/google/gmail.ts                                 # skill getRecentEmails
lib/skills/google/heuristics.ts                            # portado de Antigravity
app/api/auth/google/route.ts                               # consent + callback
app/herramientas/page.tsx                                  # UI per-user connections
components/UserConnectionsPanel.tsx                        # cards por integración
tests/unit/google/calendar.test.ts
tests/unit/google/gmail.test.ts
tests/unit/google/user-connections.test.ts
```

### Principios

1. **Mínimo viable** — Solo lo necesario para validar
2. **Tests primero** — No mergear si evals bajan
3. **Descripciones > Prompts** — <500 tokens prompt, descripciones ricas
4. **Archivos < 200 líneas** — Un archivo = una responsabilidad
5. **Config en DB** — Nuevo agente = INSERT, no deploy

---

*Última actualización: 2026-02-18*  
*PRs mergeados: #2-#32 | Branch activo: `fix/phase0-hardening`*  
*Spec técnica detallada: `TUQUI_REFACTOR_SPECS.md`*  
*Intelligence Layer spec: `INTELLIGENCE_LAYER_PLAN.md`*  
*Versión anterior archivada: `docs/archive/TUQUI_REFACTOR_PLAN_v3.md`*  
*Filosofía: Ship > Perfect*
