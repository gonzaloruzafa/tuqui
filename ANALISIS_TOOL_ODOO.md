# 🔧 Análisis Integral: Odoo Intelligent Query Tool

**Fecha**: 2026-01-09
**Objetivo**: Analizar arquitectura actual, identificar problemas basados en E2E tests, diseñar refactor

---

## 📊 Estado Actual de E2E Tests

### Tests Odoo que PASAN (7/11 = 64%)

| Test | Query | Funciona | Tool usado |
|------|-------|----------|------------|
| ✅ CASH-02 | "¿Cuánto nos deben los clientes?" | ✅ | odoo_intelligent_query |
| ✅ CASH-03 | "¿Qué facturas vencidas?" | ✅ | odoo_intelligent_query |
| ✅ SALES-03 | "Top 10 productos vendidos" | ✅ | odoo_intelligent_query |
| ✅ CEO-01 | "Resumen ejecutivo del mes" | ✅ | odoo_intelligent_query (3 queries) |
| ✅ CEO-02 | "¿Cómo estamos vs mes pasado?" | ✅ | odoo_intelligent_query |
| ✅ CHAIN-01 Step 2 | "¿Y ayer?" | ✅ | odoo_intelligent_query |
| ✅ CHAIN-01 Step 3 | "¿Cuál fue mejor?" | ✅ | odoo_intelligent_query |

### Tests Odoo que FALLAN (4/11 = 36%)

| Test | Query | Problema | Respuesta actual |
|------|-------|----------|------------------|
| ❌ SALES-01 | "¿Cuánto vendimos hoy?" | **No dice "$0"** | "No hubo ventas hoy" |
| ❌ SALES-02 | "Ranking de vendedores del mes" | **No dice "$0"** | "No se encontraron ventas" |
| ❌ OPS-02 | "Inventario valorizado total" | **Error en query** | "No pude obtener el valor" |
| ❌ CHAIN-01 Step 1 | "¿Cuánto vendimos hoy?" | **No dice "$0"** | "No hubo ventas hoy" |
| ❌ CHAIN-02 Step 2 | "¿Cuánto nos compró este mes?" | **No dice "$0"** | "no realizó compras" |

---

## 🏗️ Arquitectura Actual

```
User Query
    ↓
1. INTERPRETER (odoo/interpreter.ts)
   - Analiza mensaje + historial
   - Detecta modelo, operación, período
   - Output: InterpretedQuery
    ↓
2. BI AGENT (gemini-odoo-v2.ts)
   - Recibe interpretación
   - Ejecuta odoo_intelligent_query tool
   - Procesa multi-query en paralelo
    ↓
3. QUERY BUILDER (odoo/query-builder.ts)
   - Construye domains de Odoo
   - Ejecuta queries (search/count/aggregate)
   - Cachea resultados (5 min)
    ↓
4. POST-PROCESSING
   - Comparisons (odoo/comparisons.ts)
   - Insights (odoo/insights.ts)
   - Chart data
    ↓
Response to User
```

### Módulos Existentes:

1. **gemini-odoo-v2.ts** (720 líneas)
   - Prompt BI_ANALYST_PROMPT
   - odoo_intelligent_query tool declaration
   - chatWithOdoo() y streamChatWithOdoo()

2. **odoo/interpreter.ts** (7K líneas aprox)
   - interpretQuery(): Analiza mensaje + historial
   - Detecta: modelo, período, groupBy, metric

3. **odoo/query-builder.ts** (25K líneas)
   - executeQueries(): Ejecuta multiple queries en paralelo
   - buildDomain(): Construye filtros Odoo
   - generateChartData()

4. **odoo/comparisons.ts** (9K líneas)
   - MoM, YoY comparisons
   - calculateVariation()

5. **odoo/insights.ts** (17K líneas)
   - Genera insights automáticos
   - Top clients, tendencias, alertas

6. **odoo/client.ts** (6K líneas)
   - getOdooClient(): Conecta con Odoo XML-RPC

---

## 🐛 Problemas Identificados

### 1. **"No hubo ventas" en vez de "$ 0"** (CRÍTICO)

**Evidencia**:
```json
{
  "question": "¿Cuánto vendimos hoy?",
  "response": "No hubo ventas registradas para hoy.",
  "expected": "$ 0 en ventas hoy"
}
```

