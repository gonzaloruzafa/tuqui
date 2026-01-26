# E2E Conversation Tests

Tests de conversaciones multi-turn para validar el sistema de Skills.

## 📋 Escenarios Disponibles

### 1. Sales Analysis
Flujo de análisis de ventas con drill-down progresivo:
- Ventas totales del período
- Mejores clientes
- Productos vendidos a un cliente
- Historial de ventas de un producto
- Stock del producto

### 2. Debt Collection
Workflow de cobranzas y gestión de deuda:
- Facturas vencidas
- Agrupación por cliente
- Detalle de facturas de un cliente
- Balance total del cliente

### 3. Inventory Management
Gestión de inventario y stock:
- Productos con stock bajo
- Últimas ventas de esos productos
- Valuación total de inventario
- Búsqueda de producto específico
- Consulta de stock

### 4. Vendor Management
Análisis de proveedores y compras:
- Total de compras del período
- Proveedores principales
- Facturas de un proveedor
- Búsqueda de contacto

### 5. Sales Team Performance
Evaluación de equipo de ventas:
- Ventas por vendedor
- Productos vendidos por el mejor vendedor
- Clientes del vendedor
- Facturas vencidas de esos clientes

### 6. Mixed Business Query
Consultas cross-módulo (dashboard CEO):
- Ventas de la semana
- Pagos recibidos
- Deuda pendiente
- Productos top
- Stock de productos top

### 7. Error Recovery
Manejo de consultas ambiguas:
- Consultas vagas
- Búsqueda de clientes
- Referencia a resultados previos

## 🚀 Uso

### Ejecutar todos los escenarios
```bash
npm run test:conversations
```

o:

```bash
tsx scripts/e2e-tests/conversation-test-runner.ts --all
```

### Ejecutar un escenario específico
```bash
tsx scripts/e2e-tests/conversation-test-runner.ts "Sales Analysis"
tsx scripts/e2e-tests/conversation-test-runner.ts debt
tsx scripts/e2e-tests/conversation-test-runner.ts inventory
```

## 🔧 Configuración

### Variables de Entorno

```bash
# .env.local
TEST_TENANT_ID=your-tenant-id
TEST_USER_EMAIL=test@example.com
```

### Configuración en el Código

Edita `TEST_CONFIG` en `conversation-test-runner.ts`:

```typescript
const TEST_CONFIG = {
  tenantId: 'your-tenant-id',
  userEmail: 'test@example.com',
  agentSlug: 'odoo-assistant',
  verbose: true,
  logToolCalls: true,
  saveResults: true,
};
```

## 📊 Output

### Console Output
```
================================================================================
🎬 Starting scenario: Sales Analysis
📝 Description: User investigates sales performance, drilling down from general to specific
🎯 Context: User is a sales manager reviewing Q4 2024 performance
================================================================================

--- Turn 1/5 ---
👤 User: ¿Cuánto vendimos en diciembre 2024?
📌 Notes: Initial broad question - should use sales total
🤖 Assistant: En diciembre 2024 vendimos un total de $1,234,567.89...
🔧 Tools: get_sales_total
✅ Skill Match: YES (expected: get_sales_total)
🔗 Context: MAINTAINED
⏱️  Duration: 1234ms

--- Turn 2/5 ---
👤 User: ¿Quiénes fueron los mejores clientes?
📌 Notes: Should maintain December period from previous turn
🤖 Assistant: Los mejores clientes de diciembre 2024 fueron:
1. Distribuidora del Sur - $456,789.00
2. Comercial Norte - $345,678.00
...
🔧 Tools: get_sales_by_customer
✅ Skill Match: YES (expected: get_sales_by_customer)
🔗 Context: MAINTAINED
⏱️  Duration: 987ms

...

================================================================================
📊 TEST SUMMARY
================================================================================

Scenarios: 6/7 passed (86%)
Turns: 28/35 successful (80%)
Total Duration: 45s
Avg per Turn: 1285ms

📋 Scenario Results:

✅ Sales Analysis: 5/5 turns (100%)
✅ Debt Collection: 4/4 turns (100%)
❌ Inventory Management: 4/5 turns (80%)
   Errors: 1
   - Context from previous turns not maintained
✅ Vendor Management: 4/4 turns (100%)
✅ Sales Team Performance: 4/4 turns (100%)
✅ Mixed Business Query: 5/5 turns (100%)
❌ Error Recovery: 2/3 turns (67%)
   Errors: 1
   - Expected skill 'search_customers' but got: get_sales_by_customer

================================================================================

💾 Results saved to: test-results/conversation-test-2026-01-25T10-30-45.json
```

