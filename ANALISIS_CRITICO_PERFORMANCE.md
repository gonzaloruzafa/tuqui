# 🔍 Análisis Crítico de Performance - Tuqui Agents Alpha

**Fecha**: 2026-01-08
**Contexto**: Post-Iteración 1 (Routing optimizado al 100%)
**Objetivo**: Identificar gaps de inteligencia y valor en respuestas para iteración 2

---

## 📊 Estado Actual: Resumen Ejecutivo

### ✅ Wins Logrados

| Métrica | Antes | Ahora | Delta |
|---------|-------|-------|-------|
| **Routing Accuracy** | 44% | **100%** | **+56%** |
| **Cash Flow Queries** | 0% | 100% | +100% |
| **Stock Queries** | 0% | 100% | +100% |
| **Executive Dashboard** | 33% | 100% | +67% |
| **Price Intent Detection** | 50% | 100% | +50% |

**Impacto**: El router ahora envía el 100% de las consultas al agente correcto.

### ⚠️ Problemas Críticos Identificados

#### 1. **Tool Execution Rate: 0%** (CRÍTICO)

**Evidencia**: Tests conversacionales completamente fallidos
- Archivo: [conversational-2026-01-08.json](scripts/e2e-tests/results/conversational-2026-01-08.json)
- **0/19 turns exitosos** (0% success rate)
- **Todos los tests** fallan con: `Error: Chat API error: fetch failed`

**Diagnóstico**:
```json
{
  "toolExecutionRate": 0,
  "contextPreservation": 0,
  "avgLatencyMs": 16842  // Timeout = 15000ms
}
```

**Problema Real**: No hay datos reales de ejecución end-to-end porque el API no estaba corriendo durante el test.

**Próxima acción**: Ejecutar tests E2E con API corriendo para obtener métricas reales.

---

#### 2. **Agente MeLi No Ejecuta Tools Inmediatamente** (CRÍTICO)

**Problema**: Según evidencia previa, el agente MeLi dice "dame un toque que busco" en lugar de ejecutar `ecommerce_search` inmediatamente.

**Evidencia histórica**:
```
Test MELI-02: "cuanto sale autoclave"
Expected: Ejecutar ecommerce_search inmediatamente
Actual: "¡Buenas! Dame un toque que busco los precios..."
```

**Causa raíz**:
- El prompt del agente MeLi no es lo suficientemente directivo
- No tiene ejemplos de "qué NO hacer"
- No tiene penalización por no ejecutar tool

**Solución implementada**:
- ✅ Migration 120: `meli_force_tool_execution.sql` (línea 1-48)
- Agregado: "⚡ REGLA CRÍTICA - EJECUTAR INMEDIATAMENTE"
- Agregado: Ejemplos de "❌ ESTO ESTÁ MAL"

**Pendiente**: Validar con tests E2E reales que funcione.

---

#### 3. **Contexto Temporal Insuficiente** (ALTO)

**Problema**: El agente BI no tiene claridad sobre fechas actuales.

**Evidencia esperada**:
```
Q: "¿Cuánto vendimos este mes?" (hoy es 8 ene 2026)
Expected: Filtrar date_order >= 2026-01-01
Actual (sin mejora): Podría interpretar mal "este mes"
```

**Solución implementada**:
- ✅ Migration 121: `improve_bi_temporal_context.sql`
- Agregado: `**HOY ES: {{CURRENT_DATE}}**`
- Agregado: Reglas explícitas sobre "hoy", "este mes", "semana"

**Pendiente**: Validar con tests E2E reales.

---

## 🎯 Gaps de Inteligencia y Valor

### Gap #1: Falta de Proactividad en Respuestas

**Problema**: Los agentes responden solo lo que se pregunta, sin agregar contexto valioso.

**Ejemplo esperado**:
```
User: "¿Cuánta plata tenemos en caja?"
Agente ahora: "$45,000"
Agente ideal: "$45,000. Esto es 30% menos que el mes pasado.
               Tenemos $12,000 en facturas vencidas que podríamos cobrar esta semana.
               ¿Querés que analice flujo de caja proyectado?"
```

