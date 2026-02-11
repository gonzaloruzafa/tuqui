# 🧠 TUQUI REFACTOR v4 — ROAD TO PMF

> **Filosofía:** Llegar a PMF primero, infraestructura enterprise después  
> **Principio:** Usuarios pagando > Features perfectas  
> **Para:** Un founder que necesita validar antes de escalar  
> **Última actualización:** 2026-02-10

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

### Checklist

- [ ] Migration `300_master_documents.sql` (tablas master_documents, master_document_chunks, master_agent_documents)
- [ ] Migration `301_fix_match_documents.sql` (UNION query tenant + master docs)
- [ ] `lib/platform/auth.ts` (isPlatformAdmin, requirePlatformAdmin)
- [ ] `/super-admin/agents` (lista master agents)
- [ ] `/super-admin/agents/[slug]` (editor con prompt, tools, docs)
- [ ] `components/super-admin/MasterAgentEditor.tsx`
- [ ] `components/super-admin/MasterDocUpload.tsx`
- [ ] `app/api/super-admin/agents/[slug]/documents/route.ts`
- [ ] `lib/rag/master-documents.ts` (procesador PDF/TXT → chunks + embeddings)
- [ ] Subir PDFs: Ley IVA, Ley Ganancias, LCT, Ley Sociedades

### Tests

```typescript
// tests/unit/platform-auth.test.ts
- isPlatformAdmin('gr@adhoc.inc') → true
- isPlatformAdmin('random@gmail.com') → false
- isPlatformAdmin(null) → false

// tests/unit/master-documents.test.ts
- processMasterDocument: chunking con overlap correcto
- processMasterDocument: genera embeddings para cada chunk
- processMasterDocument: maneja PDF y TXT

// tests/unit/match-documents.test.ts
- match_documents retorna docs del tenant
- match_documents retorna docs del master agent vinculado
- match_documents NO retorna docs de otros tenants
- match_documents respeta threshold

// tests/evals (manual post-deploy)
- "¿Cuál es la alícuota de IVA?" → responde con cita de ley
- "¿Qué dice la LCT sobre vacaciones?" → responde con artículo
```

### Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| `pdf-parse` pesado en serverless | Timeout en docs grandes | Chunks < 1000 chars, procesar async |
| IVFFlat index con pocos vectores | Performance pobre | Empezar sin index, agregar con >1000 chunks |
| Embeddings cost para docs grandes | $$ en API calls | Batch de 20 chunks, cachear embeddings |

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
- [ ] Migration `310_push_subscriptions.sql`
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

- [ ] Migration `320_briefing_config.sql`
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
| 200-299 | Core features | 200 company_context, 203 memories, 204 memory_tool, 205 fix_duplicates |
| 300-309 | Platform admin (RAG) | 300 master_documents, 301 fix_match_documents |
| 310-319 | Engagement (Push) | 310 push_subscriptions |
| 320-329 | Engagement (Briefings) | 320 briefing_config |

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
Semana 1 (F7 — Master Agents + RAG):
├── Día 1: Migrations + lib/platform/auth.ts + lib/rag/master-documents.ts + tests
├── Día 2: Super admin pages (lista + editor) + upload component
├── Día 3: API upload + procesador + subir PDFs de prueba + tests

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
# F7 — Master Agents + RAG (PRIMERA)
supabase/migrations/300_master_documents.sql
supabase/migrations/301_fix_match_documents.sql
lib/platform/auth.ts
lib/rag/master-documents.ts
app/super-admin/agents/page.tsx
app/super-admin/agents/[slug]/page.tsx
components/super-admin/MasterAgentEditor.tsx
components/super-admin/MasterDocUpload.tsx
app/api/super-admin/agents/[slug]/documents/route.ts

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

*Última actualización: 2026-02-10*  
*PRs mergeados: #2-#10 | PR abierto: #11 (feat/memory)*  
*Spec técnica detallada: `TUQUI_REFACTOR_SPECS.md`*  
*Versión anterior archivada: `docs/archive/TUQUI_REFACTOR_PLAN_v3.md`*  
*Filosofía: Ship > Perfect*
