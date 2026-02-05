# 🧠 TUQUI REFACTOR v3 - LEAN & TESTEABLE

> **Filosofía:** Código mínimo, tests máximos, escalable sin prompts monstruosos  
> **Principio:** La inteligencia viene de buenas descripciones, no de prompts enormes  
> **Para:** Un founder que no es developer pero controla calidad via tests y LLMs  
> **Última actualización:** 2026-02-05

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

## 📊 ARQUITECTURA ACTUAL (✅ IMPLEMENTADA)

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
                              │ ✅ RESUELTO: Orquestador LLM (F1 completado)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORQUESTADOR LLM (~100 líneas)                │
│  lib/agents/orchestrator.ts                                    │
│  Lee descripciones de DB → Gemini clasifica → retorna slug     │
└─────────────────────────────────────────────────────────────────┘
                              │
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
- **Orquestador LLM reemplazó router de keywords** ✅

### Lo que queda por mejorar
- Company Context más rico (F2)
- Descripciones de Skills (F3)
- Memory Tool (F4)

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

| Fase | Tiempo | Descripción | Estado |
|------|--------|-------------|--------|
| F0 | 2h | Tests Baseline - Establecer métricas | ✅ Completado |
| F1 | 3h | Orquestador LLM - Reemplazar router | ✅ Completado |
| F2 | 3h | Company Context - Tuqui conoce la empresa | 🔜 Siguiente |
| F3 | 4h | Skill Descriptions - Mejorar descripciones | ⬜ Pendiente |
| F4 | 4h | Memory Tool - Memoria conversacional | ⬜ Pendiente |
| F5 | 8h | User Credentials & Onboarding | ⬜ Pendiente |
| F6 | 6h | Infraestructura - PWA, Push | ⬜ Pendiente |
| F7 | 6h | Features - Briefings, Alertas | ⬜ Pendiente |

**Total estimado: ~36 horas** | **Completado: ~5 horas**

---

## 🧪 FASE 0: TESTS BASELINE ✅ COMPLETADO

> **Objetivo:** Saber dónde estás antes de cambiar algo

### 0.1: Documentar baseline actual

**Estado FINAL (2026-02-05):**
- Pass Rate: **73.2%** (52/67 tests, con rate limits)
- Pass Rate sin rate limits: **98%** 
- Tests totales: 67 casos + 1 threshold check
- Threshold configurado: 80%
- Delay entre tests: 25s (rate limit mitigation)

### 0.2: Tests de orquestador ✅
- Integrados en agent-evals.test.ts
- El orquestador se testea indirectamente vía los evals

### 0.3: CI configurado ✅
- Threshold: 80%
- Delay: 25s

**Checklist Fase 0:**
- [x] Baseline documentado (73.2%)
- [x] Tests funcionando (67 casos)
- [x] CI threshold ajustado (80%)

---

## 🎛️ FASE 1: ORQUESTADOR LLM LEAN ✅ COMPLETADO

> **Objetivo:** Reemplazar ~400 líneas de keywords con ~100 líneas de LLM

### 1.1: lib/agents/orchestrator.ts ✅

**Implementado:** `lib/agents/orchestrator.ts` (~100 líneas)
- `orchestrate()` - función principal que clasifica y retorna agente
- `getAvailableAgents()` - obtiene agentes activos del tenant
- Usa `gemini-2.0-flash` para clasificación
- Lee descripciones dinámicamente de la DB

### 1.2: Rutas migradas ✅

| Ruta | Estado |
|------|--------|
| `/api/chat` | ✅ Usa orchestrate() |
| `/api/internal/chat-test` | ✅ Usa orchestrate() |
| `/api/internal/test` | ✅ Usa orchestrate() |

### 1.3: Router deprecado ✅

```bash
# Archivo renombrado (backup)
lib/agents/router.deprecated.ts
```

### 1.4: Commit ✅

```
a6559d0 - feat(F1): LLM orchestrator replaces keyword router
- 13 files changed, 352 insertions(+), 126 deletions(-)
```

**Checklist Fase 1:**
- [x] orchestrator.ts creado (~100 líneas)
- [x] Todas las rutas migradas
- [x] router.ts deprecado
- [x] Tests pasan
- [x] Commit realizado

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

## � FASE 5: USER CREDENTIALS & ONBOARDING (~8 horas)

> **Objetivo:** Cada usuario aporta sus propias credenciales, no credenciales compartidas por tenant.
> Los permisos de cada usuario vienen de su propia API key/credencial.

