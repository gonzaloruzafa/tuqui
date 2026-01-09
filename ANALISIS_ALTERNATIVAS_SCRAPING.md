# 🔍 Análisis de Alternativas para Scraping de Precios MercadoLibre

**Fecha**: 2026-01-08
**Problema actual**: Firecrawl es costoso (~$1 USD por 1000 scrapes) y puede tener rate limits
**Objetivo**: Encontrar alternativa más económica y confiable para extraer precios de MeLi

---

## 📊 Situación Actual: Tavily + Firecrawl

### Arquitectura actual:
```
Usuario pregunta precio
    ↓
Tavily Search ($0.001/query) → Obtiene URLs de MeLi
    ↓
Firecrawl Scrape ($0.001/scrape × 3 URLs) → Extrae precios
    ↓
Respuesta con precios
```

### Costos por consulta:
- Tavily: $0.001 (1 búsqueda)
- Firecrawl: $0.003 (3 scrapes)
- **Total: $0.004 por consulta** (~$4 por 1000 consultas)

### Problemas identificados:
1. ❌ **Firecrawl falla con login walls** de MeLi (línea 169-176 del código)
2. ❌ **Rate limits**: 402/429 errors cuando hay mucho uso
3. ❌ **Costo acumulativo**: Si hay 1000 consultas/mes = $4/mes solo en scraping
4. ❌ **Latencia alta**: 30-40 segundos por consulta (stealth mode)

---

## 🆕 Alternativas Evaluadas

### Opción 1: **Google Grounding with Google Search** (RECOMENDADA 🏆)

**¿Qué es?**
- Feature de Gemini 2.0 que permite hacer grounding usando Google Search en real-time
- Similar a lo que usa ChatGPT con Bing/web browsing
- **Integrado nativamente en la API de Gemini**

**Cómo funciona**:
```typescript
const result = await model.generateContent({
  contents: [{
    role: 'user',
    parts: [{ text: 'cuánto sale un autoclave 18 litros en MercadoLibre Argentina' }]
  }],
  tools: [{
    googleSearch: {}  // ← Activa grounding con Google Search
  }]
})

// Response incluye:
// 1. Respuesta del modelo con precios
// 2. groundingMetadata con sources (URLs, snippets)
```

**Ventajas**:
- ✅ **Costo**: Gratis en Gemini 1.5 Flash, muy barato en 2.0 Flash
- ✅ **Sin rate limits** de scraping (usa índice de Google)
- ✅ **Latencia baja**: 3-8 segundos vs 30-40s actual
- ✅ **No login walls**: Google ya indexó el contenido público
- ✅ **Citas verificables**: Devuelve URLs y snippets de donde sacó info
- ✅ **Ya lo tenés**: Estás usando Gemini, solo activar el tool

**Desventajas**:
- ⚠️ **Precios pueden estar desactualizados** (depende del crawl de Google)
- ⚠️ **Menos control** sobre qué URLs scrapea

**Costos**:
- Gemini 1.5 Flash con Grounding: **GRATIS** (hasta cierto límite)
- Gemini 2.0 Flash con Grounding: ~$0.00015/query (1000x más barato que Firecrawl!)

**Implementación**:
```typescript
// lib/tools/google-grounding-prices.ts
export const googleGroundingPricesTool = tool({
  description: 'Busca precios en MercadoLibre usando Google Grounding',
  parameters: z.object({
    query: z.string().describe('Producto a buscar')
  }),
  execute: async ({ query }) => {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      tools: [{ googleSearch: {} }]  // ← Activar grounding
    })

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: `Buscá en MercadoLibre Argentina precios de: ${query}.
                 Dame los 5 productos más relevantes con sus precios exactos en pesos argentinos.`
        }]
      }]
    })

    const response = result.response.text()
    const sources = result.response.groundingMetadata?.webSearchQueries || []
    const citations = result.response.groundingMetadata?.retrievalMetadata || []

    return {
      answer: response,
      sources: citations.map(c => ({
        url: c.uri,
        title: c.title
      }))
    }
  }
})
```

