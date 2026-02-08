# 🧠 Fase 3: Skills e Inteligencia

> **Filosofía:** Todo va a mejores skills e inteligencia. No features, no infra.
> **Estado actual (post-merge PR#7):** Pipeline unificado, company context, orquestador LLM, 35 skills Odoo, Gemini 3 Flash, 272 unit tests, 69 evals
> **Post F3.1-F3.4:** 36 skills, 283 unit tests, 67 evals con difficulty L1-L5, loop progresivo V2 funcional, V1 eliminado
> **Baseline L1→L5:** L1 96% | L2 100% | L3 100% | L4 100% | L5 100% (66/67 = 98.5%)
> **Objetivo:** Que cada respuesta de Tuqui se sienta como hablar con alguien que entiende el negocio

---

## 📖 Contexto: ¿Por qué solo inteligencia?

De las charlas con Opus y Gemini, la conclusión fue clara:

> "Si las respuestas no son buenas, puedo tener memoria, PWA, RAG, lo que sea, 
> pero pierdo el usuario enseguida."

> "El valor no está en las conexiones sino en la inteligencia aplicada.
> Ahí cuando el agente entiende el contexto, ofrece info, cuestiona cosas, 
> es cuando aparece el valor."

El efecto "me asusta el conocimiento que tiene de nuestra empresa" (Santi, Cedent) 
no vino de features — vino de respuestas inteligentes con contexto.

**Regla de esta fase:** Si no mejora la calidad de las respuestas, no entra.

---

## 📊 Punto de Partida

| Métrica | Inicio | Actual |
|---|---|---|
| Unit tests | 272/272 ✅ | 283/283 ✅ |
| Agent evals | 69 test cases | 67 test cases (con difficulty L1-L5) |
| Skills Odoo | 35 | 36 (+get_sales_by_category) |
| Modelo | gemini-3-flash-preview | gemini-3-flash-preview |
| Orquestador | LLM (155 líneas) ✅ | LLM (155 líneas) ✅ |
| Company context | Inyectado universalmente ✅ | ✅ |
| V1 native-gemini | Aún vivo en improvement/ | ✅ Eliminado (F3.4) |
| Improvement loop | V1, plano, sin niveles | V2, progresivo L1→L5, funcional ✅ |

---

## ✅ F3.1 — Descripciones de Skills Ricas (COMPLETADO)

> **Completado:** 2026-02-06. Todas las 32 skills no-deprecated con descripciones ricas.
> 19 nuevos test cases L3-L5, 283 unit tests passing.

**Problema:** Las descripciones de muchos skills son pobres. El LLM no sabe bien cuándo usar cada uno ni qué esperar. Esto causa selección incorrecta de tools y respuestas mediocres.

**Principio:** La inteligencia está en las descripciones, no en prompts enormes. (Validado por OpenAI, Anthropic, Dust.tt)

> "Tool definitions become part of the context on every LLM call. Clear and specific 
> descriptions become critical for the model to make the right tool selection."

### Template para cada skill:

```typescript
description: `Qué hace (1 línea).

USAR CUANDO: "cuánto vendimos", "facturación", "ingresos", "guita que hicimos"
NO USAR: Para precios de mercado (usar search_mercadolibre)
PARÁMETROS: period (today, this_week, this_month, etc.)
RETORNA: { total, count, currency, comparison_vs_last_period }`
```

### Skills prioritarios a mejorar:

| Skill | Por qué | Hoy |
|---|---|---|
| `get_sales_total` | El más usado, debe cubrir variaciones coloquiales | Descripción básica |
| `get_sales_by_customer` | Confusión con "cliente" vs "deuda de cliente" | Sin desambiguación |
| `get_accounts_receivable` | "Quién nos debe" es la consulta más común | Sin ejemplos |
| `get_product_stock` | "Tenemos X?" tiene muchas formas | Sin sinónimos |
| `compare_sales_periods` | Comparaciones temporales son complejas | Sin ejemplos de frases |
| `get_debt_by_customer` | Se confunde con sales by customer | Sin NO USAR |
| Los 35 restantes | Auditar y mejorar todos | Variable |

### Tests: Evals de selección correcta

```typescript
const cases = [
  { query: '¿Cuánta guita hicimos?', expectedTool: 'get_sales_total' },
  { query: '¿Quién nos debe más?', expectedTool: 'get_debt_by_customer' },
  { query: '¿Cuánto le vendimos a Cedent?', expectedTool: 'get_sales_by_customer' },
  { query: '¿Cuánto nos debe Cedent?', expectedTool: 'get_accounts_receivable' },
  { query: '¿Hay stock de adhesivo 3M?', expectedTool: 'get_product_stock' },
  { query: '¿Cuánto cuesta un iPhone en MeLi?', expectedTool: 'search_mercadolibre' },
]
```

### Estimación: ~3-4h

---

## ✅ F3.2 — Categorías de Producto (COMPLETADO)

> **Completado:** 2026-02-07. Nuevo skill `get_sales_by_category`, `categoryName` en 5 outputs,
> `categoryId` filter en 4 skills, 11 nuevos unit tests, 6 nuevos eval cases.

**Problema:** El agente devuelve listas planas. No sabe que "Sillón X3" es "Equipamiento Dental" ni que "Guantes" son "Descartables". Esto impide agrupar, entender comportamientos de clientes, y dar insights de mix de productos.

**Lo que pidió Cedent en la reunión:**
- "Productos más vendidos por cantidad" (no facturación) → necesita entender categorías
- "Productos por vencerse" → contexto de qué línea de producto
- "Comparar nuestros precios vs MeLi" → por categoría tiene más sentido

### Cambios en skills existentes:

| Skill | Cambio |
|---|---|
| `get_sales_by_product` | Ya tiene `categoryId` filter → agregar `groupByCategory` + `categoryName` en output |
| `get_top_products` | Agregar `categoryName` en output + param `categoryId` opcional |
| `search_products` | Incluir `categoryName` + `categoryId` en output |
| `get_top_customers` | Param `categoryId` para filtrar por categoría de producto |
| `get_product_stock` | Incluir `categoryName` en output |
| `compare_sales_periods` | Agregar `groupByCategory` option |
| `get_stock_valuation` | Ya tiene `categoryId`, agregar `categoryName` en output |

### Skill nuevo:

```typescript
// lib/skills/odoo/get-sales-by-category.ts
name: 'get_sales_by_category'
description: `Ventas agrupadas por categoría de producto.

USAR CUANDO: "ventas por línea", "mix de productos", "distribución por categoría",
"cuánto vendimos de equipamiento vs descartables"
RETORNA: [{ categoryName, categoryId, total, count, percentage }]`
```

### Tests:

- Unit test por skill: `categoryName` presente en output
- Evals nuevos:
  - "¿Cuánto vendimos en cada categoría?"
  - "¿Qué categoría creció más vs mes pasado?"
  - "¿Quién compra más [categoría]?"

### Estimación: ~4-6h

---

## ✅ F3.3 — Loop de Mejora Continua con Complejidad Progresiva (COMPLETADO)

> **Completado:** 2026-02-08. Loop progresivo L1→L5 con V2 engine.
> - `orchestrator.ts` reescrito: usa `generateTextWithThinking` (V2)
> - `types.ts` migrado: `LevelResult`, `ProgressiveLoopResult`, `LoopConfig` con niveles
> - 67 test cases clasificados: 28 L1, 21 L2, 9 L3, 6 L4, 3 L5
> - `TEST_CASES_BY_DIFFICULTY` export en test-cases.ts
> - `scripts/progressive-loop.ts` CLI runner (--live, --audit, --baseline, --level, --categories)
> - `npm run improve`, `npm run audit`, `npm run baseline`
> - Baseline completo L1→L5: L1 96% (27/28) | L2 100% (21/21) | L3 100% (9/9) | L4 100% (6/6) | L5 100% (3/3)
> - 66/67 total = 98.5%, 0 cambios sugeridos, todos los niveles graduados
> - 0 TS errors, 283/283 unit tests

**Problema:** El improvement loop existe (`lib/improvement/`) pero:
- Usa V1 (`native-gemini.ts`) → deuda técnica
- `improver.ts` solo soporta cambios de `description` (312 líneas, parcial)
- Los 69 test cases son planos — sin concepto de dificultad
- No se corre regularmente → no genera valor

**Contexto de las charlas:**
> "El loop de mejora ES el producto. El chat es solo la interfaz."

**Solución:** Un loop que empieza con consultas simples, sube la dificultad progresivamente,
identifica debilidades, mejora skills, y vuelve a correr. Como un curriculum de entrenamiento.

---

### Niveles de Dificultad

| Nivel | Qué testea | Ejemplo |
|---|---|---|
| **L1 - Básico** | 1 skill, pregunta directa | "¿Cuánto vendimos en enero?" |
| **L2 - Parámetros** | 1 skill, con filtros/defaults/variaciones | "Dame ventas de la semana pasada en USD, sin IVA" |
| **L3 - Ambiguo** | Routing correcto, lenguaje informal | "¿cómo venimos de guita?" "¿estamos al día?" |
| **L4 - Multi-skill** | 2+ tools en una respuesta, cruce de datos | "¿Vendimos más que lo que compramos?" "¿Mi precio es competitivo?" |
| **L5 - Insight** | Interpretación, conexiones, recomendaciones | "¿Debería preocuparme por algo?" "¿Qué debería hacer?" |

### El Loop

```
Nivel actual = L1
REPEAT:
  1. Correr todos los tests del nivel actual
  2. Auditar cada respuesta (auditor.ts)
  3. Si pass rate ≥ 85%:
     → Graduar al siguiente nivel
     → Guardar baseline de este nivel
  4. Si pass rate < 85%:
     → Consolidar sugerencias (qué skills mejorar)
     → Aplicar cambios (descriptions, params, defaults)
     → Re-correr SOLO los que fallaron
     → Repetir hasta pasar o max_retries=3
  5. Post-graduación: re-correr gold standards de niveles anteriores
     → Si regresan → revertir cambios y marcar conflicto
UNTIL nivel == L5 o max_iterations
```

### Reporte por Iteración

```
=== ITERATION 3 ===
Level: L3 (Ambiguo)
Pass: 7/10 (70%) ❌
Regressed from L1/L2: 0 ✅

Top issues:
- "¿cómo venimos de guita?" → usó get_bank_balance en vez de get_sales_total
- "¿estamos al día?" → no entendió que es cobranzas

Suggested changes:
- get_sales_total.description: agregar "guita", "cómo venimos"
- get_accounts_receivable.description: agregar "al día", "todo pago"

Applied → Re-run: 9/10 (90%) ✅ → GRADUATE TO L4
```

---

### Consultas por Nivel — El Curriculum

#### L1 - Básico (ya cubierto, ~40 test cases existentes)
Los actuales ventas-001, compras-001, stock-001, etc. La mayoría son L1.

#### L2 - Parámetros y Variaciones
```typescript
// Filtros que el LLM debe resolver sin preguntar
'Dame las ventas de enero solo en dólares'
'¿Cuánto cobramos esta semana sin contar transferencias?'
'Top 3 productos por cantidad, no por facturación'
'Facturas vencidas de más de 60 días'
'Stock de productos que contengan "guante" o "barbijo"'
'Compras del último trimestre a proveedores nuevos'
```

#### L3 - Ambiguo / Coloquial
```typescript
// El LLM tiene que interpretar qué quiere el usuario
'¿Cómo venimos de guita?'                    // → get_sales_total (period: this_month)
'¿Estamos al día?'                            // → get_accounts_receivable (vencidas)
'¿Tenemos algo pendiente?'                    // → múltiple: stock bajo + facturas vencidas
'¿Se movió algo hoy?'                         // → ventas del día + cobros del día
'Che, ¿hay drama con algún cliente?'          // → deuda vencida por cliente
'¿La caja cierra?'                            // → saldo disponible vs deudas por pagar
'¿Estamos para comprar?'                      // → tesorería + deuda pendiente
'Resumime la semana'                          // → ventas + cobros + stock bajo
```

#### L4 - Multi-skill / Cruce de Datos
```typescript
// Requiere llamar 2+ tools y CONECTAR la información
'¿Vendimos más que lo que compramos este mes?'
  // → get_sales_total + get_purchases_total → comparar

'¿Nuestro precio del Sillón Cingol es competitivo?'
  // → search_products (precio interno) + search_mercadolibre (precio mercado)

'¿El cliente que más nos debe es también el que más nos compra?'
  // → get_debt_by_customer + get_sales_by_customer → cruzar

'Compramos más de lo que vendimos... ¿tenemos con qué pagar?'
  // → get_purchases_total + get_sales_total + get_bank_balance

'¿Qué productos nuestros están más caros que en MercadoLibre?'
  // → get_top_products + search_mercadolibre por cada uno → comparar

'¿Los productos que más vendemos son los que menos stock tienen?'
  // → get_top_products + get_product_stock → correlación

'Comparar lo que le vendimos a Cedent vs lo que nos deben'
  // → get_sales_by_customer(Cedent) + get_accounts_receivable(Cedent)

'¿Cuánto margen tenemos si compramos a $X y en MeLi se vende a $Y?'
  // → get_purchase_price + search_mercadolibre → calcular margen

'¿Qué proveedor nos da mejor precio para lo que más vendemos?'
  // → get_top_products + get_purchases_by_supplier → correlación
```

#### L5 - Insight / Análisis / Recomendación
```typescript
// El agente debe INTERPRETAR datos y dar valor, no solo números
'¿Debería preocuparme por algo?'
  // → revisar cobranzas vencidas + stock bajo + tendencia ventas
  // Respuesta esperada: destacar los 2-3 problemas más urgentes

'¿Cómo evalúas la salud financiera del negocio?'
  // → ventas vs compras + cobranzas + tesorería + tendencia
  // Respuesta esperada: diagnóstico con datos y recomendaciones

'¿Qué productos deberíamos dejar de vender?'
  // → productos con baja rotación + bajo margen + stock alto

'¿Estamos creciendo o achicándonos?'
  // → comparativa de ventas últimos 3 meses + clientes nuevos vs perdidos

'¿En qué debería invertir la plata que tenemos?'
  // → stock que rota rápido + productos con buen margen + demanda MeLi

'Si me quedo sin stock de lo más vendido, ¿cuántos días aguanto?'
  // → stock actual / velocidad de venta → días de cobertura

'¿Qué cliente debería llamar hoy?'
  // → clientes con deuda vencida + clientes que bajaron compras
  // Respuesta esperada: priorizado con razón

'Dame un brief para la reunión de directorio'
  // → resumen ejecutivo: ventas, cobranzas, stock, tendencias, alertas

'¿Estamos vendiendo más barato que el mercado?'
  // → top productos internos vs precios MeLi → análisis de posicionamiento

'Si un cliente me pide descuento del 15%, ¿me conviene?'
  // → margen actual + volumen del cliente + riesgo de perderlo
```

---

### Cambios Técnicos

| Archivo | Cambio |
|---|---|
| `tests/evals/test-cases.ts` | Agregar campo `difficulty: 1\|2\|3\|4\|5` a `EvalTestCase` |
| `tests/evals/test-cases.ts` | Clasificar los 69 existentes (mayoría L1-L2) + agregar L3-L5 |
| `lib/improvement/orchestrator.ts` | Migrar V1 → V2, loop por nivel progresivo |
| `lib/improvement/types.ts` | Migrar V1 → V2, agregar `difficulty` a `TestScenario` |
| `lib/improvement/improver.ts` | Ampliar soporte más allá de descriptions |
| `scripts/progressive-loop.ts` | Nuevo: runner del loop progresivo |
| `package.json` | Agregar `npm run improve`, `npm run baseline`, `npm run audit` |

### Output del Loop

Cada corrida genera `baselines/YYYY-MM-DD.json`:
```json
{
  "date": "2026-02-07",
  "model": "gemini-3-flash-preview",
  "levels": {
    "L1": { "total": 40, "passed": 38, "rate": 0.95 },
    "L2": { "total": 10, "passed": 7, "rate": 0.70 },
    "L3": { "total": 0, "passed": 0, "rate": 0 }
  },
  "maxLevelPassed": "L1",
  "changes_applied": [
    { "skill": "get_sales_total", "field": "description", "diff": "..." }
  ],
  "regressions": []
}
```

### Criterio de Éxito

- L1: ≥ 95% (ya estamos cerca)
- L2: ≥ 85%
- L3: ≥ 85%
- L4: ≥ 75% (multi-skill es más difícil)
- L5: ≥ 70% (insights son subjetivos)

### Estimación: ~6-8h (incluye crear consultas L3-L5 y migrar loop)

---

## ✅ F3.4 — Deprecar V1 Completamente (COMPLETADO)

> **Completado:** 2026-02-08. `native-gemini.ts` eliminado (358 líneas de dead code).
> - 0 imports de V1 en todo el codebase (verificado con grep)
> - LLM engine (`llm-engine.ts`) es completamente independiente
> - 283/283 unit tests siguen pasando

**Problema resuelto:** `native-gemini.ts` (V1, 358 líneas) era dead code. Generaba confusión entre V1 y V2.

### Verificación: `grep -rn "native-gemini[^-v]" lib/ app/ tests/` → 0 resultados ✅

---

## 🎯 F3.5 — RAG como Tool Inteligente

**Problema:** Hoy el RAG inyecta documentos en el system prompt automáticamente cuando `rag_enabled=true`. Esto:
- Gasta tokens siempre, aunque no sea relevante
- Mete ruido cuando la pregunta no es sobre documentos
- No deja que el LLM decida cuándo buscar

**Decisión de arquitectura (de las charlas):**
> "¿Dust usa el RAG como un tool? Me pareció interesante la idea."

Sí. El LLM decide cuándo buscar en documentos, igual que decide cuándo buscar ventas.

### Cambio:

```typescript
// ANTES (engine.ts):
if (agent.rag_enabled) {
  const docs = await searchDocuments(tenantId, agentId, message)
  systemPrompt += `\nCONTEXTO:\n${docs.map(...)}`  // SIEMPRE inyecta
}

// DESPUÉS (como tool):
// El LLM decide llamar a search_knowledge_base cuando lo necesita
// Si no es relevante, no lo llama → ahorra tokens
```

### Implementación:

```typescript
// lib/tools/definitions/rag-tool.ts (ya existe parcialmente)
description: `Buscar en documentos y base de conocimiento de la empresa.

USAR CUANDO: políticas internas, procedimientos, manuales, contratos,
"¿cuál es nuestra política de X?", "¿qué dice el manual sobre Y?"
NO USAR: para datos de Odoo (ventas, stock) o precios de MeLi`
```

Y remover la inyección automática de `engine.ts`.

### Tests:
- Eval: "¿Cuál es nuestra política de devoluciones?" → llama `search_knowledge_base`
- Eval: "¿Cuánto vendimos?" → NO llama `search_knowledge_base`

### Estimación: ~2h

---

## 🎯 F3.6 — Evals de Calidad de Respuesta (no solo selección)

**Problema:** Los evals actuales validan que el agente "entienda la pregunta" (selección de tool + datos correctos). Pero no validan la CALIDAD de la respuesta — si da insights, si conecta puntos, si ofrece contexto relevante.

**Lo que genera el "wow":**
- ❌ "Vendiste $4.2M en enero" → dato crudo
- ✅ "Vendiste $4.2M, 25% menos que diciembre. Tu mejor cliente bajó 40%, probablemente vacaciones. Aparecieron 3 clientes nuevos." → inteligencia

### Plan:

Agregar evals que validen CALIDAD, no solo CORRECCIÓN:

```typescript
const qualityCases = [
  {
    query: '¿Cuánto vendimos en enero?',
    mustInclude: ['comparativa', 'tendencia'],  // debe comparar con algo
    mustNotInclude: ['no tengo información'],
  },
  {
    query: '¿Quién nos debe más?',
    mustInclude: ['vencido', 'días'],  // debe mencionar aging
    mustNotInclude: [],
  },
  {
    query: '¿Cómo viene el stock?',
    mustInclude: ['crítico', 'bajo', 'alerta'],  // debe destacar problemas
    mustNotInclude: [],
  },
]
```

### Cómo implementar:

El `system_prompt` del agente Odoo debe incluir instrucciones mínimas de calidad:

```
Cuando respondas sobre datos del negocio:
- Compará con el período anterior si es relevante
- Destacá si hay algo inusual o que requiera atención
- Ofrecé profundizar en lo más importante
```

No son 3000 tokens de instrucciones. Son 3 líneas que multiplican la calidad.

### Estimación: ~2-3h

---

## 📋 Orden de Ejecución

| # | Feature | Impacto en Inteligencia | Estado |
|---|---|---|---|
| 1 | **F3.1 Descripciones Ricas** | 🔥 El LLM elige mejor → respuestas correctas | ✅ Completado |
| 2 | **F3.2 Categorías** | 🔥 Respuestas más ricas, análisis por línea | ✅ Completado |
| 3 | **F3.3 Loop Progresivo** | 🔄 Motor de mejora continua con niveles L1→L5 | ✅ Completado |
| 4 | **F3.4 Deprecar V1** | 🧹 358 líneas eliminadas | ✅ Completado |
| 5 | **F3.5 RAG como Tool** | 💡 Ahorro de tokens + LLM decide cuándo buscar | ⬜ Siguiente |
| 6 | **F3.6 Evals de Calidad** | 📈 Medimos inteligencia, no solo corrección | ⬜ |

**Total estimado: ~18-24h**

---

## 🧪 Criterios de Éxito

| Métrica | Inicio | Actual | Target |
|---|---|---|---|
| Unit tests | 272 | 283 | ≥ 300 |
| Agent evals (total) | 69 | 67 (con difficulty) | ≥ 80 |
| Skills con descripción rica | ~4 | 32 (todos) | 35+ ✅ |
| Skills con `categoryName` | 3 | 8+ | 10+ |
| V1 eliminado | 2 archivos lo usan | ✅ 0 total, archivo borrado | 0 total ✅ |
| `npm run audit` | no existe | funcional ✅ | funcional ✅ |
| Loop progresivo | no existe | L1→L5 con V2 ✅ | funcional ✅ |

---

## 🚫 Qué NO entra en F3

Todo lo que no mejore directamente la inteligencia queda en el TUQUI_REFACTOR_PLAN.md (F4-F7):

- ❌ PWA / Push → F6 del refactor plan
- ❌ Onboarding wizard → F5 del refactor plan
- ❌ Memory tool → F4 del refactor plan (depende de que los skills base estén sólidos)
- ❌ User credentials → F5 del refactor plan
- ❌ Briefings / Alertas → F7 del refactor plan
- ❌ Prometeo → F7 del refactor plan
- ❌ Reescribir UI del chat
- ❌ Agregar más canales

**Primero que las respuestas sean impecables. Después todo lo demás.**

---

## 🔗 Relación con TUQUI_REFACTOR_PLAN.md

```
PHASE-3-PLAN.md (ESTE ARCHIVO)     TUQUI_REFACTOR_PLAN.md
═══════════════════════════════     ══════════════════════
F3.1 Descripciones ricas            F0 ✅ Tests baseline
F3.2 Categorías de producto         F1 ✅ Orquestador LLM
F3.3 Improvement loop               F2 ✅ Company context
F3.4 Deprecar V1                    F3 🟡 Skill descriptions (= F3.1 acá)
F3.5 RAG como tool                  F4 ⬜ Memory tool
F3.6 Evals de calidad               F5 ⬜ User credentials
                                    F6 ⬜ PWA/Push
                                    F7 ⬜ Briefings/Alertas
```

F3 de este plan = profundizar F3 del refactor plan + agregar categorías, improvement loop, y evals de calidad.

Todo va a mejor inteligencia. Sin excepción.
- ❌ Sistema de billing (fase 4)
- ❌ Multi-tenant aislado (fase 4)
- ❌ Nuevos agentes (MeLi, legal, etc.) — primero solidificar Odoo
- ❌ Prompts largos — la inteligencia está en las descripciones de tools

---

*Última actualización: 2026-02-08*
*Branch objetivo: `feat/phase-3`*
