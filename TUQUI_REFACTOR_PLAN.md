# 🧠 TUQUI REFACTOR v3 - LEAN & TESTEABLE

> **Filosofía:** Código mínimo, tests máximos, escalable sin prompts monstruosos  
> **Principio:** La inteligencia viene de buenas descripciones, no de prompts enormes  
> **Para:** Un founder que no es developer pero controla calidad via tests y LLMs  
> **Última actualización:** 2026-02-04

---

## 📍 ESTADO ACTUAL

| Campo | Valor |
|-------|-------|
| **Fase actual** | `F2` - Company Context |
| **Branch actual** | `refactor/fase-2-orchestrator` |
| **Último checkpoint** | F1 completado - Orquestador LLM activo |
| **Baseline evals** | 73.2% (98% sin rate limits) |

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
│   └─ F3: Skill Descriptions          [ ] ⬜⬜⬜⬜⬜ 0%                      │
│   └─ F4: Memory Tool                 [ ] ⬜⬜⬜⬜⬜ 0%                      │
│   └─ F5: Infraestructura (PWA/Push)  [ ] ⬜⬜⬜⬜⬜ 0%                      │
│   └─ F6: Features (Briefings/Alertas)[ ] ⬜⬜⬜⬜⬜ 0%                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 PRINCIPIOS DEL REFACTOR

### 1. MENOS CÓDIGO = MENOS BUGS
- Cada línea de código es un bug potencial
- Si algo se puede hacer con configuración (DB), no hacerlo en código
- Los prompts van en la DB, no hardcodeados

