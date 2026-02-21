# 🧠 TUQUI REFACTOR v3 - LEAN & TESTEABLE

> **Filosofía:** Código mínimo, tests máximos, escalable sin prompts monstruosos  
> **Principio:** La inteligencia viene de buenas descripciones, no de prompts enormes  
> **Para:** Un founder que no es developer pero controla calidad via tests y LLMs  
> **Última actualización:** 2026-02-09

---

## 📖 CONTEXTO DEL PROYECTO

### ¿Qué es Tuqui?

Tuqui es una plataforma de **agentes de IA empresariales** que se conecta a los sistemas de una empresa (ERP, email, MercadoLibre, bancos, AFIP) para responder preguntas de negocio en lenguaje natural.

**Visión:** Ser el "cerebro de tu empresa" - una interfaz conversacional que entiende tu negocio y te da respuestas inteligentes, no solo datos crudos.

**Diferenciación:**
- No es un chatbot genérico → Entiende TU empresa
- No es solo un dashboard → Es conversacional y proactivo
- No requiere saber SQL → Lenguaje natural

### Contexto de Adhoc

Tuqui nace de **Adhoc S.A.**, el Odoo Gold Partner más grande de Argentina con 100+ clientes enterprise. Esto da:
- Acceso a clientes reales para validar
- Conocimiento profundo de ERPs y procesos de negocio
- Pero también el riesgo de quedar "atado a Odoo" cuando Odoo 19 trae IA nativa

### Problema que resolvemos

Los dueños de PyMEs quieren respuestas rápidas:
- "¿Cuánto vendimos este mes?" → Hoy: abrir Odoo, buscar reporte, filtrar...
- "¿Quién nos debe más?" → Hoy: exportar a Excel, ordenar, analizar...
- "¿Estoy caro en MercadoLibre?" → Hoy: buscar manualmente, comparar...

**Tuqui:** Una pregunta → Una respuesta con contexto e insights.

---

## 🏗️ DECISIONES DE ARQUITECTURA

### ¿Por qué agentes especializados y no un solo agente?

**Discusión:** Evaluamos tener un solo agente con todos los tools vs múltiples agentes especializados.

**Decisión:** Múltiples agentes, cada uno con su prompt y tools.

**Razones:**
1. **Prompts especializados:** El agente "contador" sabe que siempre debe advertir "consultá con tu contador". El agente "odoo" sabe los defaults de períodos.
2. **Tools acotados:** Un agente con 50 tools confunde al LLM. Mejor 5 agentes con 10 tools cada uno.
3. **Escalabilidad:** Agregar un agente "Amazon" es un INSERT, no refactorear el prompt de 3000 tokens.
4. **Reutilización de tools:** `web_search` se usa en contador, legal, y meli. Cada uno con distinto contexto.

```
┌─────────────────────────────────────────────────────────────────┐
│                      MASTER_AGENTS (DB)                         │
├─────────────────────────────────────────────────────────────────┤
│ tuqui:     prompt general + [web_search, rag]                  │
│ contador:  prompt contable + [web_search, rag]                 │
│ abogado:   prompt legal + [web_search, rag]                    │
│ odoo:      prompt BI + [odoo_skills, rag]                      │
│ meli:      prompt mercado + [web_search]                       │
│ (futuro) amazon: prompt amazon + [web_search]                  │
│ (futuro) gmail: prompt email + [gmail_tools]                   │
└─────────────────────────────────────────────────────────────────┘
```

### ¿Por qué un orquestador LLM y no keywords?

**Problema anterior:** Router con ~400 líneas de keywords hardcodeados:
```typescript
// ❌ Frágil y no escalable
const SPECIALTY_KEYWORDS = {
  'erp': ['venta', 'ventas', 'vendimos', 'factura', ...], // 80+ keywords
  'mercado': ['mercadolibre', 'meli', 'precio de mercado', ...],
  // ...
}
```

**Problemas:**
- "¿Cuánta guita hicimos?" → No matchea "guita" → Va al agente equivocado
- Agregar agente nuevo → Agregar keywords → Código crece
- Ambigüedades difíciles de resolver con reglas

**Decisión:** Orquestador LLM que lee descripciones de la DB.

```typescript
// ✅ Simple y escalable
const agents = await getAgentsFromDB() // Incluye description de cada uno
const result = await classifyIntent(message, agents)
// El LLM entiende semántica, no solo keywords
```

**Beneficios:**
- "guita" → entiende que es dinero → agente odoo ✅
- Nuevo agente → INSERT en DB con buena descripción → funciona
- ~100 líneas vs ~400 líneas

### ¿Por qué la inteligencia en descripciones y no en prompts?

**Patrón de la industria:** OpenAI, Anthropic, y todos los frameworks recomiendan:
> "Tool definitions become part of the context on every LLM call. When you have multiple tools available, clear and specific descriptions become even more critical for the model to make the right tool selection."

**Implicación:** No necesitás un prompt de 3000 tokens diciéndole al LLM "si el usuario dice X, usá tool Y". El LLM es inteligente - dale buenas descripciones y él decide.

```typescript
// ❌ Prompt monstruoso
systemPrompt = `
Si el usuario pregunta por ventas, usá get_sales_total.
Si el usuario pregunta "cuánta guita", también usá get_sales_total.
Si el usuario pregunta por stock, usá get_product_stock.
... (500 líneas más de "si X entonces Y")
`

// ✅ Descripciones ricas en cada tool
get_sales_total.description = `
Obtiene ventas totales de un período.
USAR CUANDO: "cuánto vendimos", "facturación", "ingresos", "guita que hicimos"
DEFAULT: mes actual si no se especifica período
`
```

### ¿Por qué Memory como Tool y no como Contexto?

**Discusión:** ¿La memoria conversacional se inyecta siempre o se usa on-demand?

**Decisión:** Híbrido
- **Company Context** (info de la empresa) → Siempre inyectado (~200 tokens, poco)
- **Memory conversacional** (notas de conversaciones) → Como tool (el LLM decide cuándo buscar)

**Razones:**
1. No gastar tokens en memoria irrelevante
2. El LLM sabe cuándo necesita contexto previo
3. La empresa no cambia, las conversaciones sí

### ¿Por qué credenciales por usuario y no por tenant?

**Problema actual:** Un set de credenciales de Odoo para todo el tenant.
- Todos ven todos los datos
- Usuario se va → sigue teniendo acceso implícito
- No hay trazabilidad de quién consultó qué

**Decisión:** Cada usuario conecta SU cuenta.

```
/settings/connections
├── Odoo: "Conectar mi cuenta de Odoo"
├── Gmail: "Autorizar mi Gmail"
└── MercadoLibre: "Conectar mi cuenta de MeLi"
```

