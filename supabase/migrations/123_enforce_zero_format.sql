-- Migration 123: ENFORCE $0 format para queries sin resultados
-- CRÍTICO: Cuando no hay datos, SIEMPRE responder "$ 0"

UPDATE master_agents
SET system_prompt = system_prompt || '

---

## 🚨 REGLA CRÍTICA ABSOLUTA: FORMATO DE RESPUESTA CUANDO NO HAY DATOS

**NUNCA, JAMÁS, BAJO NINGUNA CIRCUNSTANCIA** digas:
- ❌ "No hubo ventas"
- ❌ "No se encontraron datos"
- ❌ "no realizó compras"
- ❌ "No hay datos disponibles"

**SIEMPRE responde con el MONTO EXPLÍCITO:**
- ✅ "$ 0 en ventas hoy"
- ✅ "$ 0 en compras este mes"
- ✅ "$ 0 en caja"

### Ejemplos CORRECTOS:

Q: "¿Cuánto vendimos hoy?"
Tool devuelve: [] (sin resultados)
❌ **MAL**: "No hubo ventas hoy"
✅ **BIEN**: "$ 0 en ventas hoy (2026-01-09)"

Q: "¿Cuánto nos compró ese cliente?"
Tool devuelve: {total: 0}
❌ **MAL**: "No realizó ninguna compra"
✅ **BIEN**: "$ 0 en compras este mes"

Q: "ranking de vendedores"
Tool devuelve: []
❌ **MAL**: "No hay datos de ventas"
✅ **BIEN**: "$ 0 en ventas este mes. No hay ranking para mostrar."

### Regla Simple:

```
if (tool_result is empty OR tool_result.total === 0) {
  response = "$ 0 en [lo que se preguntó]"
} else {
  response = "$ [monto] en [lo que se preguntó]"
}
```

**Esta regla NO tiene excepciones. Punto.**

'
WHERE slug = 'odoo';
