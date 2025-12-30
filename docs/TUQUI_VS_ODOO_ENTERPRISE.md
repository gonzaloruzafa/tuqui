# 📊 Informe Comparativo: Tuqui vs Odoo Enterprise AI

## Fecha: 29 de Diciembre 2025

---

## 🎯 Resumen Ejecutivo

| Aspecto | Tuqui | Odoo Enterprise |
|---------|-------|-----------------|
| **Enfoque** | Agente BI conversacional | Asistente multi-propósito integrado |
| **Disponibilidad** | Cualquier versión Odoo | Solo Enterprise 18+ |
| **Tecnología** | Gemini 2.5 Flash | OpenAI (principalmente) |
| **Retrieval** | Dinámico (fields_get) | Estático + dinámico |
| **Contexto** | Conversaciones encadenadas | Contexto de sesión |

---

## 🔍 Arquitectura de Retrieval

### Odoo Enterprise AI (`ai/data`)

**Herramientas principales:**
1. **`get_fields`** - Lista campos searchables de un modelo
   - Retorna: field_name|display_name|type|sortable|groupable|description
   - Solo campos searchables (no todos)
   - Formato CSV con pipe delimiter

2. **`search`** - Busca registros con domain JSON
   - Requiere domain válido construido con campos de `get_fields`

3. **`get_menu_details`** - Obtiene contexto de menús
   - Retorna domain, context, search_view del menú

**Flujo típico:**
```
1. get_fields("sale.order") → ver campos disponibles
2. Construir domain con campos válidos
3. search(domain) → obtener datos
```

### Tuqui BI Agent

**Herramientas:**
1. **`discover_model`** - Llama a `fields_get` de Odoo
   - Retorna TODOS los campos del modelo
   - Cache 1 hora para performance
   - Incluye: tipo, etiqueta, relaciones

2. **`search_records`** - Búsquedas puntuales
   - Para listados: "últimos 10 pedidos", "cliente X"
   - Validación de campos contra schema

3. **`analyze_data`** - Agregaciones BI (read_group)
   - Para reportes: "ventas por mes", "top productos"
   - Agregaciones server-side (no trae todos los registros)

**Flujo típico:**
```
1. Pregunta del usuario → System Prompt decide tool
2. Para modelos conocidos: usar campos documentados
3. Para modelos desconocidos: discover_model primero
4. search_records (listados) o analyze_data (BI)
```

---

## ⚖️ Diferencias Clave

### 1. Conocimiento de Campos

| Aspecto | Odoo Enterprise | Tuqui |
|---------|-----------------|-------|
| Campos core | Descubre dinámicamente | Documentados en prompt |
| Campos custom | Descubre dinámicamente | discover_model bajo demanda |
| Validación | Pre-consulta obligatoria | Schema + validación runtime |

**Odoo Enterprise:**
- SIEMPRE llama `get_fields` antes de cualquier consulta
- No tiene campos pre-documentados
- Cada consulta requiere 2+ llamadas API

**Tuqui:**
- Campos principales documentados en system prompt
- Solo usa `discover_model` para modelos desconocidos
- Menos llamadas API para consultas comunes

### 2. Tipo de Consultas

| Aspecto | Odoo Enterprise | Tuqui |
|---------|-----------------|-------|
| Agregaciones | search + procesamiento cliente | read_group server-side |
| Rankings | Traer datos + ordenar | analyze_data con limit |
| Comparativas | Manual con múltiples queries | Soporte nativo MoM/YoY |

**Odoo Enterprise:**
```python
# Para "ventas por vendedor"
1. get_fields("sale.order")
2. search con domain
3. Procesar resultados en cliente para agrupar
```

**Tuqui:**
```python
# Para "ventas por vendedor"
analyze_data(
    model="sale.order",
    groupby=["user_id"],
    fields=["amount_total:sum"]
)
# → Odoo hace la agregación, no trae todos los registros
```

### 3. Contexto Conversacional