**Recomendación**:
- Agregar al prompt BI: "SIEMPRE contextualiza con comparativas temporales"
- Agregar: "SIEMPRE identifica oportunidades de acción"

**Impacto esperado**: +40% en satisfacción del usuario (respuestas más valiosas)

---

### Gap #2: Cero Análisis Predictivo

**Problema**: El sistema solo reporta datos históricos, no predice.

**Ejemplo**:
```
User: "¿Qué productos sin stock?"
Agente ahora: "Autoclave 18L (3 unidades), Compresor 50L (1 unidad)"
Agente ideal: "Autoclave 18L (3 unidades, se agotan en ~4 días según venta promedio)
               Compresor 50L (1 unidad, CRÍTICO - se vendió el último hace 2 días)"
```

**Datos necesarios para implementar**:
- Historial de ventas por producto (último mes)
- Cálculo de "días de stock" = stock / promedio_diario

**Recomendación**:
1. Agregar query secundaria automática cuando detecta "sin stock"
2. Calcular tendencia de venta
3. Incluir en respuesta: "Se agota en X días"

**Impacto esperado**: +60% en valor percibido (permite tomar acción preventiva)

---

### Gap #3: Falta de Resumen Ejecutivo Automático

**Problema**: Si alguien pregunta "¿cómo estamos?", el agente no sabe qué resumir.

**Solución propuesta**: Crear "Executive Dashboard Tool"

```typescript
// Nuevo tool: executiveDashboard()
async function executiveDashboard(period: 'hoy' | 'semana' | 'mes') {
  const queries = [
    // Ventas totales vs período anterior
    { model: 'sale.order', filters: `state:sale date_order:${period}` },
    // Caja disponible
    { model: 'account.payment', filters: 'payment_type:inbound posted' },
    // Cuentas por cobrar vencidas
    { model: 'account.move', filters: 'state:posted payment_state:not_paid invoice_date_due < today' },
    // Stock crítico (< 10 unidades)
    { model: 'product.product', filters: 'type:product qty_available < 10' }
  ]

  // Ejecutar en paralelo, formatear como dashboard
  return {
    sales: {...},
    cash: {...},
    receivables: {...},
    criticalStock: {...},
    insights: [
      "Ventas -15% vs mes pasado",
      "Stock crítico en 3 productos",
      "Facturas vencidas: $45K"
    ]
  }
}
```

**Impacto esperado**: +80% en adopción (la gente quiere dashboards, no queries individuales)

---

### Gap #4: No Hay Follow-up Inteligente

**Problema**: El agente no sugiere próximas preguntas lógicas.

**Ejemplo**:
```
User: "¿Quién es mi mejor cliente?"
Agente ahora: "ACME Corp ($120,000 este año)"
Agente ideal: "ACME Corp ($120,000 este año, +25% vs año pasado).

               💡 Podés preguntarme:
               - ¿Qué productos le vendemos más?
               - ¿Tiene facturas pendientes?
               - ¿Cuándo fue su última compra?"
```

**Implementación**:
- Agregar al final del prompt BI: "Si es relevante, sugiere 2-3 próximas preguntas útiles"
- Template: `💡 Podés preguntarme:\n- [pregunta 1]\n- [pregunta 2]`

**Impacto esperado**: +50% en engagement (usuarios hacen más preguntas de valor)

---

### Gap #5: Falta de Alertas Proactivas

**Problema**: El agente solo responde, nunca alerta.

**Solución propuesta**: Sistema de "Insights Proactivos"

```typescript
// Prometeo job que corre cada mañana
async function dailyInsights(tenantId: string) {
  const alerts = []

  // Check stock crítico
  const lowStock = await odoo.query({
    model: 'product.product',
    filters: 'qty_available < 10'
  })
  if (lowStock.length > 0) {
    alerts.push(`⚠️ ${lowStock.length} productos con stock crítico`)
  }

  // Check facturas vencidas
  const overdue = await odoo.query({
    model: 'account.move',
    filters: 'invoice_date_due < today payment_state:not_paid'
  })
  if (overdue.total > 0) {
    alerts.push(`💰 $${overdue.total} en facturas vencidas`)
  }

  // Send notification
  await sendNotification(tenantId, {
    title: '📊 Resumen del día',
    alerts
  })
}
```

