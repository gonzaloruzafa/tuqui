# TUQUI — Intelligence Layer

> De chatbot reactivo a dopamine loop de inteligencia de negocio.

**Última actualización:** 2026-02-16

---

## Visión

Tuqui no responde preguntas. **Tuqui genera adicción a inteligencia.**

```
Instagram:  "¿Qué foto nueva habrá?"     → abre 30 veces/día
TikTok:     "¿Qué video me toca ahora?"  → scroll infinito
Tuqui:      "¿Qué dato nuevo tiene?"     → abre cada mañana

La diferencia: en Tuqui cada dato genera ACCIÓN y DINERO.
```

El modelo mental: **cada vez que abrís Tuqui, hay algo nuevo que no sabías**. Nunca se repite. Siempre relevante. De fuentes cruzadas que vos solo no cruzarías.

---

## Arquitectura General

```
┌──────────────────────────────────────────────────────────────────────┐
│                      TUQUI INTELLIGENCE LAYER                        │
│                                                                      │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ PERFILES   │  │ DISCOVERY    │  │ ENTREGA    │  │ MEMORIA    │  │
│  │            │  │ ENGINE       │  │            │  │            │  │
│  │ Empresa    │  │              │  │ Chat open  │  │ Aprende    │  │
│  │ (auto)     │→ │ 6 Sources    │→ │ PWA Push   │→ │ del uso    │  │
│  │ Usuario    │  │ Multi-score  │  │ Suggested  │  │ Enriquece  │  │
│  │ (conversa) │  │ Variety      │  │ WhatsApp   │  │ perfil     │  │
│  │ Memoria    │  │ Cooldown     │  │            │  │ scoring    │  │
│  │ (auto)     │  │              │  │            │  │            │  │
│  └────────────┘  └──────────────┘  └────────────┘  └────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ 6 DISCOVERY SOURCES                                          │    │
│  │                                                              │    │
│  │ OdooSource     → ERP: ventas, stock, deudas, CRM            │    │
│  │ MarketSource   → MeLi: precios de mercado, competencia      │    │
│  │ LegalSource    → RAG + web: impuestos, normativa, laboral   │    │
│  │ IndustrySource → Web search: noticias del rubro, tendencias │    │
│  │ TipSource      → Datos del tenant: tips, benchmarks, ops    │    │
│  │ CrossSource    → Combina 2+: los insights más potentes      │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ TOOLS EXISTENTES (no cambian, son el sustrato)               │    │
│  │ 54 Odoo skills, MeLi hybrid, Tavily/Serper/Grounding,       │    │
│  │ RAG (master + tenant docs), Memory, Web Scraper              │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. PERFILES — Las 3 capas de contexto

### Capa 0: Empresa (auto, F7.5 — POC validado)

Se genera con Company Discovery (~60 queries Odoo, 73s). Cero input del usuario.

```typescript
interface TenantProfile {
  businessModel: 'distribucion' | 'servicio'
  scale: { productCount: number; activeClients: number; monthlyRevenue: number; avgTicket: number }
  topCategories: string[]
  topProducts: { name: string; avgPrice: number; monthlySales: number }[]
  topClients: { name: string; revenue: number }[]
  hasEcommerce: boolean
  hasExpiryTracking: boolean
  hasSalesTeams: boolean
  salesTeams: string[]
  activeProvinces: string[]
  industry: string          // 'dental' | 'indumentaria' | 'alimentos' | etc.
  industryKeywords: string[] // para web search del rubro
}
```

**QUÉ HABILITA:**
- `hasExpiryTracking` → activa discoveries de vencimiento
- `hasSalesTeams` → activa discoveries de zona/vendedor
- `topProducts` → alimenta comparaciones con MeLi (MarketSource)
- `industry` + `industryKeywords` → alimenta búsquedas de noticias del rubro (IndustrySource)
- `topClients` → alimenta scoring de cliente-fantasma, cross-sell

**~200 tokens en system prompt.** Se refresca semanalmente.

### Capa 1: Usuario (conversación libre, F7.6)

No es formulario. El usuario escribe lo que quiera. LLM extrae estructura.

```typescript
interface UserProfile {
  role: 'dueno' | 'comercial' | 'compras' | 'cobranzas' | 'operaciones' | 'contable'
  painPoints: string[]       // ['cobranza', 'stock_sin_movimiento', 'margen']
  watchlist: {
    clients: string[]        // ['Macrodental', 'Ministerio Salud SF']
    products: string[]       // ['siliconas', 'composites']
    zones: string[]          // ['Córdoba', 'Mendoza']
    categories: string[]     // ['descartables', 'equipamiento']
  }
  interests: string[]        // temas libres: ['precios de mercado', 'impuestos', 'competencia']
  communicationStyle: string // 'directo, informal' | 'detallado, formal'
  onboarded: boolean
  rawOnboardingText: string  // lo que escribió el usuario, tal cual
}
```

**QUÉ HABILITA:**
- `role` → filtra discoveries por relevancia (dueño ve todo, comercial ve ventas, compras ve stock)
- `painPoints` → boost en scoring de discoveries relacionados
- `watchlist` → personaliza teasers con entidades que le importan
- `interests` → habilita sources no-Odoo (si le interesan "precios de mercado" → MarketSource boost, si le interesa "impuestos" → LegalSource boost)

**~100 tokens en system prompt.** Se enriquece con cada chat.

### Capa 2: Memoria (automática, invisible)

Cada interacción alimenta el perfil silenciosamente.

```typescript
// lib/intelligence/profiles/memory-enricher.ts

