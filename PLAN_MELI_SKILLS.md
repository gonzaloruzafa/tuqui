# Plan: MercadoLibre Skills System

## Objetivo
Crear un sistema de Skills dedicado para MercadoLibre, similar al sistema Odoo Skills, para reemplazar el uso genérico de `web_search`.

## Beneficios
1. **Type Safety**: Inputs/outputs tipados con Zod
2. **Testabilidad**: Skills atómicos y testeables independientemente
3. **Composabilidad**: Skills pueden combinarse
4. **Especialización**: Cada skill tiene un propósito específico
5. **Mejor UX**: Resultados estructurados y predecibles

## Arquitectura

### Estructura de archivos
```
lib/skills/mercadolibre/
├── _client.ts                    # Cliente unificado Serper + Tavily
├── index.ts                      # Exports de todos los skills
├── search-products.ts            # Buscar productos por query
├── compare-prices.ts             # Comparar precios similares
├── get-product-details.ts        # Detalles de producto específico
├── get-price-statistics.ts       # Estadísticas de precios (min, max, avg)
└── search-by-category.ts         # Buscar en categoría específica
```

### Skills a implementar

#### 1. **search_meli_products**
- **Propósito**: Buscar productos en MercadoLibre por query
- **Input**:
  - `query: string` - Términos de búsqueda
  - `limit?: number` - Cantidad de resultados (default: 5)
  - `sortBy?: 'price_asc' | 'price_desc' | 'relevance'`
- **Output**:
  ```typescript
  {
    products: Array<{
      id: string           // MLA-123456
      title: string
      price: number | null
      url: string
      snippet: string
    }>
    totalFound: number
    query: string
  }
  ```

#### 2. **compare_meli_prices**
- **Propósito**: Comparar precios de productos similares
- **Input**:
  - `productName: string`
  - `limit?: number`
- **Output**:
  ```typescript
  {
    productName: string
    minPrice: number | null
    maxPrice: number | null
    avgPrice: number | null
    priceRange: string      // "$ 10.000 - $ 50.000"
    products: Product[]
    insights: string        // "El precio promedio es $30.000"
  }
  ```

#### 3. **get_meli_product_details**
- **Propósito**: Obtener detalles de un producto específico por URL
- **Input**:
  - `url: string` - URL del producto
- **Output**:
  ```typescript
  {
    id: string
    title: string
    price: number | null
    description: string
    seller: string | null
    url: string
  }
  ```

#### 4. **get_price_statistics**
- **Propósito**: Estadísticas de mercado para un tipo de producto
- **Input**:
  - `productType: string`
  - `sampleSize?: number`
- **Output**:
  ```typescript
  {
    productType: string
    statistics: {
      min: number | null
      max: number | null
      avg: number | null
      median: number | null
    }
    sampleSize: number
    priceDistribution: string
  }
  ```

#### 5. **search_by_category**
- **Propósito**: Buscar en categoría específica de ML
- **Input**:
  - `category: string`
  - `query?: string`
  - `limit?: number`
- **Output**: Similar a search_products

## Implementación

### Fase 1: Core Infrastructure ✅
- [x] Crear `lib/skills/mercadolibre/_client.ts`
  - Wrapper de Serper + Tavily
  - Parseo de precios
  - Validación de URLs
- [x] Definir tipos base en `lib/skills/types.ts`
- [x] Crear estructura de carpetas

### Fase 2: Skills Básicos ✅
- [x] `search-products.ts`
- [x] `compare-prices.ts`
- [x] `get-product-details.ts` (removido - no necesario para MVP)

### Fase 3: Skills Avanzados ✅
- [x] `get-price-statistics.ts`
- [x] Actualizar `index.ts` con exports

### Fase 4: Integración ✅
- [x] Registrar skills en `lib/skills/registry.ts`
- [x] Actualizar `lib/skills/loader.ts` para mapear meli_search
- [x] Actualizar agente Meli para usar skills
- [x] Migración 125 aplicada (master_agents + tenant agents)
- [x] Build exitoso

### Fase 5: Testing ✅
- [x] Test script `scripts/test-meli-skills.ts`
- [x] Validación de estructura (✅ skills ejecutan correctamente)
- [x] Validación de URLs (✅ solo `/articulo/` válidos)
- [ ] Extracción de precios (⚠️ requiere web_investigator)
- [ ] Validación E2E con conversaciones reales

## Diferencias vs web_search

| Aspecto | web_search (actual) | MeLi Skills (nuevo) |
|---------|-------------------|-------------------|
| Tipado | `any` | Zod schemas estrictos |
| Outputs | Texto no estructurado | JSON tipado |
| Testeo | Difícil | Fácil (skills atómicos) |
| Caché | Genérico | Específico por skill |
| Errores | Genéricos | Descriptivos y específicos |
| Composición | No | Sí (skills combinables) |

## Ejemplos de uso

### Antes (web_search):
```typescript
await webSearchTool.execute({
  query: "precios de iPhone 15 mercadolibre"
})
// Output: Texto libre con URLs mezcladas
```

### Después (skills):
```typescript
await searchMeliProducts.execute({
  query: "iPhone 15",
  limit: 5,
  sortBy: "price_asc"
})
// Output: { products: [...], totalFound: 157, query: "..." }

await compareMeliPrices.execute({
  productName: "iPhone 15",
  limit: 10
})
// Output: { minPrice: 850000, maxPrice: 1200000, avgPrice: 950000, ... }
```

## Métricas de Éxito
1. ✅ 100% de queries de MeLi usan Skills (no web_search)
2. ✅ Latencia < 3s por skill (con caché)
3. ✅ 0 URLs inventadas (validación estricta)
4. ✅ Type safety completo (sin `any`)

## Próximos Pasos
1. Implementar skills básicos
2. Migrar agente Meli
3. Testear con conversaciones reales
4. Optimizar caché y latencia