**Impacto esperado**: +100% en valor percibido (proactividad > reactividad)

---

## 🖥️ Análisis Crítico de UI/UX

### UI Issue #1: Chat Interface - Falta de Contexto Visual

**Archivo**: [app/chat/[slug]/page.tsx](app/chat/[slug]/page.tsx:1-714)

**Problema**: La interfaz de chat no muestra:
- ✅ Qué agente está respondiendo (visible)
- ❌ Qué tool se está ejecutando (NO visible en tiempo real)
- ❌ Score de confianza del routing (NO visible)
- ❌ Tiempo de respuesta (NO visible)

**Impacto**: El usuario no sabe si está esperando una búsqueda de MeLi (puede tomar 60s) vs una query Odoo (toma 3s).

**Solución propuesta**:
```tsx
// Agregar componente de "estado de ejecución"
<div className="response-metadata">
  <Badge>Agent: {message.agent}</Badge>
  <Badge>Tool: {message.toolExecuted || 'thinking...'}</Badge>
  <Progress value={executionProgress} />
  <span className="text-xs text-muted">~{estimatedTime}s</span>
</div>
```

**Mockup**:
```
┌─────────────────────────────────────────┐
│ 🤖 odoo-agent | Tool: odoo_query ⏱️ 3s │
│ Confidence: 95% (high)                  │
│ ████████████████████░░░░ 80%            │
└─────────────────────────────────────────┘
Encontré 12 productos con stock crítico...
```

---

### UI Issue #2: Admin Dashboard - No hay Métricas de Performance

**Archivo**: [app/admin/page.tsx](app/admin/page.tsx:1-131)

**Problema**: El admin solo ve configuración, NO ve:
- ❌ Success rate de routing (por agente)
- ❌ Latencia promedio de respuestas
- ❌ Tool execution rate
- ❌ Consultas más frecuentes

**Solución propuesta**: Agregar card "📊 Analytics"

```tsx
<Card>
  <CardHeader>
    <CardTitle>📊 Performance Analytics</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <MetricRow
        label="Routing Accuracy"
        value="100%"
        trend="+56% vs last week"
        status="success"
      />
      <MetricRow
        label="Avg Response Time"
        value="4.2s"
        trend="-1.2s vs last week"
        status="success"
      />
      <MetricRow
        label="Tool Execution Rate"
        value="67%"
        trend="-10% vs last week"
        status="warning"
      />
    </div>

    <h4>Top Queries</h4>
    <ol>
      <li>"¿Cuánto vendimos?" - 45 veces</li>
      <li>"Stock crítico" - 32 veces</li>
      <li>"Plata en caja" - 28 veces</li>
    </ol>
  </CardContent>
</Card>
```

---

### UI Issue #3: Voice Chat - Falta Feedback Visual

**Problema detectado en código**:
```tsx
// app/chat/[slug]/page.tsx línea ~400-450
const startListening = () => {
  recognition.start()
  setIsListening(true)  // Solo cambia estado
}
```

**Falta**:
- ❌ Visualización de onda de audio
- ❌ Transcripción en tiempo real
- ❌ Confirmación de "mensaje recibido"

**Solución**:
```tsx
<div className="voice-chat-visual">
  {isListening && (
    <>
      <WaveformVisualizer audioLevel={audioLevel} />
      <div className="transcript-preview">
        {interimTranscript || 'Escuchando...'}
      </div>
    </>
  )}
</div>
```

---

### UI Issue #4: Tabla de Resultados - Falta de Exportación

**Problema**: Los resultados de queries Odoo se muestran en tabla, pero:
- ❌ No se pueden exportar a CSV/Excel
- ❌ No se pueden copiar fácilmente
- ❌ No hay paginación (si hay 1000 productos, explota)