### 2. TESTS COMO DOCUMENTACIÓN VIVA
- Si no hay test, no existe la feature
- Los tests son tu safety net para hacer cambios con confianza
- Agent evals = tu métrica de calidad (#1 priority)

### 3. LA INTELIGENCIA ESTÁ EN LAS DESCRIPCIONES
- El LLM es inteligente, no lo subestimes
- Buenas descripciones de agentes/tools > prompts enormes
- Dejar que el modelo decida (tool_choice: auto)

### 4. ESCALABLE SIN TOCAR CÓDIGO
- Nuevo agente = INSERT en DB, no PR
- Nuevo tool = archivo + registro, no refactor
- Nuevo tenant = configuración, no deploy

---

## 📊 ARQUITECTURA ACTUAL (A MANTENER)

```
┌─────────────────────────────────────────────────────────────────┐
│                      MASTER_AGENTS (DB)                         │
├─────────────────────────────────────────────────────────────────┤
│ tuqui:     prompt general + [web_search] + RAG                 │
│ contador:  prompt contable + [web_search] + RAG                │
│ abogado:   prompt legal + [web_search] + RAG                   │
│ odoo:      prompt BI + [odoo_skills] + RAG                     │
│ meli:      prompt mercado + [web_search]                       │
│ cedent:    prompt productos Cedent + RAG                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 👈 PROBLEMA: Router por keywords (frágil)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       AGENTE SELECCIONADO                       │
│  Se usa: su prompt + sus tools                                 │
│  Gemini decide qué tool usar (tool_choice: auto)               │
└─────────────────────────────────────────────────────────────────┘
```

### Lo que está bien ✅
- Agentes con prompts especializados
- Cada agente tiene sus tools
- Gemini decide qué tool dentro del agente
- Reutilización (ej: web_search en contador Y meli)
- RAG por agente (documentos asociados)

### Lo que hay que arreglar ❌
- Router por keywords (~400 líneas, frágil)
- "Cuánta guita hicimos" no matchea → va al agente equivocado

---

## 📊 ARQUITECTURA TARGET

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO                                 │
│                    "¿Cuánta guita hicimos?"                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORQUESTADOR LLM (~50 líneas)                 │
│                                                                 │
│  Lee de DB: agents.description (DINÁMICO, no hardcodeado)      │
│  Prompt: "Clasificá → respondé solo el slug"                   │
│  Output: "odoo"                                                │
│                                                                 │
│  ~100 tokens, sin keywords ni slugs en código                  │
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
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
```

### 🔄 Escalabilidad sin código

| Acción | Cómo hacerlo | ¿Tocar código? |
|--------|--------------|----------------|
| Agregar agente nuevo | INSERT en `master_agents` o desde `/admin/agents` | ❌ No |
| Cambiar descripción | UPDATE en DB o desde UI | ❌ No |
| Agregar tool a agente | Editar `tools[]` del agente en DB/UI | ❌ No |
| Crear skill nuevo | Archivo en `lib/skills/` + registrar | ✅ Sí (mínimo) |
┌─────────────────────────────────────────────────────────────────┐
│                         GEMINI                                  │
│                                                                 │
│  tool_choice: "auto"                                           │
│  El modelo decide qué tool usar basado en descripciones        │
│                                                                 │
│  La inteligencia está en: tool.description                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 ROADMAP

| Fase | Tiempo | Descripción |
|------|--------|-------------|
| F0 | 2h | Tests Baseline - Establecer métricas antes de cambiar |
| F1 | 3h | Orquestador LLM - Reemplazar router por keywords |
| F2 | 3h | Company Context - Tuqui conoce la empresa |
| F3 | 4h | Skill Descriptions - Mejorar descripciones de tools |
| F4 | 4h | Memory Tool - Memoria conversacional |
| F5 | 6h | Infraestructura - PWA, Push, Permisos |
| F6 | 6h | Features - Briefings, Alertas |

**Total estimado: ~28 horas**

---

## 🧪 FASE 0: TESTS BASELINE (~2 horas)

> **Objetivo:** Saber dónde estás antes de cambiar algo

### 0.1: Documentar baseline actual

**Estado actual (2026-02-04):**
- Pass Rate: 46.2%
- Tests totales: ~26
- Problemas principales:
  - Febrero no tiene datos de ventas (mes nuevo)
  - Algunas respuestas piden confirmación innecesaria
  - Rate limiting en algunos tests

### 0.2: Agregar tests específicos para el orquestador

```typescript
// tests/unit/orchestrator.test.ts
describe('Orchestrator', () => {
  const cases = [
    { input: '¿Cuánto vendimos?', expected: 'odoo' },
    { input: '¿Cuánta guita hicimos?', expected: 'odoo' },  // No matchea keyword actual
    { input: 'Precio de iPhone en MercadoLibre', expected: 'meli' },
    { input: '¿Cómo calculo el IVA?', expected: 'contador' },
    { input: 'Hola', expected: 'tuqui' },
    { input: 'Fijate en los manuales de Cingol', expected: 'cedent' }, // RAG
  ]
  
  test.each(cases)('$input → $expected', async ({ input, expected }) => {
    const result = await classifyIntent(input)
    expect(result.agentSlug).toBe(expected)
  })
})
```

### 0.3: Verificar CI está configurado

```yaml
# .github/workflows/agent-evals.yml
# Ya existe - threshold actual: 50% (bajar temporalmente de 80%)
```

**Checklist Fase 0:**
- [ ] Baseline documentado (46.2%)
- [ ] Tests de orquestador creados
- [ ] CI threshold ajustado temporalmente

---

## 🎛️ FASE 1: ORQUESTADOR LLM LEAN (~3 horas)

> **Objetivo:** Reemplazar ~400 líneas de keywords con ~50 líneas de LLM

### 1.1: Crear lib/agents/orchestrator.ts

```typescript
// lib/agents/orchestrator.ts
// ~50 líneas total

import { generateText } from 'ai'
import { google } from '@ai-sdk/google'

interface Agent {
  slug: string
  description: string
}

/**
 * Clasifica la intención del usuario para elegir el agente correcto.
 * 
 * La inteligencia viene de las descripciones de los agentes en la DB,
 * no de keywords hardcodeados.
 */
export async function classifyIntent(
  message: string,
  agents: Agent[],
  conversationContext?: string[]
): Promise<{ agentSlug: string; confidence: number }> {
  
  // Construir prompt dinámico desde las descripciones de la DB
  const agentList = agents
    .map(a => `- ${a.slug}: ${a.description}`)
    .join('\n')

  const prompt = `Clasificá esta consulta para decidir qué agente usar.

AGENTES DISPONIBLES:
${agentList}

CONSULTA: "${message}"

Respondé SOLO con el slug del agente más apropiado (una palabra).`

  try {
    const result = await generateText({
      model: google('gemini-2.0-flash'),
      prompt,
      maxTokens: 10,
      temperature: 0,
    })

    const slug = result.text.trim().toLowerCase()
    const validSlugs = agents.map(a => a.slug)
    
    if (validSlugs.includes(slug)) {
      return { agentSlug: slug, confidence: 0.9 }
    }
    
    // Fallback al agente principal
    return { agentSlug: 'tuqui', confidence: 0.5 }
    
  } catch (error) {
    console.error('[Orchestrator] Error:', error)
    return { agentSlug: 'tuqui', confidence: 0.3 }
  }
}
```

### 1.2: Actualizar engine.ts para usar el orquestador

```typescript
// lib/chat/engine.ts - cambios mínimos

// ANTES (router por keywords)
import { routeMessage } from '@/lib/agents/router'

// DESPUÉS (orquestador LLM)
import { classifyIntent } from '@/lib/agents/orchestrator'

// En processChatRequest():
const agents = await getActiveAgents(tenantId)
const { agentSlug } = await classifyIntent(inputContent, agents, conversationHistory)
const selectedAgent = agents.find(a => a.slug === agentSlug)
```

### 1.3: Mejorar descripciones de agentes (desde UI o DB)

> ⚠️ **IMPORTANTE:** Las descripciones se editan desde `/admin/agents` o directamente en la DB.
> El orquestador las lee dinámicamente - NO hay nada hardcodeado en código.

**Cómo funciona:**
1. El orquestador llama a `getActiveAgents(tenantId)` → lee de DB
2. Arma el prompt con las descripciones que encuentre
3. Si agregás un nuevo agente en DB, automáticamente lo considera

**Ejemplos de buenas descripciones (para copiar en la UI):**

| Agente | Descripción sugerida |
|--------|---------------------|
| odoo | Consultas sobre datos internos: ventas, facturación, stock, clientes, proveedores, cobranzas. |
| meli | Buscar precios en MercadoLibre, comparar con competencia, precios de mercado. |
| contador | Consultas sobre impuestos argentinos: IVA, Ganancias, Monotributo, IIBB. |
| abogado | Consultas sobre leyes argentinas, contratos, sociedades, laboral. |
| tuqui | Conversación general, saludos, fallback cuando no encaja en otro agente. |

**Tip:** Incluir ejemplos de frases que el usuario diría ayuda al LLM a clasificar mejor.

### 1.4: Deprecar router.ts viejo

```bash
# Renombrar para mantener backup
mv lib/agents/router.ts lib/agents/router.deprecated.ts
```

### 1.5: Tests y validación

```bash
npm run test -- tests/unit/orchestrator.test.ts
npm run test:evals
```

**Métricas de éxito:**
- [ ] Tests unitarios del orquestador: 100%
- [ ] Agent evals: ≥ baseline (46.2%)
- [ ] router.ts deprecado

---

## 🏢 FASE 2: COMPANY CONTEXT (~3 horas)

> **Objetivo:** Tuqui conoce la empresa sin prompts enormes

### 2.1: Usar tabla tenants existente + company_contexts

```sql
-- supabase/migrations/200_company_context.sql
CREATE TABLE IF NOT EXISTS company_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Conocimiento estructurado
  key_products JSONB DEFAULT '[]',
  key_customers JSONB DEFAULT '[]',
  business_rules JSONB DEFAULT '[]',
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id)
);
```

### 2.2: Inyección lean en system prompt

```typescript
// lib/company/context-injector.ts (~30 líneas)