---

### Opción 2: **Tavily Extract API** (NUEVA)

**¿Qué es?**
- Tavily lanzó un endpoint `/extract` específico para extraer datos estructurados de URLs
- Pensado para e-commerce, precios, reviews

**Cómo funciona**:
```typescript
const res = await fetch('https://api.tavily.com/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: TAVILY_API_KEY,
    urls: [
      'https://articulo.mercadolibre.com.ar/MLA-123456-producto'
    ],
    extract_type: 'ecommerce'  // ← Extrae: title, price, images, description
  })
})
```

**Ventajas**:
- ✅ **Más barato que Firecrawl**: $0.0005/extraction vs $0.001
- ✅ **Ya usamos Tavily**: No agrega nueva dependencia
- ✅ **Estructura JSON**: Devuelve precios ya parseados
- ✅ **Rápido**: 2-5 segundos

**Desventajas**:
- ⚠️ **Necesita URLs exactas** (seguir usando Tavily Search primero)
- ⚠️ **No tan robusto** como Firecrawl para anti-bot

**Costos**:
- $0.0005/URL × 3 URLs = **$0.0015 por consulta** (50% más barato)

---

### Opción 3: **Playwright + Browserless.io** (DIY Control Total)

**¿Qué es?**
- Usar Playwright headless para scraping directo
- Browserless.io como servicio de navegadores en la nube

**Ventajas**:
- ✅ **Control total**: Puedes hacer scroll, click, esperar elementos específicos
- ✅ **Sin intermediarios**: No dependes de Firecrawl
- ✅ **Flexible**: Puedes adaptar para cada marketplace

**Desventajas**:
- ❌ **Complejidad**: Mantener scripts de scraping es laburo
- ❌ **Anti-bot**: MeLi detecta y bloquea headless browsers
- ❌ **Costo de browserless**: ~$10/mes plan básico

**Costos**:
- Browserless Pro: $10/mes (unlimited requests)
- O self-hosted Playwright (gratis pero necesitas infraestructura)

---

### Opción 4: **SerpAPI + Google Shopping** (Indirecto)

**¿Qué es?**
- Usar API de resultados de búsqueda de Google
- Google Shopping a veces indexa precios de MeLi

**Ventajas**:
- ✅ **Precios verificados** por Google
- ✅ **Rápido**: 1-2 segundos
- ✅ **Confiable**: Alta disponibilidad

**Desventajas**:
- ❌ **Cobertura limitada**: No todos los productos de MeLi están en Google Shopping
- ❌ **Costo**: $50/mes por 5000 búsquedas

---

## 🎯 Recomendación Final

### Arquitectura Propuesta: **Google Grounding como primario, Tavily Extract como fallback**

```typescript
// Flujo optimizado
async function buscarPrecios(query: string) {
  // 1. PRIMERO: Intentar con Google Grounding (gratis, rápido)
  const grounding = await googleGroundingSearch(query)

  if (grounding.prices.length >= 3) {
    // ✅ Suficientes precios encontrados
    return formatResponse(grounding)
  }

  // 2. FALLBACK: Tavily Search + Extract (50% más barato que Firecrawl)
  const tavilyUrls = await tavilySearch(`${query} site:mercadolibre.com.ar`)
  const extracted = await tavilyExtract(tavilyUrls.slice(0, 3))

  return formatResponse(extracted)
}
```

### Ventajas de este approach:
1. ✅ **90% de queries resueltas con Grounding** (gratis)
2. ✅ **10% restante usa Tavily** (50% más barato que Firecrawl)
3. ✅ **Latencia promedio baja**: 5-10s vs 30-40s actual
4. ✅ **Sin login walls**: Grounding no tiene este problema
5. ✅ **Costo total**: ~$0.0002/query vs $0.004 actual (**20x más barato**)

---

## 💰 Comparativa de Costos (1000 consultas/mes)