### 5.1: Migrar credenciales de tenant a usuario

**Antes (actual):**
```
tenants.integrations → config compartido para TODOS los usuarios del tenant
```

**Después:**
```
user_credentials → cada usuario tiene SU propia conexión
```

```sql
-- supabase/migrations/500_user_credentials.sql
CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Tipo de integración
  integration_type TEXT NOT NULL,  -- 'odoo', 'gmail', 'google_calendar', 'meli', etc.
  
  -- Credenciales (encriptadas)
  config JSONB DEFAULT '{}',
  -- Odoo: { url, db, user, password/api_key }
  -- Gmail: { oauth_token, refresh_token }
  -- Calendar: { oauth_token, calendar_id }
  -- MeLi: { access_token, refresh_token, seller_id }
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  UNIQUE(user_id, integration_type)
);

CREATE INDEX idx_user_credentials_user ON user_credentials(user_id);
CREATE INDEX idx_user_credentials_tenant ON user_credentials(tenant_id);
```

### 5.2: Ventajas del modelo por usuario

| Antes (por tenant) | Después (por usuario) |
|--------------------|----------------------|
| Un user de Odoo para todos | Cada uno usa SU user de Odoo |
| Acceso total a todos los datos | Permisos del Odoo de cada uno |
| Riesgo: empleado despedido sigue con acceso | Usuario se va → pierde acceso automático |
| No sabés quién hizo cada query | Trazabilidad por usuario |

### 5.3: UI para configurar credenciales propias

```
/settings/connections  → Usuario configura sus propias integraciones
├── Odoo: "Conectar mi cuenta de Odoo"
├── Gmail: "Autorizar Gmail"
├── Google Calendar: "Vincular calendario"
└── MercadoLibre: "Conectar mi cuenta de MeLi"
```

### 5.4: Refactorear skills para usar credenciales del usuario

```typescript
// lib/skills/context.ts (modificar)
export function createSkillContext(
  tenantId: string,
  userId: string  // NUEVO: ahora es requerido
): SkillContext {
  return {
    tenantId,
    userId,
    
    // Obtener credenciales del USUARIO, no del tenant
    getCredentials: async (type: 'odoo' | 'gmail' | 'calendar' | 'meli') => {
      const { data } = await db
        .from('user_credentials')
        .select('config')
        .eq('user_id', userId)
        .eq('integration_type', type)
        .single()
      
      if (!data) throw new Error(`Usuario no tiene ${type} configurado`)
      return data.config
    }
  }
}
```

### 5.5: Portal de Onboarding de Tenants

```
/admin/tenants  → Super-admin puede crear tenants nuevos
├── Crear tenant nuevo
│   ├── Nombre, slug, industria
│   ├── Plan/tier
│   └── Invitar primer admin
├── Ver tenants existentes
└── Configurar agentes master disponibles
```

```sql
-- Super admin flag
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT false;
```

### 5.6: Flujo de alta de tenant

```
1. Super-admin crea tenant desde /admin/tenants
2. Se envía invitación al primer admin del tenant
3. Admin acepta y configura SUS credenciales
4. Admin invita usuarios adicionales
5. Cada usuario configura SUS propias credenciales
```

**Checklist Fase 5:**
- [ ] Migration user_credentials
- [ ] UI /settings/connections para usuario
- [ ] Refactorear skills para usar userId
- [ ] Migration is_super_admin
- [ ] UI /admin/tenants para super-admin
- [ ] Flujo de invitación de admin
- [ ] Tests de permisos por usuario

---

## 🔧 FASE 6: INFRAESTRUCTURA (~6 horas)

- PWA Base (manifest, service worker)
- Push Sender (~50 líneas)

---

## 📬 FASE 7: FEATURES (~6 horas)

- Briefings (config por usuario, generador, push)
- Alertas (thresholds, evaluador, deduplicación)
- Heartbeat simple (cron cada 15 min)

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Baseline | Actual | Target | Cómo medir |
|---------|----------|--------|--------|------------|
| Agent Evals | 46.2% | **73.2%** | ≥80% | `npm run test:evals` |
| Líneas router | ~400 | **~100** | ~50 | orchestrator.ts |
| Rate limit issues | Muchos | Mitigados | 0 | 25s delay |

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

*Última actualización: 2026-02-05*
*Commit actual: a6559d0 (F1 completado)*
*Filosofía: Simple > Complejo, Tests > Features, Descripciones > Prompts*
