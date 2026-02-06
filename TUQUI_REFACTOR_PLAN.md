# 🧠 TUQUI REFACTOR v3 - LEAN & TESTEABLE

> **Filosofía:** Código mínimo, tests máximos, escalable sin prompts monstruosos  
> **Principio:** La inteligencia viene de buenas descripciones, no de prompts enormes  
> **Para:** Un founder que no es developer pero controla calidad via tests y LLMs  
> **Última actualización:** 2026-02-05

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
| Fase actual | F2 - Company Context |
| Branch actual | `main` |
| Último merge | PR #4 - 4 accounting skills (96cae4e) |
| Unit tests | 208 passing (~2s) |
| Baseline evals | 73.2% (98% sin rate limits) |

### Progreso General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✅ COMPLETADO PREVIAMENTE                                                   │
│   └─ F0-viejo: Preparación y limpieza                                      │
│   └─ F1-viejo: RAG como Tool (mergeado 2026-02-04, PR #2)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✅ COMPLETADO: REFACTOR v3                                                  │
│   └─ F0: Tests Baseline              [x] ██████████ 100% (73.2% pass rate) │
│   └─ F1: Orquestador LLM Lean        [x] ██████████ 100% (router.deprecated)│
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔄 SIGUIENTE                                                                │
│   └─ F2: Company Context             [ ] ⬜⬜⬜⬜⬜ 0%                      │
│   └─ F3: Skill Descriptions          [~] ██⬜⬜⬜⬜ 25% (4 accounting skills)│
│   └─ F4: Memory Tool                 [ ] ⬜⬜⬜⬜⬜ 0%                      │
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
| F2 | 3h | Company Context - Tuqui conoce la empresa | 🔜 Siguiente |
| F3 | 4h | Skill Descriptions - Mejorar descripciones | 🟡 Parcial (PR #4: 4 accounting skills) |
| F4 | 4h | Memory Tool - Memoria conversacional | ⬜ Pendiente |
| F5 | 8h | User Credentials & Onboarding | ⬜ Pendiente |
| F6 | 6h | Infraestructura - PWA, Push | ⬜ Pendiente |
| F7 | 6h | Features - Briefings, Alertas | ⬜ Pendiente |

**Total estimado: ~36 horas** | **Completado: ~6 horas** | **34 skills, 208 tests**

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

## 🔜 FASE 2: COMPANY CONTEXT (~3 horas)

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

- [ ] Migration `200_company_context.sql` creada y aplicada
- [ ] `lib/company/context-injector.ts` implementado (~30 líneas)
- [ ] UI en `/admin/company` mejorada
- [ ] Contexto se inyecta en `engine.ts`
- [ ] Tests pasan
- [ ] Evals no bajan

---

## 🟡 FASE 3: SKILL DESCRIPTIONS (~4 horas) — PARCIAL

> **Objetivo:** La inteligencia está en las descripciones de los tools, no en prompts

### Avance

✅ **PR #4 mergeado:** 4 accounting skills con descripciones ricas + 46 unit tests.

| Skill | Modelo | Descripción |
|-------|--------|-------------|
| `get_account_balance` | account.move.line | Saldos del plan de cuentas (balancete) |
| `get_journal_entries` | account.move | Asientos contables con filtro por tipo y cuenta |
| `get_accounts_payable` | account.move | Cuentas por pagar (mirror de receivable) |
| `get_payments_made` | account.payment | Pagos a proveedores (mirror de received) |

### Pendiente

- [ ] Auditar y mejorar descripciones de los 30 skills existentes
- [ ] Tests de selección (evals que validen que el LLM elige el skill correcto)

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

- [ ] Descripciones de skills principales mejoradas
- [ ] Template de descripción documentado
- [ ] Tests de selección creados
- [ ] Evals mejoran vs baseline

---

## ⬜ FASE 4: MEMORY TOOL (~4 horas)

> **Objetivo:** Memoria conversacional como tool, no como contexto fijo

### ¿Por qué como Tool y no siempre inyectado?

- **Contexto de empresa** (~200 tokens): Siempre relevante → Siempre inyectado
- **Memoria conversacional** (variable): Solo relevante cuando se menciona la entidad → Tool on-demand

**Ejemplo:**
```
[Ayer] Usuario: "MegaCorp siempre paga tarde"
[Hoy]  Usuario: "¿Cuánto nos debe MegaCorp?"

Sin memoria: "MegaCorp debe $340K"
Con memoria: "MegaCorp debe $340K (recordá que suelen pagar tarde)"
```

### Implementación

#### 4.1: Tabla `conversation_insights`

```sql
-- supabase/migrations/201_conversation_memory.sql
CREATE TABLE IF NOT EXISTS conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  
  entity_type TEXT,      -- 'customer', 'product', 'supplier', 'general'
  entity_name TEXT,      -- 'MegaCorp', 'iPhone 15', etc.
  insight TEXT NOT NULL, -- 'Siempre paga tarde'
  
  source_session_id UUID,
  confidence FLOAT DEFAULT 0.8,
  use_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_insights_tenant ON conversation_insights(tenant_id);
CREATE INDEX idx_insights_entity ON conversation_insights(entity_name);
```

#### 4.2: Memory Tool

```typescript
// lib/tools/definitions/memory-tool.ts

export const memoryTool: Tool = {
  name: 'get_relevant_memory',
  description: `Busca notas y contexto de conversaciones anteriores sobre una entidad.

USAR CUANDO: El usuario menciona un cliente, producto o proveedor específico 
y querés saber si hay notas previas relevantes.

NO USAR: Para datos de Odoo (ventas, stock) o información general.

PARÁMETROS:
- entity_name: Nombre del cliente/producto/proveedor a buscar`,

  parameters: {
    type: 'object',
    properties: {
      entity_name: { type: 'string', description: 'Nombre de la entidad' }
    },
    required: ['entity_name']
  },

  execute: async ({ entity_name }, context) => {
    const { data } = await db
      .from('conversation_insights')
      .select('entity_type, insight, created_at')
      .eq('tenant_id', context.tenantId)
      .ilike('entity_name', `%${entity_name}%`)
      .order('use_count', { ascending: false })
      .limit(5)
    
    if (!data?.length) {
      return { found: false, message: 'No hay notas previas sobre esta entidad' }
    }
    
    // Incrementar use_count de las usadas
    await db.from('conversation_insights')
      .update({ use_count: db.raw('use_count + 1') })
      .in('id', data.map(d => d.id))
    
    return {
      found: true,
      insights: data.map(d => ({
        type: d.entity_type,
        note: d.insight,
        date: d.created_at
      }))
    }
  }
}
```

#### 4.3: Guardado de insights (async, no bloquea)

```typescript
// lib/memory/insight-saver.ts
// Se ejecuta después de cada conversación en background

export async function extractAndSaveInsights(
  tenantId: string,
  userId: string,
  messages: Message[]
): Promise<void> {
  // Patrones a detectar
  const patterns = [
    /(.+) siempre paga (tarde|temprano|bien)/i,
    /(.+) es (buen|mal) (cliente|proveedor)/i,
    /con (.+) (hay que|siempre|nunca) (.+)/i,
  ]
  
  // Extraer insights del historial
  for (const msg of messages) {
    for (const pattern of patterns) {
      const match = msg.content.match(pattern)
      if (match) {
        await db.from('conversation_insights').insert({
          tenant_id: tenantId,
          user_id: userId,
          entity_name: match[1],
          insight: msg.content,
          entity_type: 'general'
        })
      }
    }
  }
}
```

### Checklist F4

- [ ] Migration `201_conversation_memory.sql` creada
- [ ] `lib/tools/definitions/memory-tool.ts` implementado
- [ ] `lib/memory/insight-saver.ts` implementado
- [ ] Tool registrado en agentes relevantes
- [ ] Tests pasan

---

## ⬜ FASE 5: USER CREDENTIALS & ONBOARDING (~8 horas)

> **Objetivo:** Cada usuario aporta sus propias credenciales. Los permisos vienen de su cuenta, no compartidos.

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

#### 5.1: Tabla `user_credentials`

```sql
-- supabase/migrations/500_user_credentials.sql
CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  integration_type TEXT NOT NULL,  -- 'odoo', 'gmail', 'calendar', 'meli'
  
  -- Credenciales (encriptadas en producción)
  config JSONB DEFAULT '{}',
  -- Odoo: { url, db, user, password }
  -- Gmail: { oauth_token, refresh_token }
  -- MeLi: { access_token, seller_id }
  
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, integration_type)
);
```

#### 5.2: UI para configurar conexiones

```
/settings/connections
├── 🔗 Odoo
│   └── [Conectar mi cuenta de Odoo]
│       ├── URL: _______________
│       ├── Base de datos: _______________
│       ├── Usuario: _______________
│       └── Contraseña: _______________
│
├── 📧 Gmail
│   └── [Autorizar con Google] → OAuth flow
│
├── 🛒 MercadoLibre
│   └── [Conectar mi cuenta] → OAuth flow
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

- [ ] Migration `500_user_credentials.sql`
- [ ] UI `/settings/connections` para usuario
- [ ] Refactorear `createSkillContext` para usar `userId`
- [ ] Actualizar todos los skills para manejar error de "no configurado"
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
| Agent Evals | 46.2% | 73.2% | ≥80% | `npm run test:evals` |
| Unit Tests | 0 | 208 | ≥250 | `npm run test:ci` (~2s) |
| Odoo Skills | 20 | 34 | 40+ | `odooSkills.length` |
| Líneas router | ~400 | ~100 | ~50 | `wc -l orchestrator.ts` |
| Rate limit issues | Muchos | Mitigados | 0 | Observar en tests |
| Prompts size | ~2000 tok | - | <500 tok | Medir en agentes |

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
lib/agents/orchestrator.ts          # ✅ Completado (~100 líneas)
lib/company/context-injector.ts     # 🔜 F2 (~30 líneas)
lib/tools/definitions/memory-tool.ts # F4
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

*Última actualización: 2026-02-05*  
*Commit actual: 96cae4e (PR #4 mergeado — 4 accounting skills)*  
*PRs mergeados: #2 (RAG tool), #3 (F1 Orchestrator), #4 (Accounting skills)*  
*Filosofía: Simple > Complejo, Tests > Features, Descripciones > Prompts*