export async function getCompanyContext(tenantId: string): Promise<string> {
  // Combinar info de tenants + company_contexts
  const { data: tenant } = await db.from('tenants').select('*').eq('id', tenantId).single()
  const { data: ctx } = await db.from('company_contexts').select('*').eq('tenant_id', tenantId).single()
  
  const parts = []
  if (tenant?.name) parts.push(`Empresa: ${tenant.name}`)
  if (tenant?.industry) parts.push(`Rubro: ${tenant.industry}`)
  if (ctx?.key_customers?.length) {
    parts.push(`Clientes importantes: ${ctx.key_customers.map(c => c.name).join(', ')}`)
  }
  if (ctx?.business_rules?.length) {
    parts.push(`Reglas: ${ctx.business_rules.join('. ')}`)
  }
  
  return parts.join('\n')
}
```

**Checklist Fase 2:**
- [ ] Migration creada
- [ ] context-injector.ts (~30 líneas)
- [ ] UI en /admin/company mejorada
- [ ] Tests pasan

---

## 🔧 FASE 3: SKILL DESCRIPTIONS (~4 horas)

> **Objetivo:** La inteligencia está en las descripciones de los tools

### 3.1: Mejorar descripciones con ejemplos

```typescript
// ANTES (descripción pobre)
description: 'Obtiene el total de ventas'