async function onUserMessage(userId: string, message: string, toolResults?: any[]) {
  // 1. Extraer entidades mencionadas
  const entities = extractEntities(message)
  // "cuánto le vendimos a Macrodental" → { type: 'client', name: 'Macrodental' }
  
  // 2. También extraer de resultados de tools (nombres reales del ERP)
  if (toolResults) {
    entities.push(...extractEntitiesFromToolResults(toolResults))
  }
  
  for (const entity of entities) {
    await incrementMention(userId, entity)
    // Si menciona algo 3+ veces → auto-agregar al watchlist
    if (await getMentionCount(userId, entity) >= 3) {
      await addToWatchlist(userId, entity)
    }
  }
}

async function onDiscoveryInteraction(userId: string, discoveryId: string, source: DiscoverySource, tapped: boolean) {
  await saveDiscoveryInteraction(userId, discoveryId, source, tapped)
  // Si ignora un source 5+ veces → penalizar en scoring
  // Si toca un source seguido → boostear en scoring
}
```

**No va en el prompt. Alimenta el scoring engine internamente.**

**El usuario no sabe que Tuqui "aprendió". Solo nota que cada día es más relevante.**

---

## 2. DISCOVERY ENGINE — El motor del dopamine loop

### 2.1 El concepto central

Cada vez que el usuario abre Tuqui, recibe **2 teasers** de **sources distintos**:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  💰 Macrodental no te compra hace 47 días            │  ← OdooSource
│     — antes lo hacía cada 20.                        │
│     → "¿Qué dejó de llevar?"                       │
│                                                      │
│  ⚖️ ARCA subió retenciones de IVA para              │  ← LegalSource
│     monotributistas al 10.5% desde marzo.            │
│     → "¿Me afecta?"                                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Regla de oro: NUNCA 2 del mismo source.** Esto fuerza variedad y crea la sensación de "Tuqui sabe de todo".

El dato genera urgencia. La pregunta genera el click. El click genera conversación. La conversación genera valor. El valor genera retorno.

### 2.2 Interfaz unificada

```typescript
// lib/intelligence/discoveries/types.ts

type DiscoverySource = 'odoo' | 'market' | 'legal' | 'industry' | 'tip' | 'cross'

interface Discovery {
  id: string
  source: DiscoverySource
  category: 'dinero' | 'stock' | 'clientes' | 'mercado' | 'legal' | 'rubro' | 'ops'
  models: ('distribucion' | 'servicio')[]
  roles: string[]               // qué roles ven este discovery
  cooldownDays: number           // no repetir antes de N días
  pushWorthy: boolean            // ¿merece push notification?
  
  // Rápido (~1 query o cache). Corre al abrir.
  getTeaser: (ctx: DiscoveryContext) => Promise<Teaser | null>
  
  // Pesado. Corre SOLO si el usuario toca la pregunta.
  deepDive: (ctx: DiscoveryContext, teaserData: any) => Promise<string>
}

interface DiscoveryContext {
  tenantId: string
  tenantProfile: TenantProfile
  userProfile: UserProfile
  odooCredentials?: OdooCredentials  // para Odoo queries
}

interface Teaser {
  emoji: string
  dato: string          // Una línea. El hook.
  pregunta: string      // La pregunta sugerida. El call to action.
  teaserData: any       // Contexto para el deepDive.
  discoveryId: string   // Para tracking.
  source: DiscoverySource
}
```

### 2.3 Los 6 Discovery Sources

---

#### SOURCE 1: OdooSource — Datos del ERP (ya tenemos 54 skills)

**Lo que detecta:** anomalías, tendencias, problemas ocultos en datos operativos.

```
DINERO
├── moroso-que-compra      "X te debe $Y pero te compró $Z esta semana"
│                          → "¿Cuántos más están así?"
├── concentracion-riesgo   "El 52% de tu facturación depende de 3 clientes"
│                          → "¿Quiénes son y cuánto me duele si se va uno?"
└── dia-mas-rentable       "Los martes facturás 40% más que los jueves"
                           → "¿Qué se vende más cada día?"

STOCK
├── capital-dormido        "$4.2M parados en productos sin venta en 3 meses"
│                          → "¿Cuáles son y cómo los liquido?"
├── vencimiento            "Silicona Vericom: 90 unidades, vence en mayo" [pushWorthy]
│                          → "¿Con qué lo puedo combinar para sacarlo?"
├── comprando-al-pedo      "Seguís comprando X pero las ventas cayeron 40%"
│                          → "¿Qué otros productos estoy comprando de más?"
├── estrella-sin-stock     "Tu #2 en ventas tiene stock para 12 días" [pushWorthy]
│                          → "¿Hay pedido abierto?"
└── producto-trending      "Las puntas de mezcladoras crecieron 80% este mes"
                           → "¿Tengo stock para aguantar?"