**Causa Raíz**:
- El prompt tiene la regla "$0" pero Gemini la ignora
- Gemini ve `total: 0` o `count: 0` y responde "no hubo"
- El prepend que hicimos NO funcionó porque hizo el prompt muy largo

**Solución**:
1. **Post-processing en el tool** antes de retornar a Gemini:
   ```typescript
   if (toolResult.total === 0 || toolResult.count === 0) {
     toolResult.formatHint = "ZERO_AMOUNT"
     toolResult.zeroMessage = "$ 0 en [lo consultado]"
   }
   ```

2. **Prompt más corto con few-shot examples**:
   ```
   SI tool_result.total === 0 → "$ 0 en ventas hoy"

   Ejemplos:
   Q: ¿Cuánto vendimos?
   Tool: {total: 0}
   A: $ 0 en ventas hoy

   Q: Ranking vendedores
   Tool: {count: 0}
   A: $ 0 en ventas. No hay ranking.
   ```

---

### 2. **"No pude obtener el valor del inventario"** (ALTO)

**Evidencia**:
```json
{
  "question": "Dame el inventario valorizado total",
  "response": "No pude obtener el valor total del inventario en este momento.",
  "agent": "odoo",
  "toolsUsed": ["odoo_intelligent_query"]
}
```

**Causa Raíz**:
- Query de `stock.quant` con aggregate `value:sum` falla
- Odoo no tiene campo "value" en stock.quant
- Necesita calcular: `quantity * standard_price`

**Solución**:
1. **Agregar modelo stock.quant al MODEL_CONFIG** con campos correctos:
   ```typescript
   'stock.quant': {
     dateField: 'write_date',
     defaultFields: ['product_id', 'location_id', 'quantity', 'reserved_quantity'],
     aggregateFields: {
       'total_value': 'quantity * product_id.standard_price'  // Calculated field
     }
   }
   ```

2. **Prompt con ejemplo específico**:
   ```
   Q: "inventario valorizado total"
   → model: stock.quant
   → operation: aggregate
   → filters: "location_id.usage:internal"
   → aggregateField: "quantity:sum"
   → NOTE: Para valor total, multiplicar por precio
   ```

---

### 3. **Routing incorrecto para queries críticas** (MEDIO)

**Evidencia**:
```json
{
  "question": "¿Cuánta plata tenemos en caja?",
  "agent": "tuqui",  // ❌ Debería ser "odoo"
  "response": "No tengo acceso directo..."
}
```

**Causa**: Router no detecta keywords ERP
**Solución**: YA IMPLEMENTADA (ERP_OVERRIDE_KEYWORDS)
**Pendiente**: Validar que funcione

---

## 🎯 Plan de Refactor

### Objetivo:
**Aumentar E2E success rate de 43.8% a 85%+ en 3 iteraciones**

---

### Fase 1: Fix "$0" Problem (CRÍTICO) ⏰ 2-3 horas

#### 1.1: Modificar executeIntelligentQuery() para agregar hints

**File**: `lib/tools/gemini-odoo-v2.ts:274`

```typescript
async function executeIntelligentQuery(...): Promise<OdooToolResult> {
  // ... existing code ...

  const result: OdooToolResult = {
    success: true,
    data: allData.length > 0 ? allData : undefined,
    count: totalCount,
    total: totalAmount > 0 ? totalAmount : undefined,
    grouped: Object.keys(allGrouped).length > 0 ? allGrouped : undefined,
    // ... existing fields ...
  }

  // ✅ NUEVO: Agregar hint si es resultado vacío
  if (totalAmount === 0 && totalCount === 0) {
    result.formatHint = "ZERO_RESULT"
    result.suggestedResponse = "$ 0 en [lo consultado]"
  }

  return result
}
```

#### 1.2: Actualizar BI_ANALYST_PROMPT con few-shot

**File**: `lib/tools/gemini-odoo-v2.ts:76`

```typescript
const BI_ANALYST_PROMPT = `Eres un analista de Business Intelligence experto.

## ⚡ REGLA #1 ABSOLUTA - SI formatHint === "ZERO_RESULT":
→ RESPONDE: "$ 0 en [lo que preguntó]"

NUNCA digas:
❌ "No hubo ventas"
❌ "No se encontraron datos"

EJEMPLOS OBLIGATORIOS:

User: "¿Cuánto vendimos hoy?"
Tool: {total: 0, formatHint: "ZERO_RESULT"}
Response: "$ 0 en ventas hoy"