**Solución**:
```tsx
<div className="table-actions">
  <Button onClick={() => exportToCSV(results)}>
    📥 Exportar CSV
  </Button>
  <Button onClick={() => copyToClipboard(results)}>
    📋 Copiar
  </Button>
</div>

<DataTable
  data={results}
  pagination={{ pageSize: 50 }}
  virtualized  // Para listas largas
/>
```

---

## 🚀 Plan de Acción Iterativo

### Iteración 2A: Mejorar Tool Execution (CRÍTICO)

**Duración estimada**: 2-4 horas
**Impacto esperado**: Tool execution rate 0% → 90%+

#### Tareas:
1. ✅ **Migration 120 ya aplicada**: Prompt MeLi más directivo
2. ⏳ **Ejecutar tests E2E con API corriendo** (BLOQUEADO - esperando API)
3. ⏳ **Validar que MeLi ejecute tool inmediatamente**
4. ⏳ **Si falla**: Agregar penalización en prompt ("Si NO ejecutas tool, el usuario no recibe valor")

#### Success Criteria:
- Test MELI-02 debe ejecutar `ecommerce_search` sin decir "voy a buscar"
- Latencia promedio de MeLi < 45s (era 60s)
- 0 respuestas de "dame un toque"

---

### Iteración 2B: Agregar Contexto y Valor en Respuestas

**Duración estimada**: 4-6 horas
**Impacto esperado**: Satisfaction +40%, Engagement +50%

#### Tareas:
1. **Mejorar prompt BI para contexto automático**
   ```sql
   UPDATE master_agents SET system_prompt = '
   ...
   ## 💡 REGLA: AGREGA CONTEXTO VALIOSO

   Para TODA respuesta numérica:
   1. Comparar con período anterior ("vs mes pasado: +15%")
   2. Identificar tendencia ("viene subiendo 3 meses")
   3. Destacar anomalías ("⚠️ esto es 40% menos de lo normal")

   Para TODA lista de datos:
   1. Destacar top 3 más relevantes
   2. Calcular total/promedio si aplica
   3. Sugerir próxima acción ("Podés revisar...")

   Al final, si es relevante, sugerir 2-3 preguntas de follow-up:
   💡 Podés preguntarme:
   - [pregunta relacionada 1]
   - [pregunta relacionada 2]
   ' WHERE slug = 'odoo';
   ```

2. **Crear tests de "valor agregado"**
   ```json
   {
     "id": "VALUE-01",
     "message": "¿Cuánto vendimos hoy?",
     "expectedAgent": "odoo",
     "mustInclude": [
       "vs",  // Debe comparar con algo
       "$",   // Debe tener monto
       "%" OR "más" OR "menos"  // Debe tener contexto
     ],
     "mustSuggest": true  // Debe sugerir follow-up
   }
   ```

3. **Ejecutar y validar**

#### Success Criteria:
- 80%+ de respuestas incluyen comparativa temporal
- 60%+ de respuestas sugieren follow-up
- Usuarios hacen +2 preguntas promedio por sesión

---

### Iteración 2C: Dashboard Ejecutivo Tool

**Duración estimada**: 6-8 horas
**Impacto esperado**: Adoption +80%

#### Tareas:
1. **Crear nuevo tool**: `lib/tools/executive-dashboard.ts`
   - Queries paralelas para: ventas, caja, cobrar, stock
   - Cálculo de insights automáticos
   - Formato dashboard consistente

2. **Integrar en router**:
   ```typescript
   // router.ts
   if (detectExecutiveDashboardIntent(message)) {
     return {
       selectedAgent: odoo,
       forceTool: 'executive_dashboard',
       period: extractPeriod(message)  // 'hoy' | 'semana' | 'mes'
     }
   }
   ```

3. **Agregar keywords**:
   ```typescript
   'executive_dashboard_intent': [
     'cómo estamos', 'cómo andamos', 'resumen ejecutivo',
     'dashboard', 'panel', 'estado general', 'situación',
     'dame un resumen', 'números importantes'
   ]
   ```

4. **Tests**:
   ```json
   {
     "id": "EXEC-DASH-01",
     "message": "Dame un resumen de cómo estamos hoy",
     "expectedTool": "executive_dashboard",
     "mustInclude": [
       "Ventas:", "Caja:", "Por cobrar:", "Stock crítico:"
     ]
   }
   ```