CLIENTES
├── cliente-fantasma       "Macrodental no compra hace 47 días, antes cada 20"
│                          → "¿Qué dejó de llevar?"
├── cliente-que-achica     "X pasó de $500K/mes a $200K/mes"
│                          → "¿Qué categorías dejó?"
├── cliente-nuevo-fuerte   "Y es cliente hace 30 días y ya compró $1.2M"
│                          → "¿Qué más le puedo ofrecer?"
├── cross-sell             "15 clientes compran composite pero no adhesivo"
│                          → "¿Quiénes son?"
└── zona-muerta            "Córdoba: 14 clientes, $0 en febrero"
                           → "¿Qué pasa con el vendedor de esa zona?"
```

**Implementación:** Cada discovery llama a 1-2 Odoo skills existentes, compara contra thresholds, genera teaser si hay anomalía.

---

#### SOURCE 2: MarketSource — Precios y competencia (MeLi hybrid ya funciona)

**Lo que detecta:** oportunidades de margen, competencia, productos trending en el mercado.

```
├── precio-vs-mercado      "Vendés Silicona X a $45K. En MeLi mínimo $62K"
│                          → "¿Estoy regalando margen?"
│
├── precio-caro            "Tu Composite Y a $85K. MeLi promedio $52K"
│                          → "¿Estoy perdiendo ventas por precio?"
│
├── producto-trending-meli "Los scanners intraorales explotaron en MeLi (+200%)"
│                          → "¿Los tenemos? ¿Deberíamos?"
│
└── competencia-precio     "Tu competidor bajó el eyector descartable 20% en MeLi"
                           → "¿Ajusto mi precio?"
```

**Implementación:**
```typescript
const precioVsMercado: Discovery = {
  id: 'precio-vs-mercado',
  source: 'market',
  category: 'mercado',
  cooldownDays: 7,
  pushWorthy: false,
  models: ['distribucion'],
  roles: ['dueno', 'comercial'],
  
  async getTeaser(ctx) {
    // 1. Tomar un producto del watchlist o topProducts
    const product = pickProductForComparison(ctx)
    if (!product) return null
    
    // 2. Buscar en MeLi (usa searchMeliHybrid que ya existe)
    const meliResult = await searchMeliHybrid(product.name)
    if (!meliResult?.minPrice) return null
    
    // 3. Comparar
    const diff = ((meliResult.minPrice - product.avgSalePrice) / product.avgSalePrice * 100)
    if (Math.abs(diff) < 15) return null // diferencia no interesante
    
    return {
      emoji: diff > 0 ? '🛒' : '⚠️',
      dato: `${product.name}: vos lo vendés a $${fmt(product.avgSalePrice)}. En MeLi ${diff > 0 ? 'mínimo' : 'promedio'} $${fmt(meliResult.minPrice)}.`,
      pregunta: diff > 0 ? '¿Estoy regalando margen?' : '¿Estoy caro vs el mercado?',
      teaserData: { product, meliResult, diff },
      discoveryId: 'precio-vs-mercado',
      source: 'market',
    }
  },

  async deepDive(ctx, data) {
    // Análisis completo con Gemini Grounding: links, rango de precios, competidores
    return await analyzeMeliPricesWithGrounding(data.product.name, { 
      userPrice: data.product.avgSalePrice 
    })
  }
}
```

**Costo:** 1 búsqueda MeLi hybrid ≈ $0.003 (Serper + Grounding). Aceptable para 1/día.

---

#### SOURCE 3: LegalSource — Impuestos, normativa, laboral (RAG + web search)

**Lo que detecta:** cambios regulatorios que afectan al negocio, vencimientos legales, oportunidades tributarias.

```
IMPOSITIVO
├── cambio-impositivo      "ARCA subió retenciones de IVA al 10.5% desde marzo"
│                          → "¿Me afecta?"
├── vencimiento-fiscal     "DJ Ganancias: vence el 15 de abril para SRL"
│                          → "¿Ya la presenté?"
└── oportunidad-fiscal     "Nuevo régimen de amortización acelerada para PyMEs"
                           → "¿Me conviene?"

LABORAL
├── paritarias             "Convenio de comercio: aumento 12% en marzo"
│                          → "¿Cuánto me sube la masa salarial?"
├── vencimiento-laboral    "DDJJ F931 vence el 11 del mes que viene"
│                          → "¿Está al día?"
└── nueva-regulacion       "Obligación de canal de denuncias para +50 empleados"
                           → "¿Me aplica?"

SOCIETARIO
├── vencimiento-sociedad   "Presentación balance anual: vence en 4 meses"
│                          → "¿Está iniciado?"
└── cambio-normativo       "Nuevas reglas para factura electrónica tipo E"
                           → "¿Nos afecta?"