User: "Ranking de vendedores"
Tool: {count: 0, formatHint: "ZERO_RESULT"}
Response: "$ 0 en ventas este mes. No hay ranking para mostrar."

User: "¿Cuánto nos compró X?"
Tool: {total: 0, formatHint: "ZERO_RESULT"}
Response: "$ 0 en compras este mes"

... (rest of prompt)
`
```

**Impacto esperado**: +25% success rate (4 tests arreglados)

---

### Fase 2: Fix "Inventario Valorizado" (ALTO) ⏰ 1-2 horas

#### 2.1: Agregar stock.quant al MODEL_CONFIG

**File**: `lib/tools/odoo/query-builder.ts`

```typescript
export const MODEL_CONFIG: Record<string, ModelConfig> = {
  // ... existing models ...

  'stock.quant': {
    dateField: 'write_date',
    defaultFields: [
      'product_id',
      'location_id',
      'quantity',
      'reserved_quantity'
    ],
    filters: {
      'internal': [['location_id.usage', '=', 'internal']],
      'valorizado': [['location_id.usage', '=', 'internal'], ['quantity', '>', 0]]
    },
    // Nota: No tiene "value" directo, necesita query custom
  },

  'product.product': {
    dateField: 'write_date',
    defaultFields: [
      'name',
      'default_code',
      'list_price',
      'standard_price',  // ← Precio de costo
      'qty_available',
      'type'
    ]
  }
}
```

#### 2.2: Agregar ejemplo en prompt

**File**: `lib/tools/gemini-odoo-v2.ts:BI_ANALYST_PROMPT`

```typescript
**INVENTARIO VALORIZADO (Caso especial):**

Q: "inventario valorizado total"
→ OPCIÓN A (aproximado):
{
  model: "product.product",
  operation: "aggregate",
  filters: "type:product qty_available > 0",
  aggregateField: "qty_available:sum"  // Suma cantidades
}
Nota: Esto da cantidad total, no valor. Indicar "inventario aproximado"

→ OPCIÓN B (preciso pero lento):
{
  queries: [
    {
      id: "products_with_stock",
      model: "product.product",
      operation: "search",
      filters: "type:product qty_available > 0",
      limit: 500
    }
  ]
}
Luego calcular: sum(qty_available * standard_price) en tu respuesta
```

**Impacto esperado**: +6.25% success rate (1 test arreglado)

---

### Fase 3: Mejorar Interpreter (MEDIO) ⏰ 3-4 horas

#### 3.1: Agregar detección de "inventario valorizado"

**File**: `lib/tools/odoo/interpreter.ts`

```typescript
// Agregar a los patterns de detección:
const INVENTORY_PATTERNS = [
  /inventario.*valorizado/i,
  /valor.*inventario/i,
  /stock.*valorizado/i,
  /valorizacion.*stock/i
]

function detectInventoryValueQuery(message: string): boolean {
  return INVENTORY_PATTERNS.some(p => p.test(message))
}

// En interpretQuery():
if (detectInventoryValueQuery(userMessage)) {
  return {
    intent: 'aggregate',
    model: 'product.product',
    description: 'Calcular valor total del inventario',
    metric: 'inventory_value',
    requiresCalculation: true,  // ← Flag especial
    filters: 'type:product qty_available > 0'
  }
}
```

#### 3.2: Agregar post-processing para calculations

**File**: `lib/tools/gemini-odoo-v2.ts:executeIntelligentQuery()`

```typescript
// Después de ejecutar queries:
if (interpreted.requiresCalculation && interpreted.metric === 'inventory_value') {
  // Datos vienen en allData con: qty_available, standard_price
  const totalValue = allData.reduce((sum, item) => {
    return sum + (item.qty_available * item.standard_price)
  }, 0)

  result.total = totalValue
  result.calculatedMetric = 'inventory_value'
  result.calculation = `Suma de (cantidad * precio costo) de ${allData.length} productos`
}
```

**Impacto esperado**: +6.25% success rate (OPS-02 100% confiable)

---

### Fase 4: Optimizaciones Performance (OPCIONAL) ⏰ 2-3 horas

#### 4.1: Caché más agresivo

**Actual**: 5 minutos
**Propuesto**: 15 minutos para queries frecuentes