### JSON Output

Los resultados se guardan en `test-results/conversation-test-TIMESTAMP.json`:

```json
{
  "scenario": "Sales Analysis",
  "success": true,
  "totalTurns": 5,
  "successfulTurns": 5,
  "totalDuration": 6234,
  "turns": [
    {
      "turn": 1,
      "userMessage": "¿Cuánto vendimos en diciembre 2024?",
      "assistantResponse": "En diciembre 2024 vendimos...",
      "toolCalls": [{ "name": "get_sales_total", "input": {...} }],
      "expectedSkill": "get_sales_total",
      "skillMatched": true,
      "contextMaintained": true,
      "duration": 1234
    },
    ...
  ],
  "errors": []
}
```

## ✅ Validaciones

Cada turn valida:

1. **Skill Selection**: ¿Usó el skill correcto?
2. **Context Maintenance**: ¿Mantuvo contexto de turnos anteriores?
3. **Response Quality**: ¿Respuesta completa y coherente?
4. **Error Handling**: ¿Maneja errores gracefully?

## 🛠️ Desarrollo

### Agregar un Nuevo Escenario

1. Edita `conversation-scenarios.ts`
2. Agrega tu escenario:

```typescript
export const myNewScenario: ConversationScenario = {
  name: 'My New Scenario',
  description: 'What this scenario tests',
  context: 'User context/role',
  turns: [
    {
      user: 'Primera pregunta del usuario',
      expectedSkill: 'get_sales_total',
      notes: 'Why this skill is expected'
    },
    {
      user: 'Pregunta de follow-up',
      expectedSkill: 'get_sales_by_customer',
      expectedContext: ['referencia al turno anterior'],
      notes: 'Should maintain context'
    },
  ],
};
```

3. Agrégalo a `allScenarios`:

```typescript
export const allScenarios = [
  salesAnalysisScenario,
  debtCollectionScenario,
  myNewScenario,  // <-- AQUÍ
  ...
];
```

4. Ejecuta:

```bash
tsx scripts/e2e-tests/conversation-test-runner.ts "My New Scenario"
```

## 🐛 Debugging

### Ver Detalles de un Escenario

Habilita verbose mode en `TEST_CONFIG`:

```typescript
const TEST_CONFIG = {
  verbose: true,
  logToolCalls: true,
  ...
};
```

### Ver Herramientas Usadas

```typescript
const TEST_CONFIG = {
  logToolCalls: true,  // Muestra qué skills se ejecutaron
  ...
};
```

### Guardar Resultados

```typescript
const TEST_CONFIG = {
  saveResults: true,  // Guarda JSON en test-results/
  ...
};
```

## 📈 Métricas

- **Scenario Success Rate**: % de escenarios que pasaron todos los turns
- **Turn Success Rate**: % de turns individuales exitosos
- **Context Maintenance**: % de turns que mantuvieron contexto
- **Skill Match Rate**: % de turns que usaron el skill esperado
- **Avg Duration**: Tiempo promedio por turn

## 🎯 Criterios de Éxito

Un escenario pasa si:
- ✅ Todos los turns usan el skill esperado
- ✅ El contexto se mantiene en todos los turns
- ✅ No hay errores de ejecución
- ✅ Las respuestas son coherentes

## 🚨 Troubleshooting

### "Skill not matched"
- Verifica que el skill esté registrado en `lib/skills/odoo/index.ts`
- Revisa la descripción del skill - debe ser clara para el LLM
- Chequea que el tenant tenga credenciales Odoo activas

### "Context not maintained"
- El LLM puede no estar capturando referencias ("ese cliente", "eso")
- Revisa el system prompt para mejorar instrucciones de contexto
- Considera agregar más ejemplos en el prompt

### "AUTH_ERROR"
- Verifica que `TEST_TENANT_ID` tenga una integración Odoo activa
- Chequea que las credenciales estén correctamente encriptadas
- Revisa los logs de `lib/skills/loader.ts`

### Timeouts
- Aumenta el timeout en el runner
- Verifica la conexión a Odoo
- Chequea que el servidor Odoo esté respondiendo

## 📚 Referencias

- [Conversation Scenarios](./conversation-scenarios.ts) - Definición de escenarios
- [Test Runner](./conversation-test-runner.ts) - Lógica de ejecución
- [Chat Engine](../../lib/chat/engine.ts) - Engine de conversación
- [Skills System](../../lib/skills/) - Sistema de Skills