```

**Implementación:**
```typescript
const cambioImpositivo: Discovery = {
  id: 'cambio-impositivo',
  source: 'legal',
  category: 'legal',
  cooldownDays: 14,
  pushWorthy: false,
  models: ['distribucion', 'servicio'],
  roles: ['dueno', 'contable'],

  async getTeaser(ctx) {
    // 1. Web search por novedades impositivas Argentina recientes
    const searchQuery = `novedades impositivas Argentina ${currentMonth()} ${currentYear()} ARCA AFIP`
    const results = await tavilySearch(searchQuery, { maxResults: 5, daysBack: 30 })
    if (!results.length) return null
    
    // 2. LLM filtra: ¿alguna novedad afecta a este tipo de empresa?
    const relevant = await gemini.generateObject({
      prompt: `Sos experto tributario argentino. 
        Empresa: ${ctx.tenantProfile.industry}, ${ctx.tenantProfile.businessModel}, 
        facturación ${ctx.tenantProfile.scale.monthlyRevenue}/mes.
        Noticias: ${results.map(r => r.content).join('\n---\n')}
        ¿Alguna noticia impacta directamente a esta empresa?`,
      schema: z.object({
        relevant: z.boolean(),
        emoji: z.string().optional(),
        dato: z.string().optional(),
        pregunta: z.string().optional()
      })
    })
    
    if (!relevant.relevant) return null
    return { ...relevant, source: 'legal', discoveryId: 'cambio-impositivo' }
  },

  async deepDive(ctx, data) {
    // RAG search en docs legales + web search profundo + explicación LLM
    const ragDocs = await searchKnowledgeBase('tributario', ctx.tenantId, 'contador')
    const webDetail = await tavilySearch(data.searchQuery, { maxResults: 10 })
    return await gemini.generate({
      prompt: `Explicá cómo esta novedad impositiva afecta a ${ctx.tenantProfile.industry}. 
        Docs internos: ${ragDocs}
        Investigación web: ${webDetail}
        Sé concreto: montos, fechas, qué tiene que hacer.`
    })
  }
}
```

**Costo:** 1 Tavily search ≈ $0.0025 + 1 LLM call ≈ $0.001. OK para 1 cada 14 días.

---

#### SOURCE 4: IndustrySource — Noticias del rubro (web search + industry keywords)

**Lo que detecta:** lanzamientos de productos, tendencias de mercado, movimientos de competidores, eventos.

```
├── producto-nuevo         "3M lanzó el composite Filtek Universal Flow"
│                          → "¿Lo tenemos? ¿Deberíamos?"
│
├── tendencia-mercado      "Mercado de aligners en LATAM creció 23% en 2025"
│                          → "¿Debería explorar esa categoría?"
│
├── competidor-movida      "Dental Total abrió sucursal en Córdoba"
│                          → "¿Afecta a mis clientes de esa zona?"
│
├── evento-rubro           "Expo Dental Argentina 2026: abre inscripciones"
│                          → "¿Vamos?"
│
└── regulacion-rubro       "ANMAT: nueva normativa para dispositivos dentales"
                           → "¿Mis productos cumplen?"
```

**Implementación:**
```typescript
const noticiaRubro: Discovery = {
  id: 'noticia-rubro',
  source: 'industry',
  category: 'rubro',
  cooldownDays: 7,
  models: ['distribucion', 'servicio'],
  roles: ['dueno', 'comercial'],
  pushWorthy: false,

  async getTeaser(ctx) {
    // industryKeywords viene del TenantProfile (auto-generado en F7.5)
    // Cedent → ['dental', 'odontología', 'insumos dentales', '3M oral care', 'Ivoclar']
    const query = ctx.tenantProfile.industryKeywords.slice(0, 3).join(' OR ')
    
    const news = await tavilySearch(`${query} Argentina novedades`, {
      maxResults: 5, daysBack: 14, searchType: 'news'
    })
    if (!news.length) return null
    
    // LLM: ¿alguna noticia es relevante y accionable para esta empresa?
    const analysis = await gemini.generateObject({
      prompt: `Sos consultor del rubro ${ctx.tenantProfile.industry}.
        Empresa con categorías: ${ctx.tenantProfile.topCategories.join(', ')}.
        ${ctx.tenantProfile.scale.activeClients} clientes activos.
        
        Noticias recientes:
        ${news.map((n, i) => `${i+1}. ${n.title}: ${n.content}`).join('\n')}
        
        ¿Alguna impacta CONCRETAMENTE en su operación, productos o clientes?
        No genéricas — solo las que generan acción.`,
      schema: z.object({
        relevant: z.boolean(),
        emoji: z.string().optional(),
        dato: z.string().optional(),
        pregunta: z.string().optional()
      })
    })
    
    if (!analysis.relevant) return null
    return { ...analysis, source: 'industry', discoveryId: 'noticia-rubro' }
  }
}
```

**Clave:** `industryKeywords` se genera automáticamente en Company Discovery (F7.5). No hay config manual.

---

#### SOURCE 5: TipSource — Tips accionables de datos propios (sin query externa)

**Lo que detecta:** oportunidades de mejora operativa, features sin usar, benchmarks.

```
├── feature-dormida        "Tenés 526 opp en CRM. 146 llevan +1400 días.
│                           Limpiando, el pipeline se vuelve útil."
│                          → "¿Cuáles son las más viejas?"
│
├── eficiencia-proceso     "30% de tus cotizaciones nunca se facturan"
│                          → "¿Por qué se pierden?"
│
├── resumen-semanal        "Semana: $18.2M facturados (+8%).
│                           Pero cobranza solo $11M. Gap creciente."
│                          → "¿Quiénes son los que más deben?"
│
└── benchmark-rubro        "Tu ticket promedio ($985K) está 20% abajo de
                            distribuidores de tu tamaño"
                           → "¿Es estrategia o se puede mejorar?"