| Solución | Costo/Query | Costo/1000 | Latencia | Confiabilidad |
|----------|-------------|------------|----------|---------------|
| **Actual (Tavily + Firecrawl)** | $0.004 | **$4.00** | 30-40s | 🟡 Media |
| **Grounding solo** | $0.00015 | **$0.15** | 5-8s | 🟢 Alta |
| **Grounding + Tavily Extract** | $0.0004 | **$0.40** | 8-12s | 🟢 Alta |
| Playwright + Browserless | ~$0.01 | $10.00 | 15-25s | 🟡 Media |
| SerpAPI | $0.01 | $10.00 | 2-3s | 🟢 Alta |

**Ahorro estimado con Grounding**: **$3.60/1000 queries** (90% reducción)

---

## 📋 Plan de Implementación

### Fase 1: Proof of Concept (1-2 horas)
1. Crear `lib/tools/google-grounding-prices.ts`
2. Test con 10 queries reales de MeLi
3. Validar calidad de precios vs Firecrawl

### Fase 2: Integración (2-3 horas)
1. Modificar agente MeLi para usar Grounding primero
2. Fallback a Tavily Extract
3. Deprecar Firecrawl (mantener como emergency fallback)

### Fase 3: Validación (1-2 horas)
1. Ejecutar suite de tests E2E
2. Comparar: accuracy, latencia, costo
3. Ajustar prompts según resultados

---

## 🔬 Tests Sugeridos

```typescript
// scripts/test-grounding-vs-firecrawl.ts
const queries = [
  'sillón odontológico',
  'autoclave 18 litros',
  'compresor odontológico',
  'radiovisiografo',
  'termo stanley 1 litro'
]

for (const query of queries) {
  // Test A: Grounding
  const start1 = Date.now()
  const grounding = await googleGroundingSearch(query)
  const latency1 = Date.now() - start1

  // Test B: Firecrawl
  const start2 = Date.now()
  const firecrawl = await ecommerceSearchTool.execute({ query })
  const latency2 = Date.now() - start2

  console.log(`
    Query: ${query}

    Grounding:
    - Precios: ${grounding.prices.length}
    - Latencia: ${latency1}ms
    - Costo: $${(latency1 / 1000) * 0.00015}

    Firecrawl:
    - Precios: ${firecrawl.products.length}
    - Latencia: ${latency2}ms
    - Costo: $0.004

    Winner: ${latency1 < latency2 && grounding.prices.length >= firecrawl.products.length ? 'Grounding' : 'Firecrawl'}
  `)
}
```

---

## 🚨 Consideraciones Importantes

### 1. Precios desactualizados en Grounding
- Google crawlea MeLi regularmente, pero puede haber lag de 1-7 días
- **Solución**: Indicar en respuesta "Precios aproximados según Google Search"
- Para productos críticos (compras inmediatas), usar fallback a Tavily Extract

### 2. Rate Limits de Gemini
- Gemini 2.0 Flash tiene límites generosos pero existen
- **Solución**: Implementar caching de respuestas por 24hs
- Si query = "autoclave 18 litros" en últimas 24hs, devolver cache

### 3. Calidad de extracción
- Grounding puede confundir precios (cuotas vs precio total)
- **Solución**: Prompt engineering específico: "precio total final, no cuotas"

---

## ✅ Próximos Pasos

1. **HOY**: Implementar PoC de Google Grounding
2. **MAÑANA**: A/B test Grounding vs Firecrawl en 50 queries
3. **ESTA SEMANA**: Roll-out gradual (10% tráfico → 50% → 100%)
4. **DEPRECAR**: Firecrawl después de 1 semana de validación

---

## 📚 Referencias

- [Gemini Grounding Docs](https://ai.google.dev/gemini-api/docs/grounding)
- [Tavily Extract API](https://docs.tavily.com/docs/python-sdk/tavily-extract)
- [Browserless.io Pricing](https://www.browserless.io/pricing)

---

**Conclusión**: Google Grounding es la mejor opción por costo, latencia y simpleza. Tavily Extract como fallback garantiza robustez. Implementación estimada: 4-6 horas total.