// DESPUÉS (descripción rica)
description: `Obtiene el total de ventas de un período.
    
USAR CUANDO: "cuánto vendimos", "total de ventas", "facturación del mes", 
"cuánta guita hicimos", "revenue", "ingresos"

EJECUTAR SIN PREGUNTAR PERÍODO (usa mes actual por defecto si no se especifica)`
```

### 3.2: Tests de selección de skills

```typescript
// tests/evals/skill-selection.test.ts
describe('Skill Selection', () => {
  const cases = [
    { query: '¿Cuánto vendimos este mes?', expectedTool: 'get_sales_total' },
    { query: '¿Cuánta guita hicimos?', expectedTool: 'get_sales_total' },
    { query: '¿Quién nos debe más?', expectedTool: 'get_debt_by_customer' },
  ]
})
```

**Checklist Fase 3:**
- [ ] Descripciones de todos los skills mejoradas
- [ ] Tests de selección de skills
- [ ] Agent evals: mejora vs baseline

---

## 🧠 FASE 4: MEMORY TOOL (~4 horas)

> **Objetivo:** Memoria como tool, no como contexto fijo

### 4.1: Tabla conversation_insights

```sql
CREATE TABLE IF NOT EXISTS conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  entity_type TEXT,  -- 'customer', 'product', 'general'
  entity_name TEXT,
  insight TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2: Memory como tool

```typescript
// lib/tools/definitions/memory-tool.ts
export const memoryTool = {
  name: 'get_relevant_memory',
  description: `Busca notas y contexto de conversaciones anteriores.
    
USAR CUANDO: el usuario menciona un cliente/producto específico y querés 
saber si hay notas previas sobre esa entidad.`,

  execute: async ({ entity_name }, { tenantId }) => {
    const { data } = await db
      .from('conversation_insights')
      .select('insight')
      .eq('tenant_id', tenantId)
      .ilike('entity_name', `%${entity_name}%`)
      .limit(5)
    
    return data?.map(d => d.insight) || []
  }
}
```

---

## 🔧 FASE 5: INFRAESTRUCTURA (~6 horas)

- PWA Base (manifest, service worker)
- Push Sender (~50 líneas)
- User Permissions (filtros de datos por usuario)

---

## 📬 FASE 6: FEATURES (~6 horas)

- Briefings (config por usuario, generador, push)
- Alertas (thresholds, evaluador, deduplicación)
- Heartbeat simple (cron cada 15 min)

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Baseline | Target | Cómo medir |
|---------|----------|--------|------------|
| Agent Evals | 46.2% | ≥85% | `npm run test:evals` |
| Líneas router | ~400 | ~50 | orchestrator.ts |
| Tests unitarios | ? | ≥90% | `npm run test` |

---

## 🚫 QUÉ NO HACER

### NO crear prompts monstruosos
```
❌ System prompt de 3000 tokens con todas las instrucciones
✅ System prompt de 500 tokens + buenas descripciones de tools
```

### NO hardcodear keywords
```
❌ if (message.includes('venta') || message.includes('vendimos'))
✅ LLM clasifica basado en descripciones dinámicas de la DB
```

### NO hacer features sin tests
```
❌ "Ya funciona, después agrego tests"
✅ Test primero, feature después
```

---

## 🤖 NOTAS PARA CLAUDE CODE

### Principios a seguir:
1. **Menos código es mejor** - Si podés resolver con config de DB, hacelo
2. **Tests primero** - No escribir código sin test que lo valide
3. **Descripciones > Prompts** - La inteligencia va en las descripciones
4. **Un archivo = una responsabilidad** - Archivos < 200 líneas

### Archivos clave a crear:
```
lib/agents/orchestrator.ts       # ~50 líneas, reemplaza router.ts
lib/company/context-injector.ts  # ~30 líneas
lib/tools/definitions/memory-tool.ts
```

### Qué NO crear:
- ❌ Prompts de más de 1000 tokens
- ❌ Archivos de más de 200 líneas
- ❌ Features sin tests
- ❌ Keywords hardcodeados

---

*Última actualización: 2026-02-04*
*Filosofía: Simple > Complejo, Tests > Features, Descripciones > Prompts*