```

**Implementación:** No requiere queries externas. Usa datos del Company Discovery (cacheados) + entity_mentions + discovery_history para generar tips contextuales.

---

#### SOURCE 6: CrossSource — Combina 2+ fuentes (los más potentes)

**Lo que detecta:** insights que SOLO surgen de cruzar fuentes que un humano no cruzaría.

```
ODOO × MELI
├── margen-oculto          "Vendés Silicona X a $45K. MeLi mínimo $62K.
│                           Margen oculto: $17K × 200/mes = $3.4M"
│                          → "¿Subo el precio?"
└── oportunidad-ecommerce  "Tu #3 en ventas no está en MeLi.
                            Competidores lo venden a $80K."
                           → "¿Lo publico?"

ODOO × LEGAL
├── riesgo-legal-cobranza  "Tenés $414M en CxC vencido.
│                           Después de 1 año prescribe la acción judicial."
│                          → "¿Cuánto está cerca de prescribir?"
└── deduccion-stock        "Tenés $96M en stock parado.
                            Se puede deducir como pérdida si está vencido."
                           → "¿Cuánto puedo deducir?"

INDUSTRIA × ODOO
├── producto-nuevo-match   "3M lanzó Filtek Universal Flow.
│                           15 de tus clientes compran composites."
│                          → "¿Lo agrego al catálogo y les aviso?"
└── zona-vs-mercado        "Córdoba: $0 en febrero, pero el mercado dental
                            de Córdoba creció 18% según cámara del sector."
                           → "¿El problema es nuestro o del vendedor?"

PERFIL × ODOO
└── watchlist-alert        "Te preocupa Córdoba. Esta semana: $0 de nuevo."
                           → "¿Hablo con Martín T.?"
```

**Por qué CrossSource es la estrella:**
- Son insights que **ninguna herramienta sola** puede dar
- El usuario siente que Tuqui "piensa" como un consultor
- Tienen bonus de +2 en scoring
- Son los que generan el "¡no sabía eso!" más fuerte

---

### 2.4 Pool — Modelo Servicio

Para empresas de servicio (software, consultoría, agencias):

```
ODOO
├── horas-sin-facturar     "42 horas facturables sin incluir en facturas" [pushWorthy]
│                          → "¿De qué proyectos son?"
├── saturacion             "Lucía está al 115% hace 3 semanas" [pushWorthy]
│                          → "¿Qué proyectos tiene?"
├── subutilizacion         "Pedro está al 45% de utilización"
│                          → "¿Qué proyectos del pipeline le asigno?"
├── proyecto-pasado        "Implementación Y lleva 140% de horas"
│                          → "¿Renegocio o cierro scope?"
├── proyecto-parado        "Proyecto Z sin movimiento 18 días"
│                          → "¿Está bloqueado por el cliente?"
├── contrato-por-vencer    "Contrato de W vence en 45 días" [pushWorthy]
│                          → "¿Arrancamos la renovación?"
├── tickets-anomalos       "Cliente V tiene 3x más tickets que promedio"
│                          → "¿Hay un problema de calidad?"
├── servicio-impago        "3 clientes con servicio activo y 2+ cuotas impagas" [pushWorthy]
│                          → "¿Les corto el servicio?"
└── cliente-caro           "X te paga $200K/mes pero consume 80hs"
                           → "¿Es rentable?"

CROSS (servicio)
├── skill-vs-pipeline      "3 proyectos tipo X en pipeline, 1 persona sabe X"
│                          → "¿A quién capacito?"
└── renta-real             "Facturás $500K a Y pero costás $480K en horas.
                            Margen real: 4%."
                           → "¿Renegocio el rate?"
```

---

### 2.5 Scoring — Relevancia + variedad + sorpresa

```typescript
// lib/intelligence/discoveries/engine.ts

function scoreDiscovery(
  d: Discovery, 
  profile: UserProfile, 
  todayShown: Teaser[]
): number {
  let score = 1.0

  // --- RELEVANCIA (max +4) ---
  // Pain points del onboarding
  if (profile.painPoints.includes('cobranza') && d.category === 'dinero') score += 2
  if (profile.painPoints.includes('stock') && d.category === 'stock') score += 2
  // Watchlist match
  if (hasWatchlistMatch(d, profile)) score += 1.5
  // Intereses habilitan sources no-Odoo
  if (profile.interests?.includes('precios') && d.source === 'market') score += 1.5
  if (profile.interests?.includes('impuestos') && d.source === 'legal') score += 1.5
  if (profile.interests?.includes('competencia') && d.source === 'industry') score += 1.5

  // --- SORPRESA (max +2) ---
  if (d.source === 'cross') score += 2       // cross-source = más valioso
  if (!hasEverSeen(profile, d.source)) score += 1  // novedad

  // --- VARIEDAD (hard penalty) ---
  // NUNCA 2 del mismo source en la misma sesión
  if (todayShown.some(s => s.source === d.source)) score -= 10

  // --- MEMORIA (±1.5) ---
  if (profile.discoveryPreferences?.includes(d.source)) score += 1
  if (profile.discoveryIgnored?.includes(d.source)) score -= 1.5

  return score
}
```

### 2.6 Selección: getSessionOpeners()

```typescript
async function getSessionOpeners(
  tenantId: string, userId: string
): Promise<Teaser[]> {
  const tenant = await getTenantProfile(tenantId)
  const profile = await getUserProfile(userId)
  const history = await getDiscoveryHistory(userId)
  
  // 1. Filtrar pool por modelo de negocio, rol, capabilities del tenant
  let pool = filterPool(allDiscoveries, tenant, profile)
  
  // 2. Excluir por cooldown
  pool = applyCooldown(pool, history)
  
  const teasers: Teaser[] = []
  
  // 3. Primer teaser: el mejor scored sin restricción de source
  const scored1 = pool.map(d => ({ d, score: scoreDiscovery(d, profile, []) }))
  const teaser1 = await tryGetTeaser(scored1, tenant, profile)
  if (teaser1) {
    teasers.push(teaser1)
    
    // 4. Segundo teaser: FORZAR source distinto
    const scored2 = pool
      .filter(d => d.source !== teaser1.source)
      .map(d => ({ d, score: scoreDiscovery(d, profile, [teaser1]) }))
    const teaser2 = await tryGetTeaser(scored2, tenant, profile)
    if (teaser2) teasers.push(teaser2)
  }
  
  // 5. Guardar en history
  for (const t of teasers) await saveShown(userId, t.discoveryId)
  
  return teasers
}