```typescript
const CACHE_TTL = {
  'default': 5 * 60 * 1000,      // 5 min
  'inventory': 15 * 60 * 1000,   // 15 min (stock cambia poco)
  'customers': 30 * 60 * 1000,   // 30 min (clientes cambian menos)
  'sales': 2 * 60 * 1000          // 2 min (ventas actualizadas)
}
```

#### 4.2: Parallel query optimization

Actual: Ejecuta todas en paralelo
Problema: Si hay 5 queries y 1 falla, las otras 4 toman tiempo

```typescript
// Ejecutar críticas primero, luego opcionales
const criticalQueries = queries.filter(q => q.priority === 'high')
const optionalQueries = queries.filter(q => q.priority !== 'high')

const criticalResults = await executeQueries(odoo, tenantId, criticalQueries)

// Si críticas fallan, no ejecutar opcionales
if (criticalResults.some(r => !r.success)) {
  return { success: false, ... }
}

const optionalResults = await executeQueries(odoo, tenantId, optionalQueries)
```

---

## 📊 Impacto Proyectado

| Fase | Tests Arreglados | Success Rate | Esfuerzo |
|------|------------------|--------------|----------|
| **Baseline** | - | 43.8% | - |
| **Fase 1** ($ 0 fix) | +4 | **68.8%** | 2-3h |
| **Fase 2** (Inventario) | +1 | **75.0%** | 1-2h |
| **Fase 3** (Interpreter) | +0* | **75.0%** | 3-4h |
| **Routing fix** | +3 | **93.8%** | Ya hecho |

*Fase 3 hace Fase 2 más robusta, no suma tests directamente

**Total Esfuerzo**: 6-9 horas
**Target Final**: **93.8% success rate**

---

## 🚀 Orden de Implementación Recomendado

### Sprint 1 (HOY - 2-3 horas):
1. ✅ **Fase 1**: Fix "$0" problem
   - Modificar executeIntelligentQuery()
   - Actualizar BI_ANALYST_PROMPT con few-shot
   - Ejecutar E2E tests
   - **Target**: 43.8% → 68.8% (+25%)

### Sprint 2 (MAÑANA - 1-2 horas):
2. ✅ **Fase 2**: Fix inventario valorizado
   - Agregar stock.quant a MODEL_CONFIG
   - Agregar ejemplo en prompt
   - Ejecutar E2E tests
   - **Target**: 68.8% → 75% (+6.2%)

### Sprint 3 (PRÓXIMA SEMANA - 3-4 horas):
3. ✅ **Fase 3**: Mejorar interpreter
   - Detectar "inventario valorizado"
   - Post-processing calculations
   - Tests de regresión
   - **Target**: 75% → 75% (más robusto)

### Sprint 4 (OPCIONAL):
4. ⚡ **Fase 4**: Performance optimization
   - Caché inteligente
   - Query prioritization

---

## 🔍 Tests de Validación

Después de cada fase, ejecutar:

```bash
npm run test:e2e:odoo
```

**Success criteria por fase**:
- **Fase 1**: SALES-01, SALES-02, CHAIN-01 Step 1, CHAIN-02 Step 2 → PASS
- **Fase 2**: OPS-02 → PASS
- **Fase 3**: OPS-02 → 100% confiable (no errores intermitentes)

---

## 📚 Archivos a Modificar

### Fase 1:
- ✏️ `lib/tools/gemini-odoo-v2.ts` (BI_ANALYST_PROMPT + executeIntelligentQuery)

### Fase 2:
- ✏️ `lib/tools/odoo/query-builder.ts` (MODEL_CONFIG)
- ✏️ `lib/tools/gemini-odoo-v2.ts` (ejemplos en prompt)

### Fase 3:
- ✏️ `lib/tools/odoo/interpreter.ts` (detectInventoryValueQuery)
- ✏️ `lib/tools/gemini-odoo-v2.ts` (post-processing calculations)

---

## ✅ Conclusión

**El tool de Odoo está BIEN arquitecturado** pero tiene 2 problemas críticos:

1. **Gemini ignora la regla "$0"** → Fix: Agregar formatHint en tool result
2. **Inventario valorizado falla** → Fix: Agregar stock.quant config + calculation

Con estos 2 fixes (4-5 horas), vamos de **43.8% → 75% success rate**.

El routing fix que ya hicimos (ERP_OVERRIDE_KEYWORDS) debería sumar otro +18.8%, llevándonos a **93.8% total**.

**Next step**: Implementar Fase 1 ahora mismo.