**Beneficios:**
- Permisos vienen de Odoo (si tu user no ve Compras, Tuqui tampoco)
- Usuario se va → se borran sus credenciales → no accede más
- Trazabilidad: sabemos quién preguntó qué

---

## 📍 ESTADO ACTUAL

| Campo | Valor |
|-------|-------|
| Fase actual | F4 completada → F5 siguiente |
| Branch actual | `feat/memory` (PR #11) |
| Último merge | PR #10 — Phase 3 F3.1→F3.5 |
| Unit tests | ~337 passing (~1.5s) |
| Eval test cases | 75 (67 originales + 8 quality) |
| Baseline L1→L5 | 98.5% (66/67) |
| Quality baseline | 100% corrección, 75% insights |
| Modelo | gemini-3-flash-preview |
| Engine | llm-engine.ts (V2, V1 eliminado) |
| Skills Odoo | 36 |
| Memory Skills | 2 (recall_memory, save_memory) |
| Tenant Isolation | ✅ Fix dd4b223 (23 archivos, ~45 queries) |

### Progreso General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✅ COMPLETADO                                                               │
│   └─ F0: Tests Baseline              [x] ██████████ 100%                   │
│   └─ F1: Orquestador LLM Lean        [x] ██████████ 100%                   │
│   └─ F2: Company Context             [x] ██████████ 100%                   │
│   └─ F3: Skills & Inteligencia       [x] ██████████ 100%                   │
│       ├─ F3.1: Rich Skill Descriptions    ✅                                │
│       ├─ F3.2: Categorías de Producto     ✅                                │
│       ├─ F3.3: Progressive Improvement    ✅ (loop L1→L5, 98.5%)           │
│       ├─ F3.4: Deprecar V1               ✅ (native-gemini → llm-engine)   │
│       ├─ F3.5: RAG Cleanup               ✅ (rag_enabled eliminado)        │
│       └─ F3.6: Quality Evals             ✅ (insightScore + 8 test cases)  │
│   └─ F4: Memory Tool                 [x] ██████████ 100%                   │
│       ├─ F4.1: Tabla memories             ✅ (203 + 204 migrations)        │
│       ├─ F4.2: recall_memory              ✅ (ILIKE search, user-scoped)   │
│       ├─ F4.3: save_memory                ✅ (auth UUID fix)               │
│       ├─ F4.4: Wired into executor        ✅ (memory tool in catalog)      │
│       ├─ F4.5: Admin UI                   ✅ (real icons, knowledge_base)  │
│       └─ F4.6: Tests + UX                 ✅ (27 tests, friendly errors)   │
│   └─ F4.7: Tenant Isolation Fix       [x] ██████████ 100%                   │
│       └─ 23 archivos, ~45 queries con .eq('tenant_id') explícito            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔜 SIGUIENTE                                                                │
│   └─ F5: User Credentials & Onboard  [ ] ⬜⬜⬜⬜⬜ 0%                      │
│   └─ F6: Infraestructura (PWA/Push)  [ ] ⬜⬜⬜⬜⬜ 0%                      │
│   └─ F7: Features (Briefings/Alertas)[ ] ⬜⬜⬜⬜⬜ 0%                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 PRINCIPIOS DEL REFACTOR

### 1. MENOS CÓDIGO = MENOS BUGS
- Cada línea de código es un bug potencial
- Si algo se puede hacer con configuración (DB), no hacerlo en código
- Los prompts van en la DB, no hardcodeados
- **Meta:** Archivos de menos de 200 líneas

### 2. TESTS COMO DOCUMENTACIÓN VIVA
- Si no hay test, no existe la feature
- Los tests son tu safety net para hacer cambios con confianza
- Agent evals = tu métrica de calidad (#1 priority)
- **Meta:** No mergear PR si evals bajan

### 3. LA INTELIGENCIA ESTÁ EN LAS DESCRIPCIONES
- El LLM es inteligente, no lo subestimes
- Buenas descripciones de agentes/tools > prompts enormes
- Dejar que el modelo decida (`tool_choice: auto`)
- **Meta:** Prompts de agentes < 500 tokens

### 4. ESCALABLE SIN TOCAR CÓDIGO
- Nuevo agente = INSERT en DB, no PR
- Nuevo tool = archivo + registro, no refactor
- Nuevo tenant = configuración, no deploy
- **Meta:** 0 código para agregar agente nuevo

---

## 📊 ARQUITECTURA

### Vista General

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO                                 │
│                    "¿Cuánta guita hicimos?"                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORQUESTADOR LLM (~100 líneas)                │
│                                                                 │
│  Lee de DB: agents.description (DINÁMICO, no hardcodeado)      │
│  Prompt: "Clasificá → respondé solo el slug"                   │
│  Output: "odoo"                                                │
│                                                                 │
│  ~100 tokens por clasificación                                 │
│  Entiende semántica ("guita" = dinero = ventas)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTE SELECCIONADO (DB)                     │
│                                                                 │
│  agents.system_prompt  → Prompt especializado (~500 tokens)    │
│  agents.tools[]        → ["get_sales_total", "get_top_products"]│
│  agents.rag_enabled    → true/false                            │
│                                                                 │
│  + company_context (inyectado, ~200 tokens)                    │
│  + user_credentials (del usuario que pregunta)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         GEMINI                                  │
│                                                                 │
│  tool_choice: "auto"                                           │
│  El modelo decide qué tool usar basado en descripciones        │
│                                                                 │
│  La inteligencia está en: tool.description                     │
└─────────────────────────────────────────────────────────────────┘
```

### Agentes Actuales

| Slug | Descripción | Tools | RAG |
|------|-------------|-------|-----|
| `tuqui` | Conversación general, fallback | web_search | ✅ |
| `odoo` | Datos internos: ventas, stock, clientes, cobranzas | odoo_skills (20+) | ✅ |
| `meli` | Precios de MercadoLibre, competencia | web_search | ❌ |
| `contador` | Impuestos argentinos, IVA, Monotributo | web_search | ✅ |
| `abogado` | Leyes argentinas, contratos, laboral | web_search | ✅ |
| `cedent` | Específico para cliente Cedent (productos dentales) | odoo_skills | ✅ |

### Escalabilidad sin Código

| Acción | Cómo hacerlo | ¿Tocar código? |
|--------|--------------|----------------|
| Agregar agente nuevo | INSERT en `master_agents` o desde /admin/agents | ❌ No |
| Cambiar descripción de agente | UPDATE en DB o desde UI | ❌ No |
| Agregar tool a agente | Editar `tools[]` del agente en DB/UI | ❌ No |
| Crear skill nuevo | Archivo en `lib/skills/` + registrar | ✅ Sí (mínimo) |
| Nuevo tenant | INSERT + configuración | ❌ No |

---

## 📋 ROADMAP DETALLADO

### Resumen

| Fase | Tiempo | Descripción | Estado |
|------|--------|-------------|--------|
| F0 | 2h | Tests Baseline - Establecer métricas | ✅ Completado |
| F1 | 3h | Orquestador LLM - Reemplazar router | ✅ Completado |
| F2 | 3h | Company Context - Tuqui conoce la empresa | ✅ Completado |
| F3 | ~15h | Skills & Inteligencia (6 sub-fases) | ✅ Completado |
| F4 | ~6h | Memory + Tenant Isolation + UX | ✅ Completado |
| F5 | 8h | User Credentials & Onboarding | 🔜 Siguiente |
| F6 | 6h | Infraestructura - PWA, Push | ⬜ Pendiente |
| F7 | 6h | Features - Briefings, Alertas | ⬜ Pendiente |

**Total estimado: ~36 horas** | **Completado: ~29 horas** | **36 skills + 2 memory, ~337 tests, 75 evals**

---

## ✅ FASE 0: TESTS BASELINE - COMPLETADA

> **Objetivo:** Saber dónde estás antes de cambiar algo

### Resultados

| Métrica | Valor |
|---------|-------|
| Pass Rate | 73.2% (52/67 tests) |
| Pass Rate sin rate limits | ~98% |
| Tests totales | 67 casos + 1 threshold |
| Threshold CI | 80% |
| Delay entre tests | 25s (mitigación rate limits) |

### Lecciones aprendidas
- Gemini tiene rate limits agresivos en plan gratuito
- Los tests sirven como documentación de qué debe funcionar
- El threshold de 80% es alcanzable mejorando descripciones

---

## ✅ FASE 1: ORQUESTADOR LLM LEAN - COMPLETADA

> **Objetivo:** Reemplazar ~400 líneas de keywords con ~100 líneas de LLM

### Implementación

**Archivo:** `lib/agents/orchestrator.ts` (~100 líneas)

```typescript
// Funciones principales
orchestrate(tenantId, message, history) → { agent, confidence }
getAvailableAgents(tenantId) → Agent[]
classifyIntent(message, agents) → slug
```

**Cómo funciona:**
1. Obtiene agentes activos del tenant con sus descripciones
2. Construye prompt dinámico: "Clasificá entre estos agentes: [descripciones]"
3. Gemini retorna el slug del agente más apropiado
4. Se carga ese agente con su prompt y tools

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `lib/agents/orchestrator.ts` | Nuevo (~100 líneas) |
| `lib/chat/engine.ts` | Usa `orchestrate()` en vez de `routeMessage()` |
| `app/api/chat/route.ts` | Migrado |
| `app/api/internal/chat-test/route.ts` | Migrado |
| `lib/agents/router.ts` | Renombrado a `.deprecated.ts` |

### Commit
```
a6559d0 - feat(F1): LLM orchestrator replaces keyword router
- 13 files changed, 352 insertions(+), 126 deletions(-)
```

---

## ✅ FASE 2: COMPANY CONTEXT — COMPLETADA

> **Completado:** 2026-02-06. Company context se inyecta universalmente. UI en /admin/company.
> **Objetivo:** Tuqui conoce la empresa sin prompts enormes

### ¿Por qué es importante?

Sin contexto de empresa, Tuqui da respuestas genéricas:
- ❌ "Vendiste $4.2M en enero"
- ✅ "Vendiste $4.2M en enero. Cedent (tu cliente más grande) bajó 40%."

### Implementación

#### 2.1: Tabla `company_contexts`

```sql
-- supabase/migrations/200_company_context.sql
CREATE TABLE IF NOT EXISTS company_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Conocimiento estructurado (no texto libre)
  key_products JSONB DEFAULT '[]',    -- [{ name, notes }]
  key_customers JSONB DEFAULT '[]',   -- [{ name, notes }]
  key_suppliers JSONB DEFAULT '[]',   -- [{ name, notes }]
  business_rules JSONB DEFAULT '[]',  -- ["Regla 1", "Regla 2"]
  
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);
```

**¿Por qué JSONB estructurado y no texto libre?**
- Texto libre → "Nuestro cliente más importante es Cedent que nos compra mucho"
- Estructurado → `{ name: "Cedent", notes: "Cliente más importante" }`
- Beneficios: Editable en UI, validable, no depende de cómo escriba el admin

#### 2.2: Inyector de contexto (~30 líneas)

```typescript
// lib/company/context-injector.ts

export async function getCompanyContext(tenantId: string): Promise<string> {
  const { data: tenant } = await db.from('tenants').select('*').eq('id', tenantId).single()
  const { data: ctx } = await db.from('company_contexts').select('*').eq('tenant_id', tenantId).single()
  
  const parts = []
  
  // Info básica del tenant
  if (tenant?.name) parts.push(`Empresa: ${tenant.name}`)
  if (tenant?.industry) parts.push(`Rubro: ${tenant.industry}`)
  
  // Contexto enriquecido
  if (ctx?.key_customers?.length) {
    const customers = ctx.key_customers.map(c => 
      c.notes ? `${c.name} (${c.notes})` : c.name
    ).join(', ')
    parts.push(`Clientes importantes: ${customers}`)
  }
  
  if (ctx?.business_rules?.length) {
    parts.push(`Reglas de negocio: ${ctx.business_rules.join('. ')}`)
  }
  
  return parts.join('\n')
}
```

**Ejemplo de output:**
```
Empresa: Cedent S.A.
Rubro: Distribuidora de productos odontológicos
Clientes importantes: MegaDent (mayor volumen), OdontoPlus (siempre paga tarde)
Reglas de negocio: Margen mínimo 30%. No vender a monotributistas sin anticipo.
```

#### 2.3: UI en /admin/company

Mejorar la página existente:
- Campos estructurados para clientes, productos, proveedores
- Lista editable de reglas de negocio
- Preview de cómo queda el contexto

#### 2.4: Tests

```typescript
describe('Company Context', () => {
  test('genera contexto conciso', async () => {
    const ctx = await getCompanyContext('test-tenant')
    expect(ctx.length).toBeLessThan(500) // Debe ser conciso
  })
  
  test('incluye clientes importantes', async () => {
    const ctx = await getCompanyContext('cedent-tenant')
    expect(ctx).toContain('MegaDent')
  })
})
```

### Checklist F2

- [x] Migration `200_company_context.sql` creada y aplicada
- [x] `lib/company/context-injector.ts` implementado
- [x] UI en `/admin/company`
- [x] Contexto se inyecta en `build-system-prompt.ts`
- [x] Tests pasan
- [x] Evals no bajan

---

## ✅ FASE 3: SKILLS & INTELIGENCIA — COMPLETADA

> **Completado:** 2026-02-08. 6 sub-fases ejecutadas. Ver PHASE-3-PLAN.md para detalle.
> **Objetivo:** La inteligencia está en las descripciones de los tools, no en prompts

### Lo que se hizo

| Sub-fase | Qué | Resultado |
|----------|-----|-----------|
| F3.1 | Rich Skill Descriptions | 32 skills con template USAR CUANDO/NO USAR/RETORNA |
| F3.2 | Categorías de Producto | `get_sales_by_category` + `categoryName` en 5 outputs |
| F3.3 | Progressive Improvement Loop | Loop L1→L5 funcional, 98.5% pass rate |
| F3.4 | Deprecar V1 | `native-gemini.ts` eliminado, renombrado a `llm-engine.ts` |
| F3.5 | RAG Cleanup | `rag_enabled` eliminado, RAG es tool puro |
| F3.6 | Quality Evals | `insightScore` en auditor, 8 test cases quality |

### Métricas finales F3

| Métrica | Inicio F3 | Final F3 |
|---------|-----------|----------|
| Unit tests | 272 | 310 |
| Eval cases | 69 | 75 |
| Skills Odoo | 35 | 36 |
| Baseline L1→L5 | N/A | 98.5% |
| Quality insights | N/A | 75% |
| V1 engine | Vivo | Eliminado |
| `rag_enabled` | En 10+ archivos | 0 |

### ¿Por qué es importante?

El LLM decide qué tool usar basándose SOLO en las descripciones. Si la descripción es pobre, elige mal.

```typescript
// ❌ Descripción pobre → LLM no sabe cuándo usar
description: 'Obtiene el total de ventas'

// ✅ Descripción rica → LLM entiende contexto
description: `Obtiene el total de ventas de un período.

USAR CUANDO: "cuánto vendimos", "total de ventas", "facturación", 
"cuánta guita hicimos", "revenue", "ingresos"

NO USAR: Para precios de mercado (usar web_search)

PARÁMETROS:
- period: 'today' | 'this_week' | 'this_month' (default) | 'last_month' | 'this_year'

RETORNA: { total: number, count: number, currency: string }`
```

### Implementación

#### 3.1: Auditar descripciones actuales

```bash
# Ver qué tenemos
grep -r "description:" lib/skills/odoo/*.ts | head -20
```

#### 3.2: Template para descripciones

Cada skill debe tener:
1. **Qué hace** (1 línea)
2. **USAR CUANDO** (ejemplos de queries del usuario)
3. **NO USAR** (para desambiguar)
4. **PARÁMETROS** (con defaults)
5. **RETORNA** (estructura del output)

#### 3.3: Skills prioritarios a mejorar

| Skill | Prioridad | Por qué |
|-------|-----------|---------|
| `get_sales_total` | Alta | Es el más usado |
| `get_sales_by_customer` | Alta | Confusión con "cliente" |
| `get_accounts_receivable` | Alta | "Quién nos debe" es común |
| `get_product_stock` | Media | "Tenemos stock" |
| `compare_sales_periods` | Media | Comparaciones temporales |

#### 3.4: Tests de selección

```typescript
// tests/evals/skill-selection.test.ts
describe('Skill Selection', () => {
  const cases = [
    // Variaciones de "ventas"
    { query: '¿Cuánto vendimos este mes?', expectedTool: 'get_sales_total' },
    { query: '¿Cuánta guita hicimos?', expectedTool: 'get_sales_total' },
    { query: 'Facturación de enero', expectedTool: 'get_sales_total' },
    
    // Variaciones de "deuda"
    { query: '¿Quién nos debe más?', expectedTool: 'get_debt_by_customer' },
    { query: 'Clientes morosos', expectedTool: 'get_debt_by_customer' },
    
    // Evitar confusiones
    { query: '¿Cuánto cuesta un iPhone?', expectedTool: 'web_search' }, // NO get_sales
  ]
  
  test.each(cases)('$query → $expectedTool', async ({ query, expectedTool }) => {
    const result = await executeQuery(query)
    expect(result.toolUsed).toBe(expectedTool)
  })
})
```

### Checklist F3

- [x] Descripciones de skills principales mejoradas (32 skills)
- [x] Template de descripción documentado y aplicado
- [x] Tests de selección creados (evals L1-L5)
- [x] Evals mejoran vs baseline (98.5%)
- [x] Improvement loop progresivo funcional
- [x] V1 engine eliminado
- [x] RAG cleanup
- [x] Quality evals con insightScore

---

## ✅ FASE 4: MEMORY + TENANT ISOLATION — COMPLETADA

> **Completado:** 2026-02-09. PR #11 en `feat/memory`. Verificado en producción (save + recall).
> **Objetivo:** Que Tuqui recuerde cosas entre conversaciones y las use para dar mejores respuestas

### El problema

Hoy cada conversación arranca de cero. El único contexto persistente es el de empresa (`company_contexts`), que se carga manualmente desde /admin.

```
[Lunes]  Juan: "MegaCorp siempre paga tarde, hay que llamarlos antes"
[Martes] Juan: "¿Cuánto nos debe MegaCorp?"
→ Tuqui no tiene idea de lo que dijo Juan ayer. Da el número pelado.

[Miércoles] María: "¿Cuánto nos debe MegaCorp?"
→ María tampoco sabe lo que Juan aprendió. Cada uno en su burbuja.
```

### Approach: memoria por usuario, simple

Cada usuario tiene su libretita. Lo que Juan anota, solo Juan lo ve. Sin scopes, sin moderación, sin complejidad.

```
[Lunes]  Juan: "Recordá que MegaCorp siempre pide factura A"
         Tuqui: "Anotado ✅"

[Martes] Juan: "¿Cuánto le vendimos a MegaCorp?"
         Tuqui busca memorias de Juan sobre "MegaCorp" → encuentra la nota
         → "Le vendiste $2M. Recordá que siempre piden factura A."
```

> **Fase futura:** Si hace falta compartir memorias entre usuarios (scope empresa),
> se agrega un campo `scope` a la tabla y un filtro en el query. No requiere refactor.

### ¿Por qué memory como TOOL y no siempre inyectado?

- **Company context** (~200 tokens): Siempre relevante → siempre inyectado. No cambia.
- **Memorias** (variable, puede ser mucho): Solo relevante cuando el usuario menciona una entidad específica → el agente decide cuándo buscar.

Si inyectás 50 memorias en cada request, estás gastando tokens al pedo el 90% del tiempo. Como tool, el agente solo busca cuando detecta una entidad:

```
Usuario: "¿Cuánto vendimos?"
→ No busca memorias. No hay entidad específica.

Usuario: "¿Cuánto le vendimos a MegaCorp?"
→ Busca memorias de "MegaCorp" → encuentra notas → enriquece respuesta
```

### Cómo se guardan las memorias

Dos mecanismos, ninguno bloquea la respuesta:

**A) El usuario dicta explícitamente:**
```
Usuario: "Recordá que MegaCorp siempre pide factura A"
→ Tuqui guarda y confirma: "Listo, anotado ✅"
```

**B) El LLM detecta automáticamente (post-respuesta, async):**
```
Usuario: "MegaCorp es nuestro cliente más difícil, siempre reclaman todo"
→ Tuqui responde normalmente
→ En background, analiza la conversación y extrae:
   { entity: "MegaCorp", note: "Cliente difícil, reclaman mucho" }
```

La opción A es más simple y confiable. La opción B es más mágica pero puede guardar cosas incorrectas. **Recomendación: empezar con A, agregar B después.**

### Plan de implementación

#### F4.1: Tabla `memories` (~30 min)

```sql
-- supabase/migrations/203_memories.sql
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Contenido
  entity_name TEXT,          -- 'MegaCorp', 'Producto X', null si es general
  entity_type TEXT,          -- 'customer', 'product', 'supplier', 'general'
  content TEXT NOT NULL,     -- 'Siempre pide factura A'
  
  -- Metadata
  use_count INT DEFAULT 0,   -- cuántas veces se usó en respuestas
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_memories_user ON memories(created_by);
CREATE INDEX idx_memories_entity ON memories(entity_name);
```

#### F4.2: Tool `recall_memory` (~30 min)

```typescript
// lib/skills/memory/recall.ts (~50 líneas)

export function createRecallMemoryTool(tenantId: string, userId: string) {
  return {
    name: 'recall_memory',
    description: `Busca notas y contexto guardado sobre un cliente, producto o proveedor.

USAR CUANDO: El usuario menciona un cliente, producto o proveedor específico
y querés saber si hay notas o contexto previo guardado.
NO USAR: Para datos de Odoo (ventas, stock, deudas) — usá los skills de Odoo.

PARÁMETROS:
- entity_name: Nombre o parte del nombre a buscar (ej: "MegaCorp", "adhesivo")
RETORNA: Lista de notas con fecha y quién la creó`,

    execute: async ({ entity_name }) => {
      const { data } = await db
        .from('memories')
        .select('entity_name, entity_type, content, created_at')
        .eq('created_by', userId)
        .ilike('entity_name', `%${entity_name}%`)
        .order('use_count', { ascending: false })
        .limit(5)

      if (!data?.length) return { found: false }

      return { found: true, notes: data }
    }
  }
}
```

#### F4.3: Tool `save_memory` (~30 min)

```typescript
// lib/skills/memory/save.ts (~40 líneas)

export function createSaveMemoryTool(tenantId: string, userId: string) {
  return {
    name: 'save_memory',
    description: `Guarda una nota sobre un cliente, producto o proveedor para recordar después.

USAR CUANDO: El usuario dice "recordá que...", "anotá que...", "tené en cuenta que..."
o te da información relevante sobre una entidad del negocio.
NO USAR: Para guardar datos temporales o de una sola vez.

PARÁMETROS:
- entity_name: Nombre del cliente/producto/proveedor
- entity_type: 'customer' | 'product' | 'supplier' | 'general'
- content: La nota a guardar (resumida, max 200 chars)
RETORNA: Confirmación`,

    execute: async ({ entity_name, entity_type, content }) => {
      await db.from('memories').insert({
        tenant_id: tenantId,
        created_by: userId,
        entity_name,
        entity_type: entity_type || 'general',
        content: content.slice(0, 200),
      })
      return { saved: true, message: `Anotado sobre ${entity_name} ✅` }
    }
  }
}
```

#### F4.4: Gestión de memorias (en el chat) (~30 min)

El usuario puede gestionar sus memorias desde el chat:
```
Usuario: "¿Qué tenés anotado?"       → lista todas sus memorias
Usuario: "Olvidate de MegaCorp"       → borra memorias de esa entidad
Usuario: "Recordá que X pide factura A" → guarda
```

No hace falta UI dedicada por ahora. El LLM maneja todo conversacionalmente.

#### F4.5: Registrar tools en agentes (~30 min)

Agregar `recall_memory` y `save_memory` al array de tools de los agentes relevantes (odoo, tuqui) en la DB.

#### F4.6: Tests (~1h)

```typescript
// tests/unit/memory.test.ts
describe('Memory Tools', () => {
  test('save_memory guarda para el usuario', ...)
  test('recall_memory encuentra por entity_name', ...)
  test('recall_memory no muestra memorias de otros usuarios', ...)
  test('recall_memory retorna found:false si no hay memorias', ...)
})
```

### Qué NO hacer en F4

- ❌ Scope empresa / promover (agregar después si hace falta, es solo un campo + filtro)
- ❌ Extracción automática de insights (fase posterior)
- ❌ Embeddings/vector search (overkill para <1000 memorias, ILIKE alcanza)
- ❌ Memorias que se inyectan siempre (gastan tokens)
- ❌ UI dedicada de admin (el chat alcanza)

### Lo que se implementó

| Componente | Archivo | Descripción |
|------------|---------|-------------|
| Migration memories | `supabase/migrations/203_memories.sql` | Tabla + RLS policies |
| Migration tool | `supabase/migrations/204_add_memory_tool.sql` | Registra tool 'memory' con 2 skills |
| Migration dedup | `supabase/migrations/205_fix_duplicate_agents.sql` | UNIQUE constraint tenant+slug |
| Memory index | `lib/skills/memory/index.ts` | Factory de memory tools |
| Recall skill | `lib/skills/memory/recall.ts` | Búsqueda ILIKE por entity_name, user-scoped |
| Save skill | `lib/skills/memory/save.ts` | Guarda nota con entity_name/type/content |
| Tool defs | `lib/skills/memory/tools.ts` | Definiciones para Gemini |
| Executor | `lib/tools/executor.ts` | Wiring de memory tools, separa userId/userEmail |
| Auth fix | `lib/auth/config.ts` | Expone token.sub como session.user.id (UUID) |
| Friendly errors | `lib/errors/friendly-messages.ts` | Mapeo de errores técnicos → mensajes amigables |
| Streaming fix | `app/api/chat/route.ts` | Errores en stream ahora muestran mensaje friendly |
| Admin UI | `components/admin/ToolsForm.tsx` | Iconos reales (SVG), knowledge_base en catálogo |

### Commits (feat/memory)

```
dd4b223 fix: add tenant_id filtering to all cross-tenant unsafe queries
3047de0 fix: send friendly error message on token limit in streaming
f48d660 fix: memory save_memory used email instead of auth UUID
c60a5d9 feat: real icons in admin tools UI + knowledge_base in catalog
d975e90 feat: add delete agent functionality for custom agents
1c2bd6d fix: replace whatsapp with memory in tools catalog, add brain icon
4b2adb8 fix: prevent duplicate agents per tenant (UNIQUE constraint)
0e14977 feat: add memory tool to admin UI
2ff102e feat: add memory tool with recall and save skills
```

### Bugs encontrados y resueltos

| Bug | Causa raíz | Fix |
|-----|-----------|-----|
| `invalid input syntax for type uuid` en save_memory | `engine.ts` pasaba email como userId, pero `memories.created_by` es UUID | Separar `userEmail` (Odoo) de `userId` (auth UUID) |
| Token limit muestra "API Error" genérico | Streaming catch hacía `controller.error()` sin mensaje | Usa `getFriendlyError()` y envía texto amigable por el stream |
| Agentes duplicados en admin | Queries no filtraban por tenant_id | Agregar `.eq('tenant_id')` + UNIQUE constraint |
| Cross-tenant data leak | ~45 queries sin `.eq('tenant_id')` explícito | Fix masivo en 23 archivos (dd4b223) |

### Tenant Isolation Fix (dd4b223)

| Área | Riesgo | Archivos |
|------|--------|----------|
| Credenciales Odoo/Twilio | Tenant A veía credenciales de B | 4 archivos |
| Documentos RAG | Docs de Cedent aparecían en Logos | 4 archivos |
| Agentes | Agentes de otro tenant cargándose | 2 archivos |
| Chat/Mensajes | Historial de otro tenant legible | 2 archivos |
| Prometeo tasks | Tasks editables cross-tenant | 4 archivos |
| Notificaciones | Notificaciones leakeaban | 4 archivos |
| Billing/Push | Usage stats y push subs mezclados | 3 archivos |

> **Nota:** Este fix es prerequisito y compatible con F5 (user credentials).
> Cuando se migre a `user_credentials`, se agrega `.eq('user_id', userId)` además del `.eq('tenant_id')` que ya está.

### Verificación en producción

```
✅ save_memory: "recordá que Juan Pérez siempre pide descuento del 10%" → guardado
✅ recall_memory: "Qué sabés de Juan Pérez?" → "Tengo anotado que es un cliente
   que siempre pide un 10% de descuento"
✅ Token limit: muestra "⚠️ Límite mensual de tokens alcanzado" con detalle de uso
✅ Tenant isolation: queries con .eq('tenant_id') explícito en 23 archivos
```

### Checklist F4

- [x] Migration `203_memories.sql` creada
- [x] Migration `204_add_memory_tool.sql` creada
- [x] `lib/skills/memory/recall.ts` implementado
- [x] `lib/skills/memory/save.ts` implementado
- [x] Tools registrados en agentes relevantes (DB + admin UI)
- [x] Tests unitarios (14 memory + 13 friendly-messages = 27 nuevos)
- [x] Evals no bajan
- [x] Auth UUID fix (email → session.user.id)
- [x] Friendly error messages en streaming
- [x] Admin UI con iconos reales + knowledge_base
- [x] Tenant isolation fix (~45 queries en 23 archivos)
- [x] Verificado en producción

---

## ⬜ FASE 5: USER CREDENTIALS & ONBOARDING (~8 horas)

> **Objetivo:** Cada usuario aporta sus propias credenciales. Los permisos vienen de su cuenta, no compartidos.
> **Prerequisito:** ✅ Tenant isolation fix (dd4b223) — todos los queries ya tienen `.eq('tenant_id')`. Migrar a per-user es agregar `.eq('user_id')` encima.
> **Ver también:** `TENANT_MANAGEMENT_PLAN.md` para el plan de Super Admin UI (solapamiento parcial con F5.4)

> **Decisión de diseño (2026-02-20):** Split admin/usuario.
> - **Admin** configura URL y DB en `tenant_settings` (una vez para todo el tenant).
> - **Usuario** solo configura su API key personal (un campo, una vez en su vida).
> - Odoo maneja los permisos internamente → no duplicar lógica.
> - El mismo patrón aplica a Gmail, Google Calendar, Drive, Slack, etc.

### ¿Por qué es importante?

**Modelo actual (por tenant):**
```
Tenant "Cedent" → credentials: { odoo_user: "admin", odoo_pass: "xxx" }
                → TODOS los usuarios de Cedent usan las mismas credenciales
                → TODOS ven todos los datos
                → Usuario se va → sigue teniendo acceso implícito
```

**Modelo nuevo (por usuario):**
```
Tenant "Cedent"
  └─ Usuario "Juan" → SU cuenta de Odoo (solo ve sus ventas si Odoo lo limita)
  └─ Usuario "María" → SU cuenta de Odoo (ve todo si es gerente)
  └─ Usuario "Pedro" → No tiene Odoo configurado → no puede preguntar de ventas
```

### Implementación

#### 5.1: Tablas

```sql
-- supabase/migrations/500_user_credentials.sql

-- Admin configura la conexión del tenant (URL + DB, una vez)
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS odoo_url TEXT,
  ADD COLUMN IF NOT EXISTS odoo_db  TEXT;

-- Usuario configura solo su API key personal
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  provider TEXT NOT NULL,  -- 'odoo' | 'gmail' | 'calendar' | 'drive' | 'meli'
  api_key  TEXT NOT NULL,  -- encriptada con Supabase Vault
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, tenant_id, provider)
);
```

#### 5.2: UI para configurar conexiones

**Admin** (`/admin/settings/connections`):
```
├── 🔗 Odoo (configuración del tenant)
│   ├── URL: https://miempresa.odoo.com
│   └── Base de datos: miempresa
```

**Usuario** (`/settings/connections` o modal inline en el chat):
```
├── 🔗 Odoo → [un solo campo: API key] + [📹 ver video 45s]
├── 📧 Gmail → [Autorizar con Google] → OAuth
├── 📅 Calendar → [Autorizar con Google] → OAuth
├── 🗂️ Drive → [Autorizar con Google] → OAuth
├── 🛒 MercadoLibre → [Conectar mi cuenta] → OAuth
```

#### 5.6: Onboarding sin fricción (modal inline)

```
Usuario hace su primera pregunta sobre Odoo
→ Chat intercepta antes de llamar al skill
→ Muestra modal:

┌─────────────────────────────────────────────┐
│  🔗 Conectá tu Odoo para responder esto     │
│                                             │
│  [campo: pegá tu API key]                   │
│                                             │
│  📹 ¿No sabés cómo sacarla? Ver video (45s) │
│     → abre Loom embebido:                   │
│       1. Odoo > Settings > API Keys         │
│       2. New → nombre "Tuqui" → Copiar      │
│     → link directo a {odoo_url}/odoo/settings│
│                                             │
│  [Conectar →]              (5 segundos)     │
└─────────────────────────────────────────────┘

Conectado → transparente, ni lo ve
Key inválida/expirada → "Tu conexión expiró, renovála" + mismo modal
```

```
components/integrations/
├── ConnectProviderModal.tsx  # Modal genérico reutilizable por provider
└── IntegrationRequired.tsx  # Wrapper que intercepta en el chat

lib/integrations/
├── user-integrations.ts      # CRUD de keys en DB
└── providers.ts              # Config por provider (instrucciones, video url)
```

#### 5.3: Modificar skills para usar credenciales del usuario

```typescript
// lib/skills/context.ts (modificar)

export interface SkillContext {
  tenantId: string
  userId: string  // NUEVO: requerido
  
  getCredentials: (type: IntegrationType) => Promise<Credentials>
}

export async function createSkillContext(
  tenantId: string,
  userId: string
): Promise<SkillContext> {
  return {
    tenantId,
    userId,
    
    getCredentials: async (type) => {
      const { data, error } = await db
        .from('user_credentials')
        .select('config')
        .eq('user_id', userId)
        .eq('integration_type', type)
        .eq('is_active', true)
        .single()
      
      if (error || !data) {
        throw new Error(
          `No tenés ${type} configurado. ` +
          `Andá a Configuración → Conexiones para conectar tu cuenta.`
        )
      }
      
      return decrypt(data.config)
    }
  }
}
```

#### 5.4: Super-admin y gestión de tenants

```sql
-- Super admin flag
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT false;
```

```
/admin/tenants  (solo super-admin)
├── [+ Crear tenant]
│   ├── Nombre: _______________
│   ├── Slug: _______________
│   ├── Industria: _______________
│   └── Email del primer admin: _______________
│
├── Tenants existentes
│   ├── Cedent (5 usuarios, activo)
│   ├── OdontoPlus (3 usuarios, activo)
│   └── TestCorp (1 usuario, trial)
```

#### 5.5: Flujo de alta

```
1. Super-admin crea tenant en /admin/tenants
2. Se envía invitación al primer admin
3. Admin acepta, crea password, entra
4. Admin va a /settings/connections y configura SU Odoo
5. Admin invita usuarios desde /admin/users
6. Cada usuario configura SUS propias conexiones
7. Cada usuario solo ve datos según sus permisos de Odoo
```

### Checklist F5

- [ ] Migration `500_user_credentials.sql` (tenant_settings + user_integrations)
- [ ] UI `/admin/settings/connections` para admin (odoo_url + odoo_db)
- [ ] Componente `ConnectProviderModal.tsx` con campo API key + link video
- [ ] Componente `IntegrationRequired.tsx` que intercepta en el chat
- [ ] UI `/settings/connections` para usuario (ver/gestionar sus keys)
- [ ] Refactorear `createSkillContext` para usar `userId`
- [ ] Actualizar skills de Odoo para leer api_key de `user_integrations`
- [ ] Actualizar todos los skills para manejar error de "no configurado" → mostrar modal
- [ ] Grabar video Loom 45s de cómo sacar API key en Odoo
- [ ] Migration `is_super_admin`
- [ ] UI `/admin/tenants` para super-admin
- [ ] Flujo de invitación funcionando
- [ ] Tests de permisos por usuario

---

## ⬜ FASE 6: INFRAESTRUCTURA (~6 horas)

> **Objetivo:** PWA + Push para habilitar briefings y alertas

### 6.1: PWA Base (~2h)

```
public/
├── manifest.json
│   {
│     "name": "Tuqui",
│     "short_name": "Tuqui",
│     "start_url": "/",
│     "display": "standalone",
│     "theme_color": "#7C3AED",
│     "icons": [...]
│   }
├── sw.js (service worker)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

**Meta:** Lighthouse PWA score ≥ 90

### 6.2: Push Sender (~2h)

```typescript
// lib/push/sender.ts (~50 líneas)

import webpush from 'web-push'

export async function sendPushToUser(
  userId: string,
  notification: {
    title: string
    body: string
    url?: string
  }
): Promise<boolean> {
  const { data: subscriptions } = await db
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
  
  for (const sub of subscriptions || []) {
    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify(notification)
      )
    } catch (err) {
      if (err.statusCode === 410) {
        // Subscription expirada, eliminar
        await db.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  
  return true
}
```

### 6.3: Tabla push_subscriptions

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  subscription JSONB NOT NULL,  -- Web Push subscription object
  
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, subscription)
);
```

### Checklist F6

- [ ] `manifest.json` creado
- [ ] Service worker funciona
- [ ] Lighthouse PWA ≥ 90
- [ ] Push sender implementado
- [ ] Tabla `push_subscriptions` creada
- [ ] UI para habilitar notificaciones

---

## ⬜ FASE 7: FEATURES (~6 horas)

> **Objetivo:** Briefings diarios y alertas proactivas

### 7.1: Briefings (~3h)

**Concepto:** Cada mañana, el usuario recibe un resumen de lo importante.

```
🌅 Buenos días, Juan!

📊 *Resumen de ayer:*
• Vendiste $850K (↑15% vs día anterior)
• 3 facturas vencidas por $120K
• Stock bajo en 2 productos

💡 *Para hoy:*
• Cedent tiene una factura de $50K venciendo
• Llegó mercadería de proveedor X

¿Querés ver más detalles?
```

**Implementación:**

```typescript
// lib/briefings/generator.ts

export async function generateBriefing(
  tenantId: string,
  userId: string,
  config: BriefingConfig
): Promise<string> {
  const sections = []
  
  if (config.include_sales) {
    const sales = await getSalesTool.execute({ period: 'yesterday' }, ctx)
    sections.push(`📊 Ventas de ayer: $${sales.total}`)
  }
  
  if (config.include_receivables) {
    const ar = await getAccountsReceivable.execute({}, ctx)
    if (ar.overdue > 0) {
      sections.push(`⚠️ Facturas vencidas: $${ar.overdue}`)
    }
  }
  
  // ... más secciones
  
  // Generar texto con LLM para que sea natural
  const prompt = `Generá un briefing matutino amigable con esta info:\n${sections.join('\n')}`
  return await generateText({ prompt })
}
```

### 7.2: Alertas (~2h)

**Concepto:** Notificaciones cuando pasa algo importante.

| Alerta | Trigger | Ejemplo |
|--------|---------|---------|
| Stock bajo | `qty_available < threshold` | "⚠️ Adhesivo 3M: solo quedan 5 unidades" |
| Factura grande vence | `amount > X && days_to_due < 3` | "💰 Factura de Cedent ($50K) vence en 2 días" |
| Pedido grande | `amount > X` | "🎉 Nuevo pedido de MegaCorp por $30K" |

**Implementación:**

```typescript
// lib/alerts/evaluator.ts

export async function evaluateAlerts(tenantId: string): Promise<Alert[]> {
  const alerts: Alert[] = []
  const config = await getAlertConfig(tenantId)
  
  // Stock bajo
  if (config.alert_low_stock) {
    const lowStock = await getLowStockProducts.execute({ threshold: 10 }, ctx)
    for (const product of lowStock) {
      alerts.push({
        type: 'low_stock',
        severity: product.qty < 5 ? 'critical' : 'warning',
        message: `${product.name}: solo quedan ${product.qty} unidades`
      })
    }
  }
  
  // Facturas por vencer
  if (config.alert_due_invoices) {
    // ...
  }
  
  return alerts
}
```

### 7.3: Heartbeat simple (~1h)

```typescript
// app/api/heartbeat/route.ts (~30 líneas)

export async function GET(request: Request) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const now = new Date()
  const hour = now.getHours()
  
  // Briefings: 7-9 AM
  if (hour >= 7 && hour <= 9) {
    await processPendingBriefings()
  }
  
  // Alertas: siempre
  await processAlerts()
  
  return Response.json({ 
    status: 'ok',
    timestamp: now.toISOString()
  })
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/heartbeat",
    "schedule": "*/15 * * * *"
  }]
}
```

### Checklist F7

- [ ] `lib/briefings/generator.ts` implementado
- [ ] `lib/alerts/evaluator.ts` implementado
- [ ] `app/api/heartbeat/route.ts` implementado
- [ ] Tablas de config (`user_briefing_config`, `user_alert_config`)
- [ ] UI para configurar briefings y alertas
- [ ] Cron configurado en Vercel
- [ ] Tests de generación

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Baseline | Actual | Target | Cómo medir |
|---------|----------|--------|--------|------------|
| Agent Evals | 46.2% | 98.5% | ≥85% | `npx vitest run tests/evals/` |
| Unit Tests | 0 | ~337 | ≥250 | `npx vitest run tests/unit/` (~1.5s) |
| Eval Test Cases | 67 | 75 | 80+ | test-cases.ts |
| Odoo Skills | 20 | 36 | 40+ | `odooSkills.length` |
| Memory Skills | 0 | 2 | 2 | recall_memory + save_memory |
| Quality Insights | N/A | 75% | ≥80% | qualityPatterns match rate |
| Orquestador | ~400 líneas | ~155 líneas | ~100 | `wc -l orchestrator.ts` |
| Rate limit issues | Muchos | Mitigados | 0 | Observar en tests |
| Error UX | Genérico | Friendly | Friendly | getFriendlyError() |
| Tenant Isolation | 0 queries safe | ~45 queries | 100% | `.eq('tenant_id')` explícito |

---

## 🚫 QUÉ NO HACER

### ❌ NO crear prompts monstruosos
```
❌ System prompt de 3000 tokens con todas las instrucciones
✅ System prompt de 500 tokens + buenas descripciones de tools
```

### ❌ NO hardcodear keywords
```
❌ if (message.includes('venta') || message.includes('vendimos'))
✅ LLM clasifica basado en descripciones dinámicas de la DB
```

### ❌ NO hacer features sin tests
```
❌ "Ya funciona, después agrego tests"
✅ Test primero, feature después
```

### ❌ NO compartir credenciales entre usuarios
```
❌ Un Odoo user para todo el tenant
✅ Cada usuario conecta su propia cuenta
```

---

## 🤖 NOTAS PARA CLAUDE CODE

### Principios a seguir:
1. **Menos código es mejor** - Si podés resolver con config de DB, hacelo
2. **Tests primero** - No escribir código sin test que lo valide
3. **Descripciones > Prompts** - La inteligencia va en las descripciones
4. **Un archivo = una responsabilidad** - Archivos < 200 líneas

### Archivos clave:
```
lib/agents/orchestrator.ts          # ✅ Completado (~155 líneas)
lib/company/context-injector.ts     # ✅ Completado
lib/chat/build-system-prompt.ts     # ✅ Completado (7 capas)
lib/tools/llm-engine.ts             # ✅ Engine único (V2, ex native-gemini-v2)
lib/improvement/auditor.ts          # ✅ 5 dimensiones (incl insightScore)
lib/improvement/loop.ts             # ✅ Progressive L1→L5
lib/skills/memory/                  # ✅ F4 (index, recall, save, tools)
lib/errors/friendly-messages.ts     # ✅ F4 (mapeo errores → mensajes amigables)
lib/push/sender.ts                  # F6 (~50 líneas)
lib/briefings/generator.ts          # F7
lib/alerts/evaluator.ts             # F7
```

### Qué NO crear:
- ❌ Prompts de más de 1000 tokens
- ❌ Archivos de más de 200 líneas  
- ❌ Features sin tests
- ❌ Keywords hardcodeados
- ❌ Lógica de negocio en el frontend

---

## 📚 REFERENCIAS

### Documentación consultada:
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling) - Best practices
- [Anthropic Tool Use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) - Cómo Claude maneja tools
- [Dust.tt Architecture](https://dust.tt/blog/building-deep-dive-infrastructure-for-ai-agents-that-actually-go-deep) - Multi-agent patterns

### Citas clave:

> "When you have multiple tools available, clear and specific descriptions become even more critical for the model to make the right tool selection." — OpenAI Docs

> "If instructions are precise, the model follows the script and tool selection is straightforward. The more auto-GPT-like approach with 16 tools and high-level instructions results in more errors." — Dust.tt

---

*Última actualización: 2026-02-09*  
*PRs mergeados: #2 (RAG), #3 (Orchestrator), #4 (Accounting), #5-#9 (pipeline/skills), #10 (Phase 3)*  
*PR abierto: #11 (Memory + Admin UI + Friendly Errors + Tenant Isolation) en `feat/memory`*  
*Fases completadas: F0, F1, F2, F3 (6 sub-fases), F4 (Memory + Tenant Isolation) — Siguiente: F5 User Credentials*  
*Filosofía: Simple > Complejo, Tests > Features, Descripciones > Prompts*