// Weighted random del top 5 (no siempre el #1 → impredecible)
async function tryGetTeaser(
  scored: { d: Discovery; score: number }[], 
  tenant: TenantProfile, 
  profile: UserProfile
): Promise<Teaser | null> {
  const top5 = scored.sort((a, b) => b.score - a.score).slice(0, 5)
  const shuffled = weightedShuffle(top5)
  
  for (const { d } of shuffled) {
    try {
      const ctx = { tenantId: tenant.tenantId, tenantProfile: tenant, userProfile: profile }
      const teaser = await d.getTeaser(ctx)
      if (teaser) return teaser
    } catch { continue }
  }
  return null
}
```

---

## 3. ENTREGA

### 3.1 Al abrir el chat — 2 teasers

```typescript
async function onChatOpen(tenantId: string, userId: string) {
  const teasers = await getSessionOpeners(tenantId, userId)
  
  if (teasers.length > 0) {
    const content = teasers.map(t => `${t.emoji} ${t.dato}`).join('\n\n')
    return {
      role: 'assistant',
      content,
      suggestedQuestions: teasers.map(t => t.pregunta),
      metadata: { teasers: teasers.map(t => t.teaserData) }
    }
  }
  
  return { role: 'assistant', content: '¡Hola! ¿En qué te puedo ayudar?' }
}
```

### 3.2 PWA Push — Solo lo urgente

```
pushWorthy = true SOLO para:
├── estrella-sin-stock     Se te acaba lo que vendés
├── vencimiento            Se te vence mercadería
├── servicio-impago        Te deben y siguen usando
├── contrato-por-vencer    Se te vence un contrato
├── saturacion             Alguien se está quemando
└── horas-sin-facturar     Plata que no cobraste
```

Push a las 7:02 AM. Click abre Tuqui con la pregunta pre-cargada.

### 3.3 Inteligencia pasiva en cada respuesta

El último scan se cachea (~6hs). Se inyecta en system prompt:

```
ALERTAS ACTIVAS DEL NEGOCIO:
- 💰 Macrodental: 47 días sin comprar
- 📦 Composite vence en mayo ($3.8M)

Si alguna alerta es relevante a lo que preguntó el usuario,
mencionala brevemente al final.
```

Ahora "¿cuánto vendimos?" no solo da el número:

> Ventas: $18.2M esta semana (+8%).
> 📌 Dato: Córdoba sigue en $0. 14 clientes sin facturar.

---

## 4. LA SEMANA TIPO — Cómo se siente el loop

```
LUNES
├── 💰 Macrodental no te compra hace 47 días.               [Odoo]
└── ⚖️ ARCA subió retenciones de IVA al 10.5%.              [Legal]

MARTES
├── 🛒 Siliconas: vendés a $45K, MeLi mínimo $62K.          [Cross: Odoo×MeLi]
└── 📦 90 unidades de composite vencen en mayo ($3.8M).      [Odoo]

MIÉRCOLES
├── 📰 3M lanzó Filtek Universal. 15 clientes compran esto.  [Cross: Industria×Odoo]
└── 👥 Córdoba: 14 clientes, $0 en febrero.                  [Odoo]

JUEVES
├── 💡 526 opp en CRM. 146 llevan +1400 días sin moverse.   [Tip]
└── 🏛️ Convenio de comercio: aumento 12% en marzo.           [Legal]

VIERNES
├── 📊 Semana: $18.2M (+8%), pero cobranza solo $11M.        [Tip]
└── 🦷 Mercado aligners LATAM creció 23%. No vendés aligners.[Industry]
```

**Cada día algo nuevo. De fuente distinta. Siempre accionable. Nunca se repite.**

---

## 5. MODELOS DE NEGOCIO

### 5.1 Distribución

Activos que se pudren: **stock** (se vence, se rompe), **plata en la calle** (morosidad), **espacio** (depósito finito).

Cruces multi-source que solo Tuqui puede detectar:
- Stock muerto × clientes que compran esa categoría → campaña dirigida
- Precio Odoo × precio MeLi → margen oculto o sobreprecio
- Morosos × legislación de prescripción → urgencia legal
- Productos trending MeLi × catálogo actual → oportunidad de ecommerce
- Stock vencido × normativa impositiva → deducción fiscal

### 5.2 Servicio

Activos que se pudren: **tiempo** (horas sin facturar), **proyectos** (scope creep), **relaciones** (clientes que se van).

Cruces multi-source:
- Facturado vs costo real × precio de mercado → ¿cobro suficiente?
- Contratos por vencer × noticias del cliente → mejor timing de renovación
- Skills del equipo × pipeline → cuellos de botella antes de que pasen

---

## 6. ESQUEMA DE DATOS

```sql
-- Supabase, todas con RLS