| Aspecto | Odoo Enterprise | Tuqui |
|---------|-----------------|-------|
| Historial | Contexto de sesión | Chat history explícito |
| Referencias | "Desglosame" | ✅ Completo |
| Ordinales | "El segundo" | ✅ Completo |
| Modificadores | "Sin contar X" | ✅ Completo |

**Tuqui incluye reglas específicas para:**
- Referencias ordinales ("el primero", "el tercero")
- Desgloses ("desglosame por vendedor")
- Modificadores ("pero sin el 'sin asignar'")
- Continuaciones temporales ("y el mes pasado?")

### 4. Modelo de LLM

| Aspecto | Odoo Enterprise | Tuqui |
|---------|-----------------|-------|
| Modelo default | OpenAI GPT-4 | Gemini 2.5 Flash |
| Costo estimado | ~$0.03/query | ~$0.001/query |
| Latencia | ~2-3s | ~1-2s |
| Configurabilidad | Via settings | Hardcoded |

---

## 📈 Benchmark de Performance

### Resultados de 100 preguntas de negocio (Tuqui)

```
Preguntas individuales: 71/100 (71%)
Conversaciones encadenadas: 15/20 (75%)

Por categoría:
- Vendedores: 90%
- Comparativas: 90%
- Clientes: 80%
- Facturación: 80%
- Ventas: 80%
- Stock: 70%
- Productos: 70%
- Tendencias: 70%
- Alertas: 50%
- Operaciones: 30%
```

### Categorías problemáticas

1. **Operaciones (30%)** - Modelos menos documentados (CRM, stock avanzado)
2. **Alertas (50%)** - Requieren lógica compleja multi-modelo

---

## 💡 Ventajas de Cada Enfoque

### Odoo Enterprise AI

✅ **Integración nativa** - Parte del producto, sin setup
✅ **Multi-propósito** - No solo BI, también AI Fields, Knowledge
✅ **Soporte oficial** - Mantenido por Odoo
✅ **UI integrada** - Dentro de la interfaz de Odoo

❌ **Solo Enterprise** - No disponible para Community
❌ **Costo OpenAI** - API key requerida, costos por uso
❌ **Queries menos eficientes** - No usa read_group para agregaciones

### Tuqui

✅ **Cualquier Odoo** - Funciona con 14+, Community y Enterprise
✅ **Optimizado para BI** - read_group, agregaciones server-side
✅ **Contexto conversacional rico** - 75% de éxito en preguntas encadenadas
✅ **Bajo costo** - Gemini es ~30x más barato que GPT-4
✅ **Rápido** - Menos roundtrips, campos pre-documentados

❌ **Setup requerido** - Hay que configurar e instalar
❌ **No oficial** - No mantenido por Odoo
❌ **Solo BI** - No tiene AI Fields, autocompletar, etc.

---

## 🔮 Casos de Uso Recomendados

### Usar Odoo Enterprise AI cuando:
- Ya tenés Odoo Enterprise 18+
- Necesitás AI Fields (autocompletar campos)
- Querés integración nativa sin deploys externos
- El costo de OpenAI no es problema

### Usar Tuqui cuando:
- Tenés Odoo Community o versiones anteriores
- El foco es Business Intelligence / reportes
- Querés optimizar costos de LLM
- Necesitás conversaciones multi-turno fluidas
- Querés control total sobre el sistema

---

## 📊 Conclusión

Tuqui y Odoo Enterprise AI resuelven problemas similares con enfoques diferentes:

- **Odoo Enterprise** es más generalista y está integrado nativamente, pero requiere Enterprise y tiene costos más altos.

- **Tuqui** está optimizado para BI, funciona con cualquier Odoo, y usa técnicas más eficientes (read_group, campos pre-documentados) que resultan en mejor performance y menor costo.

Para empresas que ya usan Odoo Enterprise 18+, la solución nativa puede ser suficiente. Para el resto, Tuqui ofrece capacidades de BI avanzadas sin las limitaciones de licencia.

---

*Informe generado por análisis de código de odoo/enterprise (módulo ai/*) y testing de Tuqui con 100 preguntas de negocio.*