#### Success Criteria:
- Queries ejecutivo se resuelven en < 10s (paralelo)
- Dashboard incluye 4+ métricas clave
- 90%+ usuarios satisfechos con resumen

---

### Iteración 3: UI/UX Improvements

**Duración estimada**: 8-12 horas
**Impacto esperado**: UX satisfaction +60%

#### Componentes a crear:
1. **ResponseMetadata Component**
   - Muestra: agent, tool, confidence, latency
   - Ubicación: Sobre cada respuesta del agente

2. **ExecutionProgress Component**
   - Barra de progreso para tools lentos (MeLi)
   - Mensaje: "Buscando en MercadoLibre... ~45s"

3. **Analytics Dashboard Card**
   - Admin panel con métricas de performance
   - Gráficos de: routing accuracy, latency, top queries

4. **VoiceVisualizer Component**
   - Onda de audio durante grabación
   - Transcripción en tiempo real

5. **DataExport Component**
   - Botones: CSV, Excel, Copiar
   - Paginación para tablas grandes

#### Success Criteria:
- Usuarios entienden qué está pasando en cada momento
- 0 confusión sobre "por qué tarda tanto"
- Admins ven métricas de performance sin código

---

## 📈 Métricas de Éxito Post-Iteración 2

| KPI | Baseline (hoy) | Target Post-It2 | Métrica |
|-----|----------------|-----------------|---------|
| **Routing Accuracy** | 100% ✅ | 100% | Direct routing tests |
| **Tool Execution Rate** | 0% (sin datos) | 90%+ | E2E tests |
| **Avg Response Time** | 16s | < 8s | E2E tests |
| **Context Preservation** | 0% (sin datos) | 85%+ | Conversational tests |
| **Value-Add Rate** | ? | 80%+ | % respuestas con contexto |
| **Follow-up Suggestions** | 0% | 60%+ | % respuestas con sugerencias |
| **User Satisfaction** | ? | 4.5/5 | Survey post-query |
| **Engagement Rate** | ? | 3+ queries/sesión | Analytics |

---

## 🎯 Próximos Pasos Inmediatos

### AHORA (Hoy):
1. ✅ Routing al 100% (COMPLETADO)
2. ⏳ **Ejecutar tests E2E con API corriendo** → Obtener métricas reales
3. ⏳ Validar migration 120 (MeLi tool execution)
4. ⏳ Validar migration 121 (contexto temporal BI)

### MAÑANA:
1. Analizar resultados E2E reales
2. Si tool execution < 80%: Iterar prompts
3. Si context preservation < 70%: Revisar historial en engine.ts

### ESTA SEMANA:
1. Implementar mejoras de "valor agregado" en respuestas
2. Crear executive dashboard tool
3. Mejorar UI con metadata de ejecución

---

## 🔥 Conclusión: ¿Dónde Está el Mayor Valor?

### Top 3 Mejoras de Mayor Impacto:

**#1: Executive Dashboard Tool (Impacto: 80%)**
- La gente NO quiere hacer 10 preguntas, quiere 1 dashboard
- Implementar ya este tool cambia el juego completamente

**#2: Respuestas con Contexto Automático (Impacto: 60%)**
- Números sin contexto = poco valor
- "Vendimos $10K" < "Vendimos $10K, -15% vs mes pasado, **deberíamos revisar marketing**"

**#3: UI Transparency (Impacto: 50%)**
- Si el usuario no sabe QUÉ está pasando, pierde confianza
- Mostrar: "Buscando en MeLi... 80%" vs "..." es la diferencia entre frustración y paciencia

### Bottleneck Actual:

**FALTA DE DATOS REALES** - Los tests conversacionales fallaron por falta de API corriendo.

**Siguiente paso crítico**: Ejecutar suite completa E2E con:
1. API corriendo
2. Odoo conectado
3. MeLi scraping funcional
4. 19 turns conversacionales completos

Esto revelará los problemas REALES vs los esperados.

---

**Fin del análisis crítico.**