-- Perfil de empresa: se guarda en company_contexts existente
-- Campos: discovery_raw (JSONB), discovery_profile (text), discovery_run_at
-- Ver F7.5 en TUQUI_REFACTOR_PLAN.md

-- Perfil de usuario (onboarding + enriquecido)
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  tenant_id UUID REFERENCES tenants(id),
  role TEXT,                    -- 'dueno' | 'comercial' | 'compras' | 'cobranzas' | 'contable'
  pain_points TEXT[],
  interests TEXT[],             -- temas libres del usuario
  watchlist_clients TEXT[],
  watchlist_products TEXT[],
  watchlist_zones TEXT[],
  watchlist_categories TEXT[],
  communication_style TEXT,
  discovery_preferences TEXT[], -- sources que toca (auto-aprendido)
  discovery_ignored TEXT[],     -- sources que ignora (auto-aprendido)
  onboarded BOOLEAN DEFAULT false,
  raw_onboarding_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Menciones de entidades (para auto-watchlist)
CREATE TABLE entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  entity_type TEXT,             -- 'client' | 'product' | 'zone' | 'category'
  entity_name TEXT,
  mention_count INT DEFAULT 1,
  last_mentioned TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_name)
);

-- Historial de discoveries mostrados
CREATE TABLE discovery_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  tenant_id UUID REFERENCES tenants(id),
  discovery_id TEXT NOT NULL,
  source TEXT NOT NULL,          -- 'odoo' | 'market' | 'legal' | 'industry' | 'tip' | 'cross'
  shown_at TIMESTAMPTZ DEFAULT now(),
  tapped BOOLEAN DEFAULT false,
  tapped_at TIMESTAMPTZ
);

-- Cache de alertas para inteligencia pasiva
CREATE TABLE alert_cache (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  alerts JSONB,                 -- [{ emoji, dato, discoveryId, source }]
  scanned_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_discovery_history_user ON discovery_history(user_id, shown_at DESC);
CREATE INDEX idx_entity_mentions_user ON entity_mentions(user_id, entity_type);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_cache ENABLE ROW LEVEL SECURITY;
```

---

## 7. ESTRUCTURA DE ARCHIVOS

```
lib/
  intelligence/
    profiles/
      types.ts                 # TenantProfile, UserProfile, EntityMention
      extract-profile.ts       # LLM extrae perfil de texto libre
      user-profile.ts          # CRUD de user_profiles
      memory-enricher.ts       # Auto-watchlist + discovery tracking
    
    discoveries/
      types.ts                 # Discovery, Teaser, DiscoverySource, DiscoveryContext
      engine.ts                # getSessionOpeners() + scoring + selección
      registry.ts              # Pool de todos los discoveries disponibles
      
      sources/
        odoo/                  # ~13 distribución + ~9 servicio
          cliente-fantasma.ts
          capital-dormido.ts
          vencimiento.ts
          estrella-sin-stock.ts
          moroso-que-compra.ts
          comprando-al-pedo.ts
          producto-trending.ts
          cliente-que-achica.ts
          cliente-nuevo-fuerte.ts
          cross-sell.ts
          zona-muerta.ts
          concentracion-riesgo.ts
          dia-mas-rentable.ts
          # servicio:
          horas-sin-facturar.ts
          saturacion.ts
          subutilizacion.ts
          proyecto-pasado.ts
          proyecto-parado.ts
          contrato-por-vencer.ts
          tickets-anomalos.ts
          servicio-impago.ts
          cliente-caro.ts
        
        market/                # MeLi hybrid (4)
          precio-vs-mercado.ts
          precio-caro.ts
          producto-trending-meli.ts
          competencia-precio.ts
        
        legal/                 # RAG + web search (6)
          cambio-impositivo.ts
          vencimiento-fiscal.ts
          oportunidad-fiscal.ts
          paritarias.ts
          vencimiento-laboral.ts
          nueva-regulacion.ts
        
        industry/              # Web search rubro (5)
          producto-nuevo.ts
          tendencia-mercado.ts
          competidor-movida.ts
          evento-rubro.ts
          regulacion-rubro.ts
        
        tip/                   # Tips de datos propios (4)
          feature-dormida.ts
          eficiencia-proceso.ts
          resumen-semanal.ts
          benchmark-rubro.ts
        
        cross/                 # Combina 2+ fuentes (6)
          margen-oculto.ts          # odoo × meli
          oportunidad-ecommerce.ts  # odoo × meli
          riesgo-legal-cobranza.ts  # odoo × legal
          deduccion-stock.ts        # odoo × legal
          producto-nuevo-match.ts   # industria × odoo
          watchlist-alert.ts        # perfil × odoo
    
    delivery/
      session-opener.ts        # onChatOpen() → 2 teasers
      alert-cache.ts           # Cache para inteligencia pasiva
      inject-intelligence.ts   # Inyectar alertas en contexto
    
    push/
      subscribe.ts
      send.ts
      daily-scanner.ts         # Cron: scan pushWorthy + enviar
```

---

## 8. FASES DE IMPLEMENTACIÓN

### Fase 1: Perfiles + 5 OdooSource discoveries (2-3 semanas)
- [ ] Migration 211 (`user_profiles` + `entity_mentions` + `discovery_history`)
- [ ] `lib/intelligence/profiles/*` — types, extractProfileFromText, CRUD, memory-enricher
- [ ] Onboarding conversacional en primera sesión del chat
- [ ] Inyectar perfil de usuario en system prompt
- [ ] `lib/intelligence/discoveries/types.ts` + `engine.ts` + `registry.ts`
- [ ] 5 OdooSource discoveries (los de mayor impacto):
  `moroso-que-compra`, `vencimiento`, `estrella-sin-stock`, `cliente-fantasma`, `capital-dormido`
- [ ] Session opener: al abrir chat → 1 teaser + pregunta sugerida
- [ ] Tests + probar con Cedent

### Fase 2: MarketSource + CrossSource (1-2 semanas)
- [ ] 3 MarketSource: `precio-vs-mercado`, `precio-caro`, `producto-trending-meli`
- [ ] 2 CrossSource Odoo×MeLi: `margen-oculto`, `oportunidad-ecommerce`
- [ ] Subir a 2 teasers por sesión (de sources distintos obligatorio)
- [ ] Validar con Cedent: ¿datos de MeLi relevantes?

### Fase 3: LegalSource + IndustrySource (2 semanas)
- [ ] Requiere RAG con docs legales cargados (F7)
- [ ] 3 LegalSource: `cambio-impositivo`, `vencimiento-fiscal`, `paritarias`
- [ ] 3 IndustrySource: `producto-nuevo`, `tendencia-mercado`, `evento-rubro`
- [ ] 2 CrossSource multi-fuente: `producto-nuevo-match`, `riesgo-legal-cobranza`
- [ ] industryKeywords auto-generadas en Company Discovery

### Fase 4: TipSource + inteligencia pasiva (1 semana)
- [ ] 4 TipSource: `feature-dormida`, `eficiencia-proceso`, `resumen-semanal`, `benchmark-rubro`
- [ ] `alert_cache` + `inject-intelligence` (inyectar alertas en todas las respuestas)
- [ ] Ajustar scoring con datos reales de `discovery_history`

### Fase 5: PWA Push + proactivo (F5 en refactor plan)
- [ ] daily-scanner cron para pushWorthy discoveries
- [ ] Push → click → chat con pregunta pre-cargada

### Fase 6: Modelo servicio (2-3 semanas)
- [ ] 9 OdooSource servicio + 2 CrossSource servicio
- [ ] Validar con primer cliente de servicio

### Ongoing: Flywheel
- [ ] Trackear tap rate por source y discovery
- [ ] A/B testear hooks y preguntas
- [ ] Nuevos discoveries según feedback de uso
- [ ] Benchmarks por rubro (dental, indumentaria, alimentos...)

---

## 9. POR QUÉ MULTI-SOURCE MATA

```
Solo Odoo (el plan anterior):
├── Semana 1: "vendiste X, debés Y, stock Z" → interesante
├── Semana 2: "vendiste X', debés Y', stock Z'" → ok
├── Semana 3: "vendiste X'', debés Y'', stock Z''" → meh
├── Semana 4: el usuario deja de abrir
└── El pool se agota. Siempre son números que cambian un poco.

Multi-source (este plan):
├── Lunes: cliente-fantasma (Odoo) + retenciones IVA (Legal)
├── Martes: margen oculto (Cross: Odoo×MeLi) + stock vence (Odoo)
├── Miércoles: 3M lanzó producto (Cross: Industria×Odoo) + zona muerta (Odoo)
├── Jueves: CRM sucio (Tip) + paritarias (Legal)
├── Viernes: resumen semanal (Tip) + tendencia mercado (Industry)
├── ...
├── Semana 4: todavía hay contenido fresco
├── Semana 8: nuevas noticias, nuevos precios, nuevas regulaciones
└── El pool NUNCA se agota porque web+legal+mercado cambian constantemente
```

---

## 10. MÉTRICAS DE ÉXITO

### Dopamine Loop Health

| Métrica | Target | Cómo medir |
|---------|--------|------------|
| DAU/MAU ratio | >40% | Logins diarios vs mensuales |
| Días consecutivos | ≥5/semana | Sesiones con interacción |
| Tap rate | >35% | `discovery_history.tapped` |
| Source variety | 4+ sources/semana | History por usuario |
| Churn 30d | <15% | Usuarios que dejan de abrir |

### Valor generado

| Métrica | Target | Cómo medir |
|---------|--------|------------|
| "No sabía eso" moments | ≥3/semana | Taps en cross-source |
| Acciones post-discovery | ≥1/semana | Tool use después de deep dive |
| Revenue recuperado | Trackeable | Stock liquidado, deuda cobrada |

---

## El pitch en una línea

**"Tuqui no te muestra datos. Te dice lo que no sabías que tenías que preguntar. De fuentes que vos solo no cruzarías."**

---

*Creado: 2026-02-15*  
*Actualizado: 2026-02-16 — multi-source architecture, dopamine loop, 6 discovery sources*  
*Relación: Implementación inmediata en `TUQUI_REFACTOR_PLAN.md` (F7 → F7.5 → F7.6 → F5 → F6 → F8 → F9)